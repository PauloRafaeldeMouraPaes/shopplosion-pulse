const { test, expect } = require('@playwright/test');

test.describe('Pulse proposal fidelity', () => {
  test('desktop workspace exposes the five proposal destinations, scope and evidence inspector', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html?v=20260920.02');
    await expect(page.locator('.pv4-rail nav a[data-nav]')).toHaveCount(5);
    await expect(page.locator('.pv4-scope')).toContainText('Brasil · CPG');
    await expect(page.locator('.pv4-canvas')).toBeVisible();
    const card = page.locator('.pv4-evidence[data-evidence-id]').first();
    await card.locator('.pv4-inspect').click();
    const inspector = page.locator('#pv4-inspector');
    await expect(inspector).toHaveClass(/open/);
    await expect(inspector).toContainText('FATO');
    await expect(inspector).toContainText('ORIGEM');
    await expect(inspector).toContainText('HIPÓTESE');
    await expect(inspector.getByRole('button', { name: 'Perguntar' })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Guardar' })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Usar na análise' })).toBeVisible();
  });

  test('mobile proposal keeps only daily destinations in bottom navigation and exposes scope destinations separately', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html?v=20260920.02');
    await expect(page.locator('.pv4-rail nav a[data-nav="hoje"]')).toBeVisible();
    await expect(page.locator('.pv4-rail nav a[data-nav="base"]')).toBeVisible();
    await expect(page.locator('.pv4-rail nav a[data-nav="investigacao"]')).toBeVisible();
    await expect(page.locator('.pv4-rail nav a[data-nav="universo"]')).toBeHidden();
    await expect(page.locator('.pv4-rail nav a[data-nav="analises"]')).toBeHidden();
    await expect(page.locator('.pv4-mobile-scope a')).toHaveCount(2);
    await expect(page.locator('.pv4-story')).toBeVisible();
  });

  test('Investigação exposes fixed scope, explicit context and three-step progress', async ({ page }) => {
    await page.goto('/ask.html?v=20260920.02');
    await expect(page.locator('.pv4-ask-context')).toContainText('Minha indústria · Base privada');
    await expect(page.locator('.pv4-progress')).toContainText('01 Recuperar');
    await expect(page.locator('.pv4-progress')).toContainText('02 Ler');
    await expect(page.locator('.pv4-progress')).toContainText('03 Escrever');
  });
});
