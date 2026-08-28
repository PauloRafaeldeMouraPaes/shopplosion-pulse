const { test, expect } = require('@playwright/test');

async function selectFilter(page, scope, filter, value) {
  await page.locator(`[data-filter-scope="${scope}"] [data-filter="${filter}"]`).selectOption(value);
}

async function intelligenceCards(page, scope) {
  return page.locator(`#pulse-intelligence-${scope} .pulse-intel-card`).count();
}

test.describe('shopper intelligence filters', () => {
  test('categoria Bebidas retorna evidência específica de bebidas', async ({ page }) => {
    await page.goto('/index.html#signals');
    await selectFilter(page, 'signals', 'category', 'bebidas');

    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Bebidas');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Consumo fora do lar');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('bebidas não alcoólicas');
    expect(await intelligenceCards(page, 'signals')).toBeGreaterThan(0);
  });

  test('tema Saudabilidade altera o conjunto exibido', async ({ page }) => {
    await page.goto('/index.html#signals');
    const before = await page.locator('#pulse-intelligence-signals .pulse-intel-card').allTextContents();

    await selectFilter(page, 'signals', 'theme', 'saudabilidade');
    const after = await page.locator('#pulse-intelligence-signals .pulse-intel-card').allTextContents();

    expect(after.length).toBeGreaterThan(0);
    expect(after.join(' ')).not.toBe(before.join(' '));
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Saudabilidade');
  });

  test('combinação categoria + tema + período preserva resultado coerente', async ({ page }) => {
    await page.goto('/index.html#signals');
    await selectFilter(page, 'signals', 'category', 'bebidas');
    await selectFilter(page, 'signals', 'theme', 'saudabilidade');
    await selectFilter(page, 'signals', 'period', '2026');

    await expect(page.locator('#pulse-intelligence-signals')).toContainText('Zero açúcar');
    await expect(page.locator('#pulse-intelligence-signals')).toContainText('2026');
    expect(await intelligenceCards(page, 'signals')).toBeGreaterThan(0);
  });

  test('canal altera o resultado e não apenas o contador', async ({ page }) => {
    await page.goto('/index.html#signals');
    await selectFilter(page, 'signals', 'category', 'bebidas');
    await selectFilter(page, 'signals', 'channel', 'foodservice');

    const text = (await page.locator('#pulse-intelligence-signals').innerText()).toLowerCase();
    expect(text).toContain('fora do lar');
    expect(await intelligenceCards(page, 'signals')).toBeGreaterThan(0);
  });

  test('sem resultado apresenta saída clara e reset funcional', async ({ page }) => {
    await page.goto('/index.html#signals');
    await selectFilter(page, 'signals', 'category', 'bebidas');
    await selectFilter(page, 'signals', 'theme', 'premium');
    await selectFilter(page, 'signals', 'period', '2026');
    await selectFilter(page, 'signals', 'channel', 'atacarejo');

    await expect(page.locator('#pulse-intelligence-signals .pulse-intel-empty')).toBeVisible();
    await page.locator('#pulse-intelligence-signals [data-intel-reset]').click();
    await expect(page.locator('#pulse-intelligence-signals .pulse-intel-card')).toHaveCount(6);
  });

  test('categoria persiste ao navegar entre as cinco etapas', async ({ page }) => {
    await page.goto('/index.html#signals');
    await selectFilter(page, 'signals', 'category', 'chocolates');
    await page.locator('a[href="#diagnostic"]').first().click();
    await expect(page.locator('body')).toHaveAttribute('data-pulse-category', 'chocolates');

    await page.locator('a[href="#opportunities"]').first().click();
    await expect(page.locator('body')).toHaveAttribute('data-pulse-category', 'chocolates');
  });
});
