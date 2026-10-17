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