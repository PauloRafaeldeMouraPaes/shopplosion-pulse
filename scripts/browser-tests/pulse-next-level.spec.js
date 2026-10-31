const { test, expect } = require('@playwright/test');
test.describe('Pulse next-level contracts — proposal workspace', () => {
  test('single-file workspace expõe registries públicos e estado local', async ({ page }) => {
    await page.goto('/index.html#overview');
    const state=await page.evaluate(()=>({evidence:Array.isArray(window.PULSE_EVIDENCE),sources:Array.isArray(window.PULSE_SOURCES),local:Array.isArray(window.PULSE_LOCAL_EVIDENCE),next:!!window.PULSE_NEXT_LEVEL,single:!!window.PULSE_SINGLE_FILE_READY}));
    expect(state).toEqual({evidence:true,sources:true,local:true,next:true,single:true});
  });
  test('evidência abre Inspector com proveniência estrutural e ações', async ({page})=>{
    await page.goto('/index.html#overview');
    const first=page.locator('.pv4-evidence[data-evidence-id]').first();
    const id=await first.getAttribute('data-evidence-id');
    const expected=await page.evaluate(id=>(window.PULSE_EVIDENCE||[]).find(x=>String(x.id)===String(id)),id);
    await first.getByRole('button',{name:'Ver evidência'}).click();
    const ins=page.locator('#pv3-inspector');
    await expect(ins).toContainText(expected.fonte);await expect(ins).toContainText(expected.periodo);const meta=await page.evaluate(id=>window.PULSE_EVIDENCE_MODEL.assess((window.PULSE_EVIDENCE||[]).find(x=>String(x.id)===String(id)),''),id);await expect(ins).toContainText(meta.natureza);await expect(ins).toContainText(meta.alcance_para_pergunta);await expect(ins).toContainText(meta.fato_verificado_na_fonte);
    await expect(ins.getByRole('button',{name:'Perguntar'})).toBeVisible();await expect(ins.getByRole('button',{name:'Guardar'})).toBeVisible();await expect(ins.getByRole('button',{name:'Usar na análise'})).toBeVisible();
  });
  test('séries históricas exigem proveniência e só comparam métrica/geografia iguais', async ({page})=>{
    await page.goto('/index.html#overview');
    const result=await page.evaluate(()=>{
      const api=window.PULSE_NEXT_LEVEL;
      const rejected=api.addHistoricalObservation({period:'2026-01',value:10,metric:'volume'});
      const a=api.addHistoricalObservation({period:'2026-01',value:10,metric:'volume',geography:'BR',source:'fixture',provenance:'synthetic browser test'});
      const duplicate=api.addHistoricalObservation({period:'2026-01',value:10,metric:'volume',geography:'BR',source:'fixture',provenance:'synthetic browser test'});
      const b=api.addHistoricalObservation({period:'2026-02',value:12,metric:'volume',geography:'BR',source:'fixture',provenance:'synthetic browser test'});
      return {rejected:rejected.status,added:a.status,duplicate:duplicate.status,second:b.status,summary:api.historicalSummary('volume','BR')};
    });
    expect(result.rejected).toBe('rejected');expect(result.added).toBe('added');expect(result.duplicate).toBe('duplicate');expect(result.second).toBe('added');
    expect(result.summary.status).toBe('observed_change');expect(result.summary.delta).toBe(2);expect(result.summary.causal).toBe(false);
  });
  test('papel ideal permanece heurístico e evidência local exige proveniência', async ({page})=>{
    await page.goto('/index.html#overview');
    const result=await page.evaluate(()=>{
      const api=window.PULSE_NEXT_LEVEL;
      const role=api.setCategoryRole('categoria-teste','hipótese de teste',[{id:'synthetic'}]);
      const rejected=api.addLocalEvidence({claim:'teste'});
      const added=api.addLocalEvidence({id:'test-local-evidence',claim:'registro sintético de teste',source:'fixture',geography:'BR',date:'2026-10-17',provenance:'synthetic browser test'});
      const summary=api.executiveSummary([{type:'observed',text:'observação de teste'},{type:'hypothesis',text:'hipótese de teste'}]);
      return {role:role.item,rejected:rejected.status,added:added.status,summary};
    });
    expect(result.role.status).toBe('heuristic');expect(result.role.provenance).toContain('não é fato');
    expect(result.rejected).toBe('rejected');expect(result.added).toBe('added');
    expect(result.summary.status).toBe('available');expect(result.summary.causal).toBe(false);
    expect(result.summary.observed).toEqual(['observação de teste']);expect(result.summary.hypotheses).toEqual(['hipótese de teste']);
  });
  test('Base e Análises continuam destinos distintos', async ({page})=>{
    await page.goto('/index.html#overview');
    const links=await page.locator('.pv4-rail nav a').evaluateAll(as=>as.map(a=>({name:a.dataset.nav,href:a.getAttribute('href')})));
    expect(links.find(x=>x.name==='base').href).toContain('#documents');expect(links.find(x=>x.name==='analises').href).toContain('#analyses');expect(links.find(x=>x.name==='investigacao').href).toContain('ask.html');
  });
});
test.describe('Pulse next-level contracts — painel Hoje', () => {
  const clearStore = async page => { await page.goto('/index.html'); await page.evaluate(() => { try { localStorage.removeItem('pulse:next-level:v1'); } catch (_) {} }); await page.reload(); };
  test('painel existe na Hoje, mostra estado sem dados e não altera IDs existentes', async ({ page }) => {
    await clearStore(page);
    const section = page.locator('#pv4-next-level');
    await expect(section).toBeVisible();
    await expect(page.locator('#signals')).toBeVisible();
    await expect(section.locator('[data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    await expect(section.locator('[data-view="role"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    await expect(section.locator('[data-view="local"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    await expect(section.locator('[data-view="series"]')).toContainText('não conectada');
    await expect(section).toHaveAttribute('data-restore', 'empty');
    await expect(page.locator('#pv4-nl-status')).toContainText('0 observações');
  });
  test('registro rejeitado, insuficiente, sem comparabilidade e disponível aparecem como estados', async ({ page }) => {
    await clearStore(page);
    const section = page.locator('#pv4-next-level');
    await section.locator('#pv4-nl-series details.pv4-nl-form summary').click();
    await page.fill('#pv4-nl-period', '2026-01');
    await page.fill('#pv4-nl-value', '10');
    await page.locator('#pv4-nl-series-form button[type="submit"]').click();
    await expect(page.locator('#pv4-nl-series-feedback')).toHaveAttribute('data-status', 'rejected');
    await expect(page.locator('#pv4-nl-series-feedback')).toContainText('incompleto');
    await expect(section.locator('[data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    const fill = async (period, value, unit) => {
      await page.fill('#pv4-nl-period', period); await page.fill('#pv4-nl-value', value); await page.fill('#pv4-nl-unit', unit);
      await page.fill('#pv4-nl-metric', 'volume'); await page.fill('#pv4-nl-geography', 'BR'); await page.fill('#pv4-nl-source', 'fixture'); await page.fill('#pv4-nl-provenance', 'synthetic browser test');
      await page.locator('#pv4-nl-series-form button[type="submit"]').click();
    };
    await fill('2026-01', '10', 'u');
    await expect(page.locator('#pv4-nl-series-feedback')).toHaveAttribute('data-status', 'added');
    await expect(section.locator('[data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'insufficient');
    await fill('2026-02', '12', 'outra-unidade');
    await expect(section.locator('[data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'not_comparable');
    await fill('2026-02', '12', 'u');
    await expect(section.locator('[data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'available');
    await expect(section.locator('[data-view="series"]')).toContainText('Variação observada');
    await expect(section.locator('[data-view="series"]')).toContainText('Causalidade: não atribuída');
    await fill('2026-02', '99', 'u');
    await expect(page.locator('#pv4-nl-series-feedback')).toHaveAttribute('data-status', 'conflict');
    await page.reload();
    await expect(page.locator('#pv4-next-level')).toHaveAttribute('data-restore', 'restored');
    await expect(page.locator('#pv4-next-level [data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'available');
  });
  test('registro local corrompido vira erro de origem explícito', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => { localStorage.setItem('pulse:next-level:v1', '{corrupted'); });
    await page.reload();
    await expect(page.locator('#pv4-next-level')).toHaveAttribute('data-restore', 'source_error');
    await expect(page.locator('#pv4-next-level [data-view="series"] .pv4-nl-state').first()).toHaveAttribute('data-state', 'source_error');
    await page.evaluate(() => { localStorage.removeItem('pulse:next-level:v1'); });
  });
  test('evidência local válida abre no Inspector com o mesmo vocabulário da base', async ({ page }) => {
    await clearStore(page);
    const section = page.locator('#pv4-next-level');
    await section.locator('#pv4-nl-local details.pv4-nl-form summary').click();
    await page.fill('#pv4-nl-local-claim', 'registro sintético de teste');
    await page.locator('#pv4-nl-local-form button[type="submit"]').click();
    await expect(page.locator('#pv4-nl-local-feedback')).toContainText('incompleto');
    await page.fill('#pv4-nl-local-claim', 'registro sintético de teste');
    await page.fill('#pv4-nl-local-source', 'fixture'); await page.fill('#pv4-nl-local-geography', 'BR');
    await page.fill('#pv4-nl-local-date', '2026-10-31'); await page.fill('#pv4-nl-local-provenance', 'synthetic browser test');
    await page.locator('#pv4-nl-local-form button[type="submit"]').click();
    await expect(page.locator('#pv4-nl-local-feedback')).toHaveAttribute('data-status', 'added');
    await section.locator('.pv4-nl-open').first().click();
    const ins = page.locator('#pv3-inspector');
    await expect(ins).toBeVisible();
    await expect(ins).toContainText('registro sintético de teste');
    await expect(ins).toContainText('FONTE PRIMÁRIA');
    await expect(ins).toContainText('synthetic browser test');
    await page.evaluate(() => { localStorage.removeItem('pulse:next-level:v1'); });
  });
  test('papel da categoria aparece como heurística com limitação registrada', async ({ page }) => {
    await clearStore(page);
    const section = page.locator('#pv4-next-level');
    await section.locator('#pv4-nl-role details.pv4-nl-form summary').click();
    await page.fill('#pv4-nl-role-category', 'categoria-teste');
    await page.fill('#pv4-nl-role-role', 'hipótese de teste');
    await page.fill('#pv4-nl-role-limitation', 'limitação de teste');
    await page.locator('#pv4-nl-role-form button[type="submit"]').click();
    const state = section.locator('[data-view="role"] .pv4-nl-state');
    await expect(state).toHaveAttribute('data-state', 'heuristic');
    await expect(state).toContainText('Heurística');
    await expect(section.locator('[data-view="role"]')).toContainText('limitação de teste');
    await expect(section.locator('[data-view="role"]')).toContainText('Nenhuma evidência registrada');
    await page.evaluate(() => { localStorage.removeItem('pulse:next-level:v1'); });
  });
});
