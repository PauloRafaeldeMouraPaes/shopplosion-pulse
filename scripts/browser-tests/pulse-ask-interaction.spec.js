const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências públicas no shell visível executa e retorna evidências reais', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.14', { waitUntil: 'domcontentloaded' });
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

  test('Gerar resposta pública funciona sem sessão privada', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.14', { waitUntil: 'domcontentloaded' });
    await page.route('**/functions/v1/pulse-ask-ai', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'LEITURA: Os sinais públicos recuperados permitem descrever o movimento observado. [E1]',
          structured: { leitura: 'Os sinais públicos recuperados permitem descrever o movimento observado.', hipotese: 'Hipótese a validar com evidência adicional.', recomendacao: 'Cruzar com outra evidência pública.', desconhecidos: 'O mecanismo comportamental ainda não pode ser afirmado.' },
          knowledge_update: { classification: 'insufficient', reason: 'Não havia conhecimento anterior.' },
          citations: [{ ref: 'E1', document: 'Mercado publicado · idv-julho-2026', chunk: 1 }]
        })
      });
    });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('O que os sinais recentes de Alimentação e Bebidas indicam sobre preço e vendas?');
    await page.locator('.pv4-real-actions button').nth(1).click();
    await expect(page.locator('#answerPanel')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#answer')).not.toHaveText('Resposta vazia.');
  });
});
