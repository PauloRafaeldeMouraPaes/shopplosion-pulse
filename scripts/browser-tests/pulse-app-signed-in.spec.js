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

test('Base page cards keep title, details and status apart (no run-together text)', async ({ page }) => {
  await signedIn(page, {
    documents: [{ id: '00000000-0000-4000-8000-00000000d002', filename: 'pulse_teste_privado.pdf', mime_type: 'application/pdf', created_at: '2026-09-06T22:30:46Z', storage_path: '00000000-0000-4000-8000-00000000b001/pulse_teste_privado.pdf' }],
  });
  await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
  const row = page.locator('.pv4-list-row').first();
  await expect(row.locator('h3')).toHaveText('pulse_teste_privado.pdf');
  const detail = row.locator('p');
  await expect(detail).toContainText('Tipo: application/pdf');
  await expect(detail).toContainText(' · ');
  await expect(detail).not.toContainText('pulse_teste_privado.pdfTipo');
  await expect(detail).not.toContainText('análisesPENDENTE');
  await expect(detail).not.toContainText('análisesDISPONÍVEL');
});

test('Hoje does not claim a fixed update date; the first case reads the latest PMC and IPCA months of the base', async ({ page }) => {
  await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.pv4-section-title').first()).toContainText(/Base pública: \d+ evidências com fonte/);
  await expect(page.locator('body')).not.toContainText('Atualizado em 11 out 2026');
  const latest = await page.evaluate(() => {
    const monthly = (t) => window.PULSE_EVIDENCE.filter((e) => e.tipo === t && /^\d{4}-\d{2}$/.test(String(e.periodo || ''))).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))).pop();
    return { pmc: monthly('PMC'), ipca: monthly('IPCA') };
  });
  const card = page.locator('[data-latest-case]');
  await expect(card).toContainText(latest.pmc.fato);
  await expect(card).toContainText(latest.ipca.fato);
  await expect(card.locator('[data-case-evidence]')).toHaveAttribute('data-case-evidence', latest.pmc.id);
  await expect(page.locator('body')).toContainText('CONTRADIÇÃO: ALIMENTOS, JULHO DE 2026');
});

test.describe('mobile scope bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the scope selector shows at the top and scrolls away with the page instead of covering content', async ({ page }) => {
    await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
    const bar = page.locator('.pv4-mobile-scope');
    await expect(bar).toBeVisible();
    await expect(bar).toBeInViewport();
    await page.locator('[data-latest-case]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect(bar).not.toBeInViewport();
  });
});

test('Hoje opportunity canvas uses the hypotheses of the latest PMC and IPCA months, not the oldest items of the base', async ({ page }) => {
  await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
  const latest = await page.evaluate(() => {
    const monthly = (t) => window.PULSE_EVIDENCE.filter((e) => e.tipo === t && /^\d{4}-\d{2}$/.test(String(e.periodo || ''))).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))).pop();
    return [monthly('PMC'), monthly('IPCA')].map((e) => e.hipotese);
  });
  const canvas = page.locator('.pv4-op-grid');
  for (const h of latest) await expect(canvas).toContainText(h);
  await expect(canvas).not.toContainText('no início de 2026');
});
