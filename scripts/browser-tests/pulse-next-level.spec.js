const { test, expect } = require('@playwright/test');

test.describe('Pulse next-level contracts — V3', () => {
  test('single-file workspace expõe registries públicos e estado local', async ({ page }) => {
    await page.goto('/index.html#overview');
    const state = await page.evaluate(() => ({
      evidence: Array.isArray(window.PULSE_EVIDENCE),
      sources: Array.isArray(window.PULSE_SOURCES),
      local: Array.isArray(window.PULSE_LOCAL_EVIDENCE),
      next: !!window.PULSE_NEXT_LEVEL,
      single: !!window.PULSE_SINGLE_FILE_READY
    }));
    expect(state.evidence).toBe(true);
    expect(state.sources).toBe(true);
    expect(state.local).toBe(true);
    expect(state.next).toBe(true);
    expect(state.single).toBe(true);
  });

  test('evidências carregam estrutura factual, contexto, hipótese, ação e proveniência', async ({ page }) => {
    await page.goto('/index.html#overview');
    const sample = await page.evaluate(() => (window.PULSE_EVIDENCE || [])[0]);
    expect(sample).toBeTruthy();
    expect(sample.id).toBeTruthy();
    expect(sample.fato).toBeTruthy();
    expect(sample.contexto).toBeTruthy();
    expect(sample.hipotese).toBeTruthy();
    expect(sample.acao).toBeTruthy();
    expect(sample.fonte).toBeTruthy();
    expect(sample.periodo).toBeTruthy();
    expect(sample.confianca).toBeTruthy();
  });

  test('Inspector mantém a evidência ligada à sua origem e confiança', async ({ page }) => {
    await page.goto('/index.html#overview');
    const id = await page.locator('#pv3-signals .pv3-item[data-evidence-id]').first().getAttribute('data-evidence-id');
    const expected = await page.evaluate(id => (window.PULSE_EVIDENCE || []).find(x => String(x.id) === String(id)), id);
    await page.locator('#pv3-signals .pv3-item[data-evidence-id]').first().getByRole('button', { name: 'Ver evidência' }).click();
    await expect(page.locator('#pv3-inspector')).toContainText(expected.fonte);
    await expect(page.locator('#pv3-inspector')).toContainText(expected.periodo);
    await expect(page.locator('#pv3-inspector')).toContainText(expected.confianca);
  });

  test('Base e Análises continuam sendo destinos distintos do Workspace', async ({ page }) => {
    await page.goto('/index.html#overview');
    const links = await page.locator('.pv3-shell-nav a').evaluateAll(as => as.map(a => ({name:a.dataset.nav, href:a.getAttribute('href')})));
    expect(links.find(x => x.name === 'base').href).toContain('#documents');
    expect(links.find(x => x.name === 'analises').href).toContain('#analyses');
    expect(links.find(x => x.name === 'investigacao').href).toContain('ask.html');
  });
});