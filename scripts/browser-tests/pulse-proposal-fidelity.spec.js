const { test, expect } = require('@playwright/test');

test.describe('Pulse proposal fidelity', () => {
  test('Workspace V3 exposes persistent scope, five destinations and evidence actions', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#pv3-scope')).toBeVisible();
    await expect(page.locator('.pv3-shell-nav a[data-nav]')).toHaveCount(5);
    await page.locator('#pv3-signals .pv3-item[data-evidence-id]').first().getByRole('button', { name: 'Ver evidência' }).click();
    const inspector = page.locator('#pv3-inspector');
    await expect(inspector).toHaveClass(/open/);
    await expect(inspector.getByRole('button', { name: 'Perguntar' })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Guardar' })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Usar na análise' })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(inspector).not.toHaveClass(/open/);
  });

  test('mobile shell exposes the two scope destinations and the three daily destinations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const scope = page.locator('.pv3-scope-header');
    await expect(scope.locator('a[data-nav="universo"]')).toBeVisible();
    await expect(scope.locator('a[data-nav="analises"]')).toBeVisible();
    await expect(page.locator('.pv3-shell-nav a[data-nav="hoje"]')).toBeVisible();
    await expect(page.locator('.pv3-shell-nav a[data-nav="base"]')).toBeVisible();
    await expect(page.locator('.pv3-shell-nav a[data-nav="investigacao"]')).toBeVisible();
    await expect(page.locator('.pv3-shell-nav a[data-nav="universo"]')).toHaveCount(0);
    await expect(page.locator('.pv3-shell-nav a[data-nav="analises"]')).toHaveCount(0);
  });

  test('Investigação has declared scope, fixed-context surface and legible response progress', async ({ page }) => {
    await page.goto('/ask.html?evidence=confianca-financeira');
    await expect(page.locator('#askScope')).toBeVisible();
    await expect(page.locator('#askContext')).toContainText('confianca-financeira');
    await expect(page.locator('#askProgress')).toBeVisible();
    await expect(page.locator('.askStep[data-step="retrieve"]')).toBeVisible();
    await expect(page.locator('.askStep[data-step="read"]')).toBeVisible();
    await expect(page.locator('.askStep[data-step="write"]')).toBeVisible();
  });
});
