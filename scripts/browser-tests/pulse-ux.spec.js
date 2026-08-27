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

test('categoria: filtra sinais e oportunidades e preserva contexto transversal', async ({ page }) => {
  await page.goto('/index.html#signals');

  const select = page.locator('#pulse-category-select');
  await expect(select).toHaveValue('all');

  await select.selectOption('chocolates');
  await expect(page.locator('#signals [data-evidence-id="premium"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="canal"]')).toBeHidden();

  await select.selectOption('bebidas');
  await expect(page.locator('#signals [data-evidence-id="ocasiao"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="premium"]')).toBeHidden();

  await select.selectOption('all');
  await expect(page.locator('#signals [data-evidence-id="canal"]')).toBeVisible();
  await expect(page.locator('#signals [data-evidence-id="premium"]')).toBeVisible();
});
