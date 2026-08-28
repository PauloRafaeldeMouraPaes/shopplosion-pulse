const { test, expect } = require('@playwright/test');

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

test.describe('shopper intelligence filters', () => {
  test('runtime do shopper intelligence inicializa sem erro', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/index.html#signals');
    const diagnostic = await page.evaluate(() => ({ ready: !!window.PULSE_FILTER_FIX_READY, error: window.PULSE_FILTER_FIX_ERROR || '', intelligence: !!window.PULSE_SHOPPER_INTELLIGENCE }));
    expect(errors, `Erros de página: ${errors.join(' | ')}`).toEqual([]);
    expect(diagnostic.error).toBe('');
    expect(diagnostic.ready).toBe(true);
    expect(diagnostic.intelligence).toBe(true);
  });

  test('categoria Bebidas retorna evidência específica de bebidas', async ({ page }) => {
    await page.goto('/index.html#signals');
    await openFilterPanel(page, 'signals');
    await page.locator('#pulse-category-select').selectOption('bebidas');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Bebidas');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Consumo fora do lar');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Bebidas não alcoólicas');
    expect(await intelligenceCards(page, 'signals')).toBeGreaterThan(0);
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
    await expect(page.locator('#pulse-intelligence-signals .pulse-intel-card')).toHaveCount(6);
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
