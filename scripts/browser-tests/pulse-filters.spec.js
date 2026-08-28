const { test, expect } = require('@playwright/test');

async function openFilters(page) {
  const scope = page.locator('[data-filter-scope="signals"]');
  const details = scope.locator('xpath=ancestor::details[1]');
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
  return scope;
}

test('filtros: categoria Bebidas mostra somente evidências de bebidas', async ({ page }) => {
  await page.goto('/index.html#signals');
  const category = page.locator('#pulse-category-select');
  await category.selectOption('bebidas');
  await expect(page.locator('#signals .row[data-pulse-category="bebidas"]:visible')).toHaveCount(4);
  await expect(page.locator('#signals [data-evidence-id="bebidas-nao-alcoolicas"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="cerveja-ocasioes"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="promocao"]')).toBeHidden();
});

test('filtros: tema Saudabilidade altera o conjunto exibido', async ({ page }) => {
  await page.goto('/index.html#signals');
  await page.locator('#pulse-category-select').selectOption('bebidas');
  const scope = await openFilters(page);
  const theme = scope.locator('[data-filter="theme"]');
  await expect(theme.locator('option[value="saudabilidade"]')).toHaveCount(1);
  await theme.selectOption('saudabilidade');
  await expect(page.locator('#signals .row:visible')).toHaveCount(2);
  await expect(page.locator('#signals [data-evidence-id="bebidas-nao-alcoolicas"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="bebidas-zero"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="cerveja-ocasioes"]')).toBeHidden();
});

test('filtros: combinação de categoria e período é respeitada', async ({ page }) => {
  await page.goto('/index.html#signals');
  await page.locator('#pulse-category-select').selectOption('bebidas');
  const scope = await openFilters(page);
  await scope.locator('[data-filter="period"]').selectOption('2026');
  await expect(page.locator('#signals .row:visible')).toHaveCount(2);
  await expect(page.locator('#signals [data-evidence-id="bebidas-nao-alcoolicas"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="bebidas-zero"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="cerveja-ocasioes"]')).toBeHidden();
});

test('filtros: retornar a Todas as categorias restaura a visão completa', async ({ page }) => {
  await page.goto('/index.html#signals');
  const category = page.locator('#pulse-category-select');
  await category.selectOption('bebidas');
  await category.selectOption('all');
  await expect(page.locator('#signals .row:visible')).toHaveCount(10);
  await expect(page.locator('#signals [data-evidence-id="promocao"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="bebidas-nao-alcoolicas"]')).toBeVisible();
});
