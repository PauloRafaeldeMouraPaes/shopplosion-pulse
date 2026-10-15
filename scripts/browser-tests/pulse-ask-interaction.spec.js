const { test, expect } = require('@playwright/test');

test.describe('Ask AI interaction contract', () => {
  test('Buscar evidências públicas no shell visível executa e retorna evidências reais', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pv3-scope-select')).toBeVisible();
    await page.selectOption('#pv3-scope-select', 'public');
    const input=page.locator('.pv4-real-input');
    await expect(input).toBeVisible();
    await input.fill('Chocolate e shopper na Páscoa');
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
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('O que as evidências qualificadas de chocolate indicam sobre preço e shopper na Páscoa?');
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
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
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
          answer_source: 'deterministic_fallback',
          provider_message: 'A quota ou o limite de uso do Gemini foi atingido.',
          knowledge_update: { classification: 'insufficient', reason: 'fallback determinístico' },
          citations: [{ ref: 'E1', document: 'Kantar · chocolate · 2025-T1' }]
        })
      });
    });
    await page.addInitScript(()=>{window.__PULSE_ASK_ACCESS_TOKEN='test-industry-token'});
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
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

  test('Sem evidência relevante, identifica a resposta determinística e não simula geração por IA', async ({ page }) => {
    await page.route('**/functions/v1/pulse-ask-ai', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Não encontrei evidências relevantes no mercado publicado para esta pergunta.',
          citations: [],
          scope: 'universe',
          fallback: true,
          answer_source: 'deterministic_no_evidence',
          fallback_reason: 'no_relevant_evidence'
        })
      });
    });
    await page.addInitScript(()=>{window.__PULSE_ASK_ACCESS_TOKEN='test-industry-token'});
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('Quais sinais de chocolate merecem investigação?');
    const actions=page.locator('.pv4-real-actions button');
    await actions.nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await page.locator('#results input[data-evidence-key]').first().evaluate(el=>el.click());
    await actions.nth(1).click();
    await expect(page.locator('#pv4-response')).toContainText('Não encontrei evidências relevantes');
    await expect(page.locator('#pv4-shell-status')).toContainText('Nenhuma evidência relevante foi encontrada');
    await expect(page.locator('#pv4-shell-status')).toContainText('IA não foi acionada');
    await expect(page.locator('#pv4-shell-status')).not.toContainText('Resposta gerada pela IA');
  });

  test('Chocolate recupera sinais de 2026 com natureza e limites distintos', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    await page.locator('.pv4-real-input').fill('intenção de compra chocolate Páscoa 2026 preço ovos barra Locomotiva');
    await page.locator('.pv4-real-actions button').nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    const audit=await page.evaluate(()=>({
      ids:(window.__pulsePublicMatches||[]).map(x=>x.e?.id),
      text:document.getElementById('results')?.textContent||''
    }));
    expect(audit.ids).toContain('locomotiva-pascoa-2026-intencao-drivers');
    expect(audit.ids).toContain('rico-preco-chocolate-barra-bombom-out-2026');
    expect(audit.text).toContain('INDIRETO para marca do piloto no Brasil');
    expect(audit.text).toContain('CONTEXTUAL para comportamento do shopper');
    expect(audit.text).toContain('não mede comportamento de compra');
  });

  test('Busca de chocolate recupera evidências específicas com alcance e natureza declarados', async ({ page }) => {
    await page.goto('/ask.html?v=20260922.17', { waitUntil: 'domcontentloaded' });
    await page.selectOption('#pv3-scope-select', 'public');
    const input=page.locator('.pv4-real-input');
    await input.fill('mudanças emergentes no shopper de chocolate');
    await page.locator('.pv4-real-actions button').nth(0).click();
    await expect.poll(async()=>page.locator('#results .result').count()).toBeGreaterThan(0);
    await expect(page.locator('#results')).toContainText('Kantar');
    await expect(page.locator('#results')).toContainText('Alcance para a pergunta');
    await expect(page.locator('#results')).toContainText('INDIRETO para marca do piloto no Brasil');
    await expect(page.locator('#results')).toContainText('Não comprova motivo individual');
    await expect(page.locator('#results')).toContainText('Família de fonte: Kantar / Worldpanel');
    await expect(page.locator('#results')).toContainText('Família igual não equivale a confirmação independente');
    const familyAudit = await page.locator('#results').textContent();
    expect((familyAudit.match(/Família de fonte: Kantar \/ Worldpanel/g)||[]).length).toBeGreaterThanOrEqual(2);
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
    const qualificationAudit=await page.evaluate(()=>{
      const required=['natureza','universo_observado','representa','nao_representa','fonte_primaria','fato_verificado_na_fonte','alcance_para_pergunta'];
      const valid=e=>required.every(field=>String(e?.[field]??'').trim()&&!String(e[field]).includes('[A DEFINIR]'))&&/^SIM\\b/i.test(String(e?.fato_verificado_na_fonte??'').trim());
      return {
        matches:(window.__pulsePublicMatches||[]).length,
        invalidMatches:(window.__pulsePublicMatches||[]).filter(x=>!valid(x.e)).map(x=>x.e?.id),
        invalidAnswerEvidence:(window.__pulsePublicEvidenceForAnswer||[]).filter(e=>!valid(e)).map(e=>e.id),
        quarantinedIds:(window.__pulsePublicMatches||[]).filter(x=>String(x.e?.id||'').startsWith('ibge-ipca-')).map(x=>x.e.id)
      };
    });
    expect(qualificationAudit.matches).toBeGreaterThan(0);
    expect(qualificationAudit.invalidMatches).toEqual([]);
    expect(qualificationAudit.invalidAnswerEvidence).toEqual([]);
    expect(qualificationAudit.quarantinedIds).toEqual([]);
  });


  test('O conjunto público do Pulse só expõe evidências com proveniência qualificada', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const audit = await page.evaluate(() => {
      const required = ['natureza','universo_observado','representa','nao_representa','fonte_primaria','fato_verificado_na_fonte','alcance_para_pergunta'];
      const items = Array.isArray(window.PULSE_EVIDENCE) ? window.PULSE_EVIDENCE : [];
      return {
        count: items.length,
        invalid: items.filter(item => !required.every(field =>
          typeof item[field] === 'string' &&
          item[field].trim() &&
          !item[field].toUpperCase().includes('[A DEFINIR]')
        ) || !String(item.fato_verificado_na_fonte || '').trim().toUpperCase().startsWith('SIM')).map(item => item.id),
        ids: items.map(item => item.id)
      };
    });
    expect(audit.count).toBeGreaterThan(0);
    expect(audit.invalid).toEqual([]);
    expect(audit.ids).toContain('kantar-chocolate-brasil-volume-q1-2025');
    expect(audit.ids).toContain('locomotiva-pascoa-2026-intencao-drivers');
    expect(audit.ids).not.toContain('ibge-ipca-alimentos-2026-01');
  });

});
