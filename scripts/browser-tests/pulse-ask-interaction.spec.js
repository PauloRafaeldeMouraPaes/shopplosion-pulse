const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências públicas no shell visível executa e retorna evidências reais', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.11', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pv3-scope-select')).toBeVisible();
    await page.selectOption('#pv3-scope-select', 'public');
    const input=page.locator('.pv4-real-input');
    await expect(input).toBeVisible();
    await input.fill('Alimentação e bebidas');
    const actions=page.locator('.pv4-real-actions button');
    await expect(actions).toHaveCount(2);
    await actions.nth(0).click();
    await expect(page.locator('#pv4-shell-status')).toContainText('Evidências públicas recuperadas');
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
  });

  test('Busca pública vazia produz feedback visível no shell', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.11', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    const input=page.locator('.pv4-real-input');
    await expect(input).toBeVisible();
    await input.fill('');
    await page.locator('.pv4-real-actions button').nth(0).click();
    await expect(page.locator('#pv4-shell-status')).toContainText('Digite uma pergunta válida');
  });
});
