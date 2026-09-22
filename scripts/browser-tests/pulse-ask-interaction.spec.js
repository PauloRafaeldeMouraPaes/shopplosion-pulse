const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências never becomes a no-op before authentication', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.04', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#search')).toHaveCount(1);
    await page.locator('#search').click();
    await expect(page.locator('#message')).toHaveClass(/show/);
    await expect(page.locator('#message')).not.toHaveText('');
  });

  test('Gerar resposta never becomes a no-op before authentication', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.04', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#generate')).toHaveCount(1);
    await page.locator('#generate').click();
    await expect(page.locator('#message')).toHaveClass(/show/);
    await expect(page.locator('#message')).not.toHaveText('');
  });
});
