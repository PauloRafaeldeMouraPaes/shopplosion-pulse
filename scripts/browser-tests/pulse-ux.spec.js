const { test, expect } = require('@playwright/test');

async function openFilters(page, scopeName) {
  const scope = page.locator(`[data-filter-scope="${scopeName}"]`);
  const details = scope.locator('xpath=ancestor::details[1]');
  if (await details.count()) {
    const open = await details.getAttribute('open');
    if (open === null) await details.locator('summary').click();
  }
  return scope;
}

async function clickReset(page, scopeName) {
  const button = page.locator(`[data-filter-reset="${scopeName}"]`);
  await button.scrollIntoViewIfNeeded();
  await button.click({ force: true });
}

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

test('filtros de sinais: tema, canal e período alteram efetivamente os cards', async ({ page }) => {
  await page.goto('/index.html#signals');
  const scope = await openFilters(page, 'signals');
  const theme = scope.locator('[data-filter="theme"]');
  const channel = scope.locator('[data-filter="channel"]');
  const period = scope.locator('[data-filter="period"]');
  await expect(page.locator('#signals .row:visible')).toHaveCount(4);
  await theme.selectOption('promocao');
  await expect(page.locator('#signals .row:visible')).toHaveCount(1);
  await expect(page.locator('#signals [data-evidence-id="promocao"]')).toBeVisible();
  await theme.selectOption('all');
  await channel.selectOption('varejo');
  await expect(page.locator('#signals .row:visible')).toHaveCount(1);
  await expect(page.locator('#signals [data-evidence-id="varejo-geral"]')).toBeVisible();
  await channel.selectOption('all');
  await period.selectOption('2026');
  await expect(page.locator('#signals .row:visible')).toHaveCount(1);
  await expect(page.locator('#signals [data-evidence-id="varejo-geral"]')).toBeVisible();
  await clickReset(page, 'signals');
  await expect(page.locator('#signals .row:visible')).toHaveCount(4);
  await expect(page.locator('[data-filter-summary="signals"]')).toHaveText('4 sinais exibidos');
});

test('filtros de oportunidades: categoria e canal funcionam e podem ser limpos', async ({ page }) => {
  await page.goto('/index.html#opportunities');
  const scope = await openFilters(page, 'opportunities');
  const theme = scope.locator('[data-filter="theme"]');
  const channel = scope.locator('[data-filter="channel"]');
  await expect(page.locator('#opportunities .opp .box:visible')).toHaveCount(4);
  await theme.selectOption('premium');
  await expect(page.locator('#opportunities .opp .box:visible')).toHaveCount(1);
  await expect(page.locator('#opportunities [data-evidence-id="premium"]')).toBeVisible();
  await theme.selectOption('all');
  await channel.selectOption('varejo');
  await expect(page.locator('#opportunities .opp .box:visible')).toHaveCount(2);
  await clickReset(page, 'opportunities');
  await expect(page.locator('#opportunities .opp .box:visible')).toHaveCount(4);
});

test('mobile: minha categoria permanece visível e utilizável', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html#overview');
  const select = page.locator('#pulse-category-select');
  await expect(select).toBeVisible();
  await select.selectOption('bebidas');
  await expect(select).toHaveValue('bebidas');
  await expect(page.locator('#pulse-category-context')).toBeVisible();
  await page.locator('aside .nav[href="#signals"]').click();
  await select.selectOption('all');
  const scope = await openFilters(page, 'signals');
  const theme = scope.locator('[data-filter="theme"]');
  await theme.selectOption('promocao');
  await expect(page.locator('#signals .row:visible')).toHaveCount(1);
});
