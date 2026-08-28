const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function openFilterPanel(page, scope) {
  const panel = page.locator(`[data-filter-scope="${scope}"]`);
  const details = panel.locator('xpath=ancestor::details[contains(@class,"filter-panel")]');
  if (await details.count()) await details.first().evaluate((el) => { el.open = true; });
  await expect(panel.locator('[data-filter="theme"]')).toBeVisible();
  return panel;
}

async function intelligenceCards(page, scope) {
  return page.locator(`#pulse-intelligence-${scope} .pulse-intel-card`).count();
}

async function categoryEvidenceRows(page) {
  return page.locator('#signals .pulse-category-evidence-row:visible').count();
}

test.describe('shopper intelligence filters and single-file UX', () => {
  test('o artefato não referencia scripts JS locais externos', async ({ page }) => {
    await page.goto('/index.html#signals');
    const localScripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('src')).filter((src) => /scripts\//i.test(src)));
    expect(localScripts).toEqual([]);
  });

  test('o arquivo abre sozinho via file:// e inicializa sem erro de página', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack || error.message));
    const fileUrl = `file://${path.resolve('index.html')}#signals`;
    await page.goto(fileUrl);
    await expect(page.locator('body')).toBeVisible();
    expect(errors, `Erros de página:\n${errors.join('\n---\n')}`).toEqual([]);
    const diagnostic = await page.evaluate(() => ({ ready: !!window.PULSE_FILTER_FIX_READY, local: Array.isArray(window.PULSE_LOCAL_EVIDENCE), single: !!window.PULSE_SINGLE_FILE_READY }));
    expect(diagnostic.ready).toBe(true);
    expect(diagnostic.local).toBe(true);
    expect(diagnostic.single).toBe(true);
  });

  test('runtime do shopper intelligence inicializa sem erro', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack || error.message));
    await page.goto('/index.html#signals');
    const diagnostic = await page.evaluate(() => ({ ready: !!window.PULSE_FILTER_FIX_READY, error: window.PULSE_FILTER_FIX_ERROR || '', intelligence: !!window.PULSE_SHOPPER_INTELLIGENCE }));
    expect(errors, `Erros de página:\n${errors.join('\n---\n')}`).toEqual([]);
    expect(diagnostic.error).toBe('');
    expect(diagnostic.ready).toBe(true);
    expect(diagnostic.intelligence).toBe(true);
  });

  test('categorias disponíveis são data-driven e não oferecem opção órfã', async ({ page }) => {
    await page.goto('/index.html#signals');
    const options = await page.locator('#pulse-category-select option').evaluateAll((nodes) => nodes.map((n) => ({ value: n.value, text: n.textContent })));
    expect(options.some((x) => /higiene/i.test(x.text))).toBe(false);
    for (const option of options.filter((x) => x.value !== 'all')) {
      await page.locator('#pulse-category-select').selectOption(option.value);
      await page.waitForTimeout(50);
      const count = await categoryEvidenceRows(page);
      expect(count, `Categoria sem evidência renderizada: ${option.text}`).toBeGreaterThan(0);
    }
  });

  test('categoria Bebidas retorna evidência específica de bebidas', async ({ page }) => {
    await page.goto('/index.html#signals');
    await page.locator('#pulse-category-select').selectOption('bebidas');
    const text = (await page.locator('#signals .pulse-category-evidence-row:visible').allTextContents()).join(' ');
    expect(text).toContain('Bebidas não alcoólicas');
    expect(text).toContain('ocasiões fora do lar');
    expect(await categoryEvidenceRows(page)).toBeGreaterThan(0);
  });

  test('tema Saudabilidade altera o conjunto exibido', async ({ page }) => {
    await page.goto('/index.html#signals');
    const panel = await openFilterPanel(page, 'signals');
    const before = await page.locator('#pulse-intelligence-signals .pulse-intel-card').allTextContents();
    await panel.locator('[data-filter="theme"]').selectOption('saudabilidade');
    const after = await page.locator('#pulse-intelligence-signals .pulse-intel-card').allTextContents();
    expect(after.length).toBeGreaterThan(0);
    expect(after.join(' ')).not.toBe(before.join(' '));
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Saudabilidade');
  });

  test('combinação categoria + tema + período preserva resultado coerente', async ({ page }) => {
    await page.goto('/index.html#signals');
    await page.locator('#pulse-category-select').selectOption('bebidas');
    const panel = await openFilterPanel(page, 'signals');
    await panel.locator('[data-filter="theme"]').selectOption('saudabilidade');
    await panel.locator('[data-filter="period"]').selectOption('2026');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Zero açúcar');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('2026');
    expect(await intelligenceCards(page, 'signals')).toBeGreaterThan(0);
  });

  test('canal altera o resultado e não apenas o contador', async ({ page }) => {
    await page.goto('/index.html#signals');
    await page.locator('#pulse-category-select').selectOption('bebidas');
    const panel = await openFilterPanel(page, 'signals');
    await panel.locator('[data-filter="channel"]').selectOption('foodservice');
    const text = (await page.locator('#pulse-intelligence-signals').innerText()).toLowerCase();
    expect(text).toContain('fora do lar');
    expect(await intelligenceCards(page, 'signals')).toBeGreaterThan(0);
  });

  test('sem resultado apresenta saída clara e reset funcional', async ({ page }) => {
    await page.goto('/index.html#signals');
    await page.locator('#pulse-category-select').selectOption('bebidas');
    const panel = await openFilterPanel(page, 'signals');
    await panel.locator('[data-filter="theme"]').selectOption('premium');
    await panel.locator('[data-filter="period"]').selectOption('2026');
    await panel.locator('[data-filter="channel"]').selectOption('atacarejo');
    await expect(page.locator('#pulse-intelligence-signals .pulse-intel-empty')).toBeVisible();
    await page.locator('#pulse-intelligence-signals [data-intel-reset]').click();
    await expect(page.locator('#pulse-intelligence-signals .pulse-intel-card')).toHaveCount(3);
  });

  test('quatro sugestões têm um único comportamento de seleção e destino', async ({ page }) => {
    await page.goto('/index.html#investigate');
    const suggestions = page.locator('.pulse-suggestion');
    await expect(suggestions).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const suggestion = suggestions.nth(i);
      const question = await suggestion.getAttribute('data-question');
      const target = await suggestion.getAttribute('data-target');
      await suggestion.click();
      await expect(page.locator('#pulse-question')).toHaveValue(question);
      await expect(page.locator('#pulse-ask-submit')).toHaveAttribute('href', target);
      await expect(suggestion).toHaveClass(/selected/);
    }
  });

  test('CSV local é extraído, persistido e aparece identificado no Ask AI', async ({ page }, testInfo) => {
    const csvPath = path.join(testInfo.outputDir, 'estudo-shopper-teste.csv');
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(csvPath, 'driver,insight\nsaudabilidade,Bebidas zero açúcar ganham relevância\ncanal,Fora do lar segue relevante', 'utf8');
    await page.goto('/index.html#investigate');
    await page.locator('#pulse-files').setInputFiles(csvPath);
    await page.waitForFunction(() => Array.isArray(window.PULSE_LOCAL_EVIDENCE) && window.PULSE_LOCAL_EVIDENCE.some((x) => x.name === 'estudo-shopper-teste.csv'));
    await expect(page.locator('#file-list')).toContainText('estudo-shopper-teste.csv');
    await expect(page.locator('#pulse-local-evidence-note')).toContainText('SUA BASE LOCAL');
    const local = await page.evaluate(() => ({ count: window.PULSE_LOCAL_EVIDENCE.length, name: window.PULSE_LOCAL_EVIDENCE[0]?.name, method: window.PULSE_LOCAL_EVIDENCE[0]?.method }));
    expect(local.count).toBe(1);
    expect(local.name).toBe('estudo-shopper-teste.csv');
    expect(local.method).toContain('PapaParse');
    await page.locator('#pulse-question').fill('O que o estudo diz sobre bebidas zero açúcar?');
    await page.locator('#pulse-ask-submit').click();
    await page.waitForTimeout(150);
    await expect(page.locator('#answer-custom')).toBeVisible();
    await expect(page.locator('#pulse-custom-body')).toContainText('SUA BASE LOCAL');
    await expect(page.locator('#pulse-custom-body')).toContainText('estudo-shopper-teste.csv');
  });

  test('CTA Entender o movimento leva primeiro para O que mudou', async ({ page }) => {
    await page.goto('/index.html#overview');
    const cta = page.getByRole('link', { name: /Entender o movimento/i }).first();
    await expect(cta).toHaveAttribute('href', '#signals');
    await cta.click();
    await expect(page).toHaveURL(/#signals$/);
  });

  test('respostas aparecem no viewport e não ficam renderizadas fora da área visível', async ({ page }) => {
    await page.goto('/index.html#investigate');
    await page.locator('#pulse-question').fill('Quais canais estão protegendo a categoria?');
    await page.locator('#pulse-ask-submit').click();
    await page.waitForTimeout(200);
    const box = await page.locator('#answer-custom').boundingBox();
    expect(box).not.toBeNull();
  });

  test('categoria permanece sincronizada ao mudar de etapa', async ({ page }) => {
    await page.goto('/index.html#signals');
    await page.locator('#pulse-category-select').selectOption('chocolates');
    await expect(page.locator('body')).toHaveAttribute('data-pulse-category', 'chocolates');
    await page.evaluate(() => { location.hash = '#diagnostic'; });
    await page.waitForTimeout(100);
    await expect(page.locator('body')).toHaveAttribute('data-pulse-category', 'chocolates');
    await page.evaluate(() => { location.hash = '#opportunities'; });
    await page.waitForTimeout(100);
    await expect(page.locator('body')).toHaveAttribute('data-pulse-category', 'chocolates');
  });
});
