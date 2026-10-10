const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências públicas no shell visível executa e retorna evidências reais', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.16', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pv3-scope-select')).toBeVisible();
    await page.selectOption('#pv3-scope-select', 'public');
    const input=page.locator('.pv4-real-input');
    await expect(input).toBeVisible();
    await input.fill('Alimentação e bebidas');
    const actions=page.locator('.pv4-real-actions button');
    await expect(actions).toHaveCount(2);
    await actions.nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await expect(page.locator('#pv4-shell-status')).toContainText('Evidências públicas recuperadas');
  });

  test('Gerar resposta pública funciona sem sessão privada', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.16', { waitUntil: 'domcontentloaded' });
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
    const actions=page.locator('.pv4-real-actions button');
    await actions.nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await page.locator('#results input[data-evidence-key]').first().evaluate(el=>el.click());
    await actions.nth(1).click();
    await expect(page.locator('#pv4-response')).toBeVisible();
    await expect(page.locator('#pv4-response')).not.toHaveText('Aguardando uma pergunta.');
    await expect(page.locator('#pv4-shell-status')).not.toHaveText('');
  });

  test('Busca de chocolate recupera evidências específicas com alcance e natureza declarados', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.16', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    const input=page.locator('.pv4-real-input');
    await input.fill('mudanças emergentes no shopper de chocolate');
    await page.locator('.pv4-real-actions button').nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await expect(page.locator('#results')).toContainText('Kantar');
    await expect(page.locator('#results')).toContainText('Alcance para a pergunta');
    await expect(page.locator('#results')).toContainText('INDIRETO para Lindt Brasil');
    await expect(page.locator('#results')).toContainText('Não comprova motivo individual');
    const audit=await page.evaluate(()=>({
      ids:(window.__pulsePublicMatches||[]).map(x=>x.e?.id),
      count:(window.__pulsePublicMatches||[]).length,
      metadata:(window.__pulsePublicMatches||[]).filter(x=>String(x.e?.id||'').includes('chocolate')).map(x=>({
        natureza:x.e?.natureza,
        alcance:x.e?.alcance_para_pergunta,
        fonte:x.e?.fonte,
        periodo:x.e?.periodo
      }))
    }));
    expect(audit.ids.some(id=>id==='kantar-chocolate-brasil-volume-q1-2025')).toBeTruthy();
    expect(audit.metadata.some(x=>x.natureza && x.natureza!=='[A DEFINIR]' && x.alcance && x.alcance!=='[A DEFINIR]')).toBeTruthy();
  });

});
