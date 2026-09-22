const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências visível nunca fica sem ação', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.04', { waitUntil: 'domcontentloaded' });
    const actions=page.locator('.pv4-real-actions button');
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(0)).toBeVisible();
    await actions.nth(0).click();
    await expect(page.locator('#message')).toHaveClass(/show/);
    await expect(page.locator('#message')).not.toHaveText('');
  });

  test('Gerar resposta visível nunca fica sem ação', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.04', { waitUntil: 'domcontentloaded' });
    const actions=page.locator('.pv4-real-actions button');
    await expect(actions).toHaveCount(2);
    await expect(actions.nth(1)).toBeVisible();
    await actions.nth(1).click();
    await expect(page.locator('#message')).toHaveClass(/show/);
    await expect(page.locator('#message')).not.toHaveText('');
  });
});
