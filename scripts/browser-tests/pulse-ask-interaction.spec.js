const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências públicas executa e retorna evidências reais', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.10', { waitUntil: 'domcontentloaded' });
    await page.locator('.pv4-real-input').fill('Alimentação e bebidas');
    const actions=page.locator('.pv4-real-actions button');
    await expect(actions).toHaveCount(2);
    await actions.nth(0).click();
    await expect(page.locator('#message')).toHaveClass(/show/);
    await expect(page.locator('#message')).toContainText('Evidências públicas recuperadas');
    await expect(page.locator('#resultTitle')).toContainText('evidência');
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
  });

  test('Busca com pergunta inválida produz feedback visível', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.10', { waitUntil: 'domcontentloaded' });
    await page.locator('#query').fill('');
    const actions=page.locator('.pv4-real-actions button');
    await actions.nth(0).click();
    await expect(page.locator('#message')).toHaveClass(/show/);
    await expect(page.locator('#message')).toContainText('Digite uma pergunta válida');
  });
});
