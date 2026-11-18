const { test, expect } = require('@playwright/test');

// Signed-in workspace (app.html) with a simulated session and simulated Supabase responses.
// The database side of the same path is covered by the staging tenant matrix (docs/database/tenant-access-fix-2026-11-17.md):
// from 2026-09-07 to 2026-11-17 every documents query of a signed-in user failed with "permission denied".
// No request reaches the real project: anything not answered here is fulfilled with an empty list.

const REF = 'ppfuygnpgywfpiqxsfys';
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const userId = '00000000-0000-4000-8000-0000000000a1';
const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', exp, aud: 'authenticated', email: 'teste@pulse.invalid' })}.c2lnbmF0dXJl`;
const session = {
  access_token: accessToken,
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: exp,
  user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'teste@pulse.invalid', app_metadata: {}, user_metadata: {} },
};

async function signedIn(page, { documents = [], documentsStatus = 200 } = {}) {
  const calls = [];
  await page.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); } catch (e) {} }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname);
    if (url.pathname.endsWith('/functions/v1/pulse-auth-broker')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ industry_id: '00000000-0000-4000-8000-00000000b001', industry_name: 'Indústria Teste A', industry_slug: 'industria-teste-a', industry_status: 'active', role: 'member' }]) });
    }
    if (url.pathname.endsWith('/auth/v1/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
    }
    if (url.pathname.endsWith('/rest/v1/documents')) {
      if (documentsStatus !== 200) {
        return route.fulfill({ status: documentsStatus, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'permission denied for function current_industry_id' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documents) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  return calls;
}

test('signed-in workspace shows the industry, the account and the industry documents', async ({ page }) => {
  const calls = await signedIn(page, {
    documents: [{ id: '00000000-0000-4000-8000-00000000d001', filename: 'pesquisa-chocolate-2026.pdf', mime_type: 'application/pdf', created_at: '2026-11-17T12:00:00Z', storage_path: '00000000-0000-4000-8000-00000000b001/pesquisa-chocolate-2026.pdf' }],
  });
  await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#industryName')).toHaveText('Indústria Teste A');
  await expect(page.locator('#userEmail')).toHaveText('teste@pulse.invalid');
  await expect(page.locator('#documents')).toContainText('pesquisa-chocolate-2026.pdf');
  expect(calls.some((p) => p.endsWith('/rest/v1/documents'))).toBe(true);
});

test('signed-in workspace reports a documents read failure instead of an empty list', async ({ page }) => {
  await signedIn(page, { documentsStatus: 403 });
  await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#industryName')).toHaveText('Indústria Teste A');
  await expect(page.locator('#documents')).toContainText('Não foi possível carregar os documentos.');
  await expect(page.locator('#documents')).not.toContainText('Nenhum documento anexado ainda.');
});
