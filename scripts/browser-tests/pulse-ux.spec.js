const { test, expect } = require('@playwright/test');

test('navegação: muda quadro e destaca a etapa ativa', async ({ page }) => {
  await page.goto('/index.html#overview');
  await page.locator('aside .nav[href="#signals"]').click();
  await expect(page).toHaveURL(/#signals$/);
  await expect(page.locator('#signals')).toBeVisible();
  await expect(page.locator('aside .nav[href="#signals"]')).toHaveClass(/is-active/);
  await expect(page.locator('#journey-current-step')).toHaveText('02');

  await page.locator('aside .nav[href="#diagnostic"]').click();
  await expect(page).toHaveURL(/#diagnostic$/);
  await expect(page.locator('#diagnostic')).toBeVisible();
  await expect(page.locator('aside .nav[href="#diagnostic"]')).toHaveClass(/is-active/);
  await expect(page.locator('#journey-current-step')).toHaveText('03');
});

test('categoria: filtro muda a experiência global e mantém estado visível', async ({ page }) => {
  await page.goto('/index.html#overview');
  const select = page.locator('#pulse-category-select');
  await expect(select).toBeVisible();
  await select.selectOption('bebidas');
  await expect(select).toHaveValue('bebidas');
  await expect(page.locator('#pulse-category-context')).toContainText('Bebidas');
  await expect(page.locator('body')).toHaveAttribute('data-pulse-category', 'bebidas');

  await page.locator('aside .nav[href="#signals"]').click();
  await expect(page).toHaveURL(/#signals$/);
  await expect(page.locator('#pulse-category-select')).toHaveValue('bebidas');
  await expect(page.locator('#pulse-category-context')).toContainText('Bebidas');

  await select.selectOption('chocolates');
  await expect(page.locator('#signals [data-evidence-id="premium"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="varejo-geral"]')).toBeHidden();

  await select.selectOption('bebidas');
  await expect(page.locator('#signals [data-evidence-id="premium"]')).toBeHidden();
  await expect(page.locator('#signals .pulse-category-empty')).toContainText('Bebidas');

  await select.selectOption('all');
  await expect(page.locator('#signals .pulse-category-empty')).toBeHidden();
  await expect(page.locator('#signals [data-evidence-id="varejo-geral"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="premium"]')).toBeVisible();
});
