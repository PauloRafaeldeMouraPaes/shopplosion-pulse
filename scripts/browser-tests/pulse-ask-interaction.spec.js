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

  test('Sem sessão de indústria, mantém leitura baseada em evidências e não simula resposta de IA', async ({ page }) => {
    let aiRequests=0;
    page.on('request',request=>{
      if(request.url().includes('/functions/v1/pulse-ask-ai')) aiRequests++;
    });
    await page.goto('/ask.html?v=20260922.16', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('O que os sinais recentes de Alimentação e Bebidas indicam sobre preço e vendas?');
    const actions=page.locator('.pv4-real-actions button');
    await actions.nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await page.locator('#results input[data-evidence-key]').first().evaluate(el=>el.click());
    await actions.nth(1).click();
    await expect(page.locator('#pv4-response')).toBeVisible();
    await expect(page.locator('#pv4-response')).toContainText('LEITURA:');
    await expect(page.locator('#pv4-shell-status')).toContainText('conta vinculada a uma indústria ativa');
    expect(aiRequests).toBe(0);
  });

  test('Sessão de indústria envia bearer ao provedor e renderiza a resposta recebida', async ({ page }) => {
    let authorization='';
    await page.route('**/functions/v1/pulse-ask-ai', async route => {
      authorization=route.request().headers()['authorization']||'';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'RESPOSTA DE IA AUTENTICADA: leitura refinada com as evidências selecionadas. [E1]',
          citations: [{ ref: 'E1', document: 'Kantar · chocolate · 2025-T1' }]
        })
      });
    });
    await page.addInitScript(()=>{Object.defineProperty(window,'__PULSE_ASK_ACCESS_TOKEN',{configurable:true,get:()=> 'test-industry-token',set:()=>{}})});
    await page.goto('/ask.html?v=20260922.16', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('Quais sinais de chocolate merecem investigação?');
    const actions=page.locator('.pv4-real-actions button');
    await actions.nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await page.locator('#results input[data-evidence-key]').first().evaluate(el=>el.click());
    await actions.nth(1).click();
    await expect(page.locator('#pv4-response')).toContainText('RESPOSTA DE IA AUTENTICADA');
    expect(authorization).toBe('Bearer test-industry-token');
  });

  test('Falha do provedor explica o motivo e mantém resposta de contingência', async ({ page }) => {
    let authorization='';
    await page.route('**/functions/v1/pulse-ask-ai', async route => {
      authorization=route.request().headers()['authorization']||'';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'LEITURA: fallback baseado nas evidências recuperadas. [E1]',
          fallback: true,
          provider_message: 'A quota ou o limite de uso do Gemini foi atingido.',
          knowledge_update: { classification: 'insufficient', reason: 'fallback determinístico' },
          citations: [{ ref: 'E1', document: 'Kantar · chocolate · 2025-T1' }]
        })
      });
    });
    await page.addInitScript(()=>{window.__PULSE_ASK_ACCESS_TOKEN='test-industry-token'});
    await page.goto('/ask.html?v=20260922.16', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('Quais sinais de chocolate merecem investigação?');
    const actions=page.locator('.pv4-real-actions button');
    await actions.nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await page.locator('#results input[data-evidence-key]').first().evaluate(el=>el.click());
    await actions.nth(1).click();
    await expect(page.locator('#pv4-response')).toContainText('LEITURA: fallback baseado nas evidências recuperadas');
    await expect(page.locator('#pv4-shell-status')).toContainText('Motivo informado pelo provedor');
    await expect(page.locator('#pv4-shell-status')).toContainText('quota ou o limite de uso do Gemini');
    expect(authorization).toBe('Bearer test-industry-token');
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
