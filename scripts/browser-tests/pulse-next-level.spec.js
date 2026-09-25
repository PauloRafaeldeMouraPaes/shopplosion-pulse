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
  test('Base e Análises continuam destinos distintos', async ({page})=>{
    await page.goto('/index.html#overview');
    const links=await page.locator('.pv4-rail nav a').evaluateAll(as=>as.map(a=>({name:a.dataset.nav,href:a.getAttribute('href')})));
    expect(links.find(x=>x.name==='base').href).toContain('#documents');expect(links.find(x=>x.name==='analises').href).toContain('#analyses');expect(links.find(x=>x.name==='investigacao').href).toContain('ask.html');
  });
});