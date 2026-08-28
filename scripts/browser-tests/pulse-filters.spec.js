const { test, expect } = require('@playwright/test');

test('filtros: categoria Bebidas mostra evidências de bebidas', async ({ page }) => {
  await page.goto('/index.html#signals');

  const category = page.locator('#pulse-category-select');
  await expect(category).toHaveCount(1);
  await category.selectOption('bebidas');

  const beverageRows = page.locator('#signals .row[data-pulse-category="bebidas"]:visible');
  await expect(beverageRows).toHaveCount(4);
  await expect(page.locator('#signals')).toContainText('Bebidas não alcoólicas ganham espaço');
  await expect(page.locator('#signals')).toContainText('Cerveja perde consumidores, mas ganha ocasiões');
  await expect(page.locator('#signals')).not.toContainText('Promoção ganhou relevância');
});

test('filtros: tema Saudabilidade altera o conjunto exibido', async ({ page }) => {
  await page.goto('/index.html#signals');
  await page.locator('#pulse-category-select').selectOption('bebidas');

  const theme = page.locator('[data-filter-scope="signals"] select[data-filter="theme"]');
  await expect(theme.locator('option[value="saudabilidade"]')).toHaveCount(1);
  await theme.selectOption('saudabilidade');

  await expect(page.locator('#signals .row:visible')).toHaveCount(2);
  await expect(page.locator('#signals')).toContainText('Bebidas não alcoólicas ganham espaço');
  await expect(page.locator('#signals')).toContainText('Zero açúcar acelera dentro das bebidas não alcoólicas');
  await expect(page.locator('#signals')).not.toContainText('Cerveja perde consumidores, mas ganha ocasiões');
});

test('filtros: combinação de categoria e período é respeitada', async ({ page }) => {
  await page.goto('/index.html#signals');
  await page.locator('#pulse-category-select').selectOption('bebidas');

  const period = page.locator('[data-filter-scope="signals"] select[data-filter="period"]');
  await period.selectOption('2026');

  await expect(page.locator('#signals .row:visible')).toHaveCount(2);
  await expect(page.locator('#signals')).toContainText('Bebidas não alcoólicas ganham espaço');
  await expect(page.locator('#signals')).toContainText('Zero açúcar acelera dentro das bebidas não alcoólicas');
});

test('filtros: retornar a Todas as categorias restaura a visão transversal', async ({ page }) => {
  await page.goto('/index.html#signals');
  const category = page.locator('#pulse-category-select');
  await category.selectOption('bebidas');
  await category.selectOption('all');

  await expect(page.locator('#signals .row:visible')).toHaveCount(10);
  await expect(page.locator('#signals')).toContainText('Promoção ganhou relevância');
  await expect(page.locator('#signals')).toContainText('Bebidas não alcoólicas ganham espaço');
});
