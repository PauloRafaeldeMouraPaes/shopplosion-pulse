const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Pulse next-level intelligence', () => {
  test('next-level runtime is present in the single-file artifact', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const state = await page.evaluate(() => ({history:Array.isArray(window.serie_historica),role:Array.isArray(window.papel_ideal),local:Array.isArray(window.PULSE_LOCAL_EVIDENCE),next:!!window.PULSE_NEXT_LEVEL,single:!!window.PULSE_SINGLE_FILE_READY}));
    expect(state.history).toBe(true); expect(state.role).toBe(true); expect(state.local).toBe(true); expect(state.next).toBe(true); expect(state.single).toBe(true);
  });
  test('historical comparison reports observed change without causal inference', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const result = await page.evaluate(() => window.PULSE_NEXT_LEVEL.compareSeries(120,100));
    expect(result.status).toBe('observed_change'); expect(result.delta).toBe(20); expect(result.deltaPct).toBe(20); expect(result.causal).toBe(false);
  });
  test('category role is explicitly heuristic', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const result = await page.evaluate(() => window.PULSE_NEXT_LEVEL.setCategoryRole('Bebidas','defender valor',[{id:'e1'}]));
    expect(result.category).toBe('Bebidas'); expect(result.role).toBe('defender valor'); expect(result.evidenceCount).toBe(1); expect(result.provenance).toMatch(/heurística/i);
  });
  test('local evidence upload extracts CSV and keeps provenance', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const result = await page.evaluate(async () => window.PULSE_NEXT_LEVEL.ingestLocalEvidence({name:'evidence.csv',type:'text/csv',size:31},'categoria,valor\nBebidas,123\n'));
    expect(result.ok).toBe(true); expect(result.provenance).toMatch(/local/i);
  });
  test('production auth token endpoint is reachable from Chromium', async ({ page }) => {
    await page.goto('https://paulorafaeldemouraPaes.github.io/shopplosion-pulse/auth.html?browser-test=1',{waitUntil:'domcontentloaded',timeout:30000});
    const result = await page.evaluate(async () => {
      const cfg=window.PULSE_SUPABASE_CONFIG||{}; const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10000);
      try { const response=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',mode:'cors',credentials:'omit',headers:{apikey:cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:'diagnostic-invalid@example.invalid',password:'diagnostic-invalid-password'}),cache:'no-store',signal:controller.signal}); return {status:response.status,text:(await response.text()).slice(0,300),origin:location.origin}; }
      catch(error){ return {status:0,name:error.name,message:error.message,origin:location.origin}; }
      finally{ clearTimeout(timer); }
    });
    console.log('AUTH_TRANSPORT_RESULT',JSON.stringify(result));
    expect(result.status).toBe(400);
  });
});
