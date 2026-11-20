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

test('public Investigação: evidence ticked in the visible list is counted and a free question produces a reading', async ({ page }) => {
  await page.goto('/ask.html', { waitUntil: 'domcontentloaded' });
  await page.locator('textarea:visible, input[type=text]:visible').first().fill('Quanto subiu o preço do chocolate em 2026?');
  await page.locator('button:visible:has-text("Buscar evidências")').first().click();
  const boxes = page.locator('#pv4-results input[data-evidence-key]');
  await expect(boxes.first()).toBeVisible();
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.locator('#pv4-results')).toContainText('2 evidência(s) selecionada(s)');
  await page.locator('button:visible:has-text("Gerar resposta")').first().click();
  await expect(page.locator('#pv4-results input[data-evidence-key]:checked')).toHaveCount(2);
  await expect(page.locator('#pv4-response')).toContainText('LEITURA:');
  await expect(page.locator('#pv4-response')).toContainText('[E1]');
});

test.describe('Preços do piloto de chocolate (app.html#precos)', () => {
  test('signed out: no price or brand is shown, only the way in and the public pilot status', async ({ page }) => {
    let fetched = false;
    await page.route('**/pilot-chocolate-prices.json*', (route) => { fetched = true; return route.continue(); });
    await page.goto('/app.html?view=precos#precos', { waitUntil: 'domcontentloaded' });
    const host = page.locator('#pv4-prices');
    await expect(host).toContainText('ficam na área logada');
    await expect(host.locator('a[href="./auth.html"]')).toBeVisible();
    await expect(host.locator('a[href="./pilot-chocolate.html"]')).toBeVisible();
    await expect(page.locator('#pv4-price-body')).toHaveCount(0);
    expect(fetched).toBe(false);
    await expect(page.locator('.pv4-rail nav a[aria-current="page"]')).toHaveAttribute('data-nav', 'base');
    await expect(page.locator('.pv4-rail nav a')).toHaveCount(5);
  });

  test('signed in: items, manufacturer presence and tablets come from the committed capture file; search and filters work', async ({ page }) => {
    await signedIn(page);
    await page.goto('/app.html?view=precos#precos', { waitUntil: 'domcontentloaded' });
    const data = await page.evaluate(() => fetch('./pilot-chocolate-prices.json').then((r) => r.json()));
    const host = page.locator('#pv4-prices');
    const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const first = data.items[0];
    const row = page.locator('#pv4-price-body tr').first();
    await expect(row).toContainText(first.description);
    await expect(row).toContainText(first.gtin);
    await expect(row).toContainText(brl(first.median_brl));
    await expect(page.locator('#pv4-price-body tr')).toHaveCount(50);
    await expect(host.locator('.pv4-price-bar').first()).toContainText(data.manufacturer_coverage[0].manufacturer);
    await expect(host.locator('.pv4-price-line').first()).toContainText(brl(data.benchmark.rows[0].median_per_100g_brl));
    await expect(host).toContainText('não mede volume, participação nem o Brasil');
    await expect(host).toContainText('lidos do texto da nota fiscal por regra');

    const maker = data.manufacturer_coverage[0].manufacturer;
    await page.locator('#pv4-price-maker').selectOption({ label: maker });
    const expected = data.items.filter((i) => i.manufacturer === maker).length;
    await expect(page.locator('#pv4-price-count')).toContainText(expected.toLocaleString('pt-BR') + ' item(ns) neste filtro');
    await page.locator('#pv4-price-maker').selectOption('');
    await page.locator('#pv4-price-search').fill(first.gtin);
    await expect(page.locator('#pv4-price-body tr')).toHaveCount(1);
    await page.locator('#pv4-price-search').fill('');
    await page.locator('#pv4-price-sort').selectOption('spread');
    const top = [...data.items].filter((i) => i.spread_pct !== null).sort((a, b) => b.spread_pct - a.spread_pct || b.stores - a.stores)[0];
    await expect(page.locator('#pv4-price-body tr').first()).toContainText(top.gtin);
    await page.locator('#pv4-price-sort').selectOption('stores');
    await page.locator('#pv4-price-more').click();
    await expect(page.locator('#pv4-price-body tr')).toHaveCount(100);
  });

  test('phone: the price table does not make the page scroll sideways', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await signedIn(page);
    await page.goto('/app.html?view=precos#precos', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pv4-price-body tr').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('#pv4-price-body tr').first().locator('td.pv4-price-wide').first()).toBeHidden();
    await context.close();
  });

  test('Hoje, Base and the pilot page lead to the price view; the public pilot page lists no manufacturer comparison', async ({ page }) => {
    await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-pilot-card] a[href="./app.html?view=precos#precos"]')).toBeVisible();
    await expect(page.locator('[data-pilot-card] a[href="./pilot-chocolate.html"]')).toBeVisible();
    await page.goto('/pilot-chocolate.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[href="./app.html?view=precos#precos"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('PRESENÇA EM LOJA POR FABRICANTE');
  });
});

// Serves the public evidence without the items that speak to one shopper question, to exercise the "no evidence" paths
// whatever the real base holds.
async function withoutShopperQuestion(page, key) {
  const path = require('path');
  const root = path.resolve(__dirname, '..', '..');
  global.window = {}; delete require.cache[require.resolve(path.join(root, 'pulse-public-evidence.js'))];
  require(path.join(root, 'pulse-public-evidence.js'));
  const S = require(path.join(root, 'pulse-shopper-map.js'));
  const kept = global.window.PULSE_EVIDENCE.filter((e) => !((S.entry(e) || { q: [] }).q.includes(key)));
  await page.route('**/pulse-public-evidence.js*', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.PULSE_EVIDENCE=' + JSON.stringify(kept) + ';' }));
}

test.describe('Shopper question map', () => {
  test('Hoje shows, for each shopper question, the strongest evidence of the category or says there is none', async ({ page }) => {
    await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
    const rows = await page.evaluate(() => window.PULSE_SHOPPER.coverage(window.PULSE_EVIDENCE, 'chocolate'));
    const levels = await page.evaluate(() => window.PULSE_SHOPPER.LEVELS);
    const map = page.locator('[data-shopper-map]');
    await expect(map.locator('[data-shopper-question]')).toHaveCount(6);
    for (const r of rows) {
      const row = map.locator(`[data-shopper-question="${r.key}"]`);
      await expect(row).toContainText(r.label);
      const cells = row.locator('.pv4-shopper-cell');
      for (const [i, cell] of [[0, r.category], [1, r.general]]) {
        if (!cell.count) await expect(cells.nth(i)).toContainText('Sem evidência na base');
        else {
          await expect(cells.nth(i)).toContainText(new RegExp(levels[cell.level], 'i'));
          await expect(cells.nth(i)).toContainText(cell.count + ' evidência(s)');
          await expect(cells.nth(i).locator('[data-case-evidence]')).toHaveAttribute('data-case-evidence', cell.items[0].id);
        }
      }
    }
    const first = rows.find((r) => r.category.count);
    await map.locator(`[data-shopper-question="${first.key}"] [data-case-evidence]`).first().click();
    await expect(page.locator('#pv3-inspector')).toHaveClass(/open/);
  });

  test('Investigação puts the evidence that speaks to the shopper question first and says so', async ({ page }) => {
    await page.goto('/ask.html', { waitUntil: 'domcontentloaded' });
    const ask = async (q) => { await page.locator('textarea:visible, input[type=text]:visible').first().fill(q); await page.locator('button:visible:has-text("Buscar evidências")').first().click(); };
    await ask('O que o shopper faz quando o preço do chocolate sobe?');
    const banner = page.locator('#pv4-results [data-shopper-banner]');
    await expect(banner).toContainText('Como reage ao preço');
    await expect(banner).toContainText('compra observada em painel');
    const keys = await page.locator('#pv4-results .result input[data-evidence-key]').evaluateAll((els) => els.map((e) => e.dataset.evidenceKey));
    expect(keys[0]).toBe('kantar-chocolate-brasil-volume-q1-2025');
    expect(keys.slice(0, 6)).toContain('niq-full-view-2026-price');
    await expect(page.locator('#pv4-results .result').first().locator('.pv4-shopper-tag')).toHaveText('Fala desta pergunta de shopper');

    await ask('Qual é a participação de mercado em chocolate?');
    await expect(banner).toContainText('não tem dado de participação de mercado nem de vendas por marca');

    await ask('Como está o varejo?');
    await expect(banner).toContainText('Não identifiquei uma pergunta de shopper');
  });

  test('Investigação says it has no evidence when the base holds none for the shopper question', async ({ page }) => {
    await withoutShopperQuestion(page, 'quem');
    await page.goto('/ask.html', { waitUntil: 'domcontentloaded' });
    await page.locator('textarea:visible, input[type=text]:visible').first().fill('Quem compra chocolate premium?');
    await page.locator('button:visible:has-text("Buscar evidências")').first().click();
    const banner = page.locator('#pv4-results [data-shopper-banner]');
    await expect(banner).toContainText('Quem compra');
    await expect(banner).toContainText('Chocolate: sem evidência na base');
    await expect(banner).toContainText('contexto, não resposta');
    await expect(page.locator('#pv4-results .pv4-shopper-tag')).toHaveCount(0);
  });
});

test.describe('Shopper insights in Universo and in the public reading', () => {
  test('Universo opens with shopper evidence first, filters by shopper question and says when there is none', async ({ page }) => {
    await page.goto('/index.html#overview', { waitUntil: 'domcontentloaded' });
    const ids = () => page.locator('#pv3-signals .pv4-evidence').evaluateAll((els) => els.map((e) => e.dataset.evidenceId));
    const map = await page.evaluate(() => Object.fromEntries(window.PULSE_EVIDENCE.map((e) => [e.id, window.PULSE_SHOPPER.entry(e)])));
    const all = await ids();
    expect(all.length).toBe(Object.keys(map).length);
    const firstContext = all.findIndex((id) => !map[id].q.length);
    expect(firstContext).toBeGreaterThan(0);
    expect(all.slice(firstContext).every((id) => !map[id].q.length)).toBe(true);
    expect(map[all[0]].level).toBe('observado');
    await expect(page.locator('#pv3-signals .pv4-evidence').first().locator('.pv4-shopper-line')).toContainText('Pergunta de shopper:');
    await expect(page.locator('#pv3-signals .pv4-evidence').last().locator('.pv4-shopper-line')).toContainText('Contexto de mercado:');

    await page.locator('#pv3-shopper-question').selectOption('preco');
    const preco = await ids();
    expect(preco.sort()).toEqual(Object.keys(map).filter((id) => map[id].q.includes('preco')).sort());
    await page.locator('#pv3-shopper-question').selectOption('canal');
    await page.locator('#pv3-category').selectOption({ label: 'preços' });
    await expect(page.locator('#pv3-signals')).toContainText('Sem evidência na base para este filtro.');
    await page.locator('#pv3-category').selectOption('');
    await page.locator('#pv3-shopper-question').selectOption('__context');
    expect((await ids()).every((id) => !map[id].q.length)).toBe(true);
  });

  test('public reading cites every selected evidence by level and repeats the limits each one declares', async ({ page }) => {
    await page.goto('/ask.html', { waitUntil: 'domcontentloaded' });
    await page.locator('textarea:visible, input[type=text]:visible').first().fill('O que o shopper faz quando o preço do chocolate sobe?');
    await page.locator('button:visible:has-text("Buscar evidências")').first().click();
    for (const id of ['locomotiva-pascoa-2026-intencao-drivers', 'kantar-chocolate-brasil-volume-q1-2025']) await page.locator(`#pv4-results input[data-evidence-key="${id}"]`).check();
    await page.locator('button:visible:has-text("Gerar resposta")').first().click();
    const answer = page.locator('#pv4-response');
    await expect(answer).toContainText('[E1] Compra observada em painel (2025-T1):');
    await expect(answer).toContainText('[E2] Declaração em pesquisa (Páscoa 2026):');
    await expect(answer).toContainText('só a compra observada mostra o que fizeram');
    await expect(answer).toContainText('[E1] Não comprova motivo individual da mudança');
    await expect(page.locator('.pv4-citation-line')).toContainText('[E1] Mercado publicado: kantar-chocolate-brasil-volume-q1-2025');
    await expect(answer).not.toContainText('\\n');
  });
});

test.describe('More than one category', () => {
  // A second, invented category is added only through the registry, the evidence file and the classification:
  // no page names a category. The item below is invented for the test and says so.
  const fakeItem = {
    id: 'teste-cafe-painel', categoria: 'cafe', tipo: 'painel de compras domiciliares',
    fato: 'Fato inventado para teste: lares compraram a categoria inventada.', contexto: 'Inventado para teste.', interpretacao: 'Inventado para teste.',
    hipotese: 'Inventado para teste.', acao: 'Inventado para teste.', fonte: 'Fonte inventada para teste', url: 'https://example.invalid/teste', periodo: '2026-T1',
    natureza: 'Compras observadas em painel de lares (inventado para teste)', universo_observado: 'Inventado para teste', representa: 'Inventado para teste',
    nao_representa: 'Limite inventado para teste', fonte_primaria: 'Inventada para teste', fato_verificado_na_fonte: 'SIM: item inventado para teste',
    alcance_para_pergunta: 'DIRETO: inventado para teste', keywords: ['cafe', 'quem compra', 'teste'],
  };
  async function withSecondCategory(page) {
    const fs = require('fs'); const path = require('path');
    const root = path.resolve(__dirname, '..', '..');
    const map = fs.readFileSync(path.join(root, 'pulse-shopper-map.js'), 'utf8') + "\n;PULSE_SHOPPER.CATEGORIES.push({key:'cafe',label:'Café',terms:['cafe']});PULSE_SHOPPER.MAP['teste-cafe-painel']={q:['quem'],level:'observado'};";
    const evidence = fs.readFileSync(path.join(root, 'pulse-public-evidence.js'), 'utf8') + '\n;window.PULSE_EVIDENCE.push(' + JSON.stringify(fakeItem) + ');';
    await page.route('**/pulse-shopper-map.js*', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: map }));
    await page.route('**/pulse-public-evidence.js*', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: evidence }));
  }

  test('with one category there is no picker; with two, Hoje lets the person choose and remembers the choice', async ({ page }) => {
    await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-shopper-map]')).toHaveAttribute('data-shopper-category', 'chocolate');
    await expect(page.locator('#pv4-shopper-category')).toHaveCount(0);

    await withSecondCategory(page);
    await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
    const map = page.locator('[data-shopper-map]');
    await expect(map).toHaveAttribute('data-shopper-category', 'chocolate');
    await expect(page.locator('#pv4-shopper-category option')).toHaveText(['Chocolate', 'Café']);
    // The invented coffee item counts as "general" while the person reads chocolate.
    await page.locator('#pv4-shopper-category').selectOption('cafe');
    await expect(map).toHaveAttribute('data-shopper-category', 'cafe');
    await expect(map).toContainText('PERGUNTAS DE SHOPPER: CATEGORIA CAFÉ');
    await expect(map).toContainText('Sem evidência de café para:');
    const who = map.locator('[data-shopper-question="quem"] .pv4-shopper-cell');
    await expect(who.nth(0)).toContainText('Compra observada em painel');
    await expect(who.nth(0).locator('[data-case-evidence]')).toHaveAttribute('data-case-evidence', 'teste-cafe-painel');
    await expect(map.locator('[data-shopper-question="canal"] .pv4-shopper-cell').nth(0)).toContainText('Sem evidência na base');
    await who.nth(0).locator('[data-case-evidence]').click();
    await expect(page.locator('#pv3-inspector')).toHaveClass(/open/);

    await page.goto('/intelligence.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-shopper-map]')).toHaveAttribute('data-shopper-category', 'cafe');
    await expect(page.locator('[data-pilot-card]')).toHaveAttribute('data-pilot-category', 'chocolate');
  });

  test('Investigação reads the category from the question', async ({ page }) => {
    await withSecondCategory(page);
    await page.goto('/ask.html', { waitUntil: 'domcontentloaded' });
    await page.locator('textarea:visible, input[type=text]:visible').first().fill('Quem compra café?');
    await page.locator('button:visible:has-text("Buscar evidências")').first().click();
    const banner = page.locator('#pv4-results [data-shopper-banner]');
    await expect(banner).toHaveAttribute('data-shopper-category', 'cafe');
    await expect(banner).toContainText('Café: 1 evidência(s), a mais forte é compra observada em painel');
    const keys = await page.locator('#pv4-results .result input[data-evidence-key]').evaluateAll((els) => els.map((e) => e.dataset.evidenceKey));
    expect(keys[0]).toBe('teste-cafe-painel');

    await page.locator('textarea:visible, input[type=text]:visible').first().fill('Quem compra chocolate?');
    await page.locator('button:visible:has-text("Buscar evidências")').first().click();
    await expect(banner).toHaveAttribute('data-shopper-category', 'chocolate');
    const keys2 = await page.locator('#pv4-results .result input[data-evidence-key]').evaluateAll((els) => els.map((e) => e.dataset.evidenceKey));
    expect(keys2[0]).not.toBe('teste-cafe-painel');
  });
});
