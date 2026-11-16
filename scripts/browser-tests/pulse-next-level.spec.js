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
  /* Each IBGE PMC release keeps its own evidence item (scripts/update-ibge-pmc-evidence.py), so the numbers below come
     from the dataset: the latest release is the comparable group, every release's rows are loaded. */
  const publicSeries = page => page.evaluate(() => {
    const rel = (window.PULSE_EVIDENCE || []).filter(x => String(x.id).startsWith('ibge-pmc-super-') && Array.isArray(x.serie_historica));
    const latest = rel.reduce((a, b) => (a.periodo > b.periodo ? a : b));
    const [y, m] = latest.periodo.split('-');
    const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    return { total: rel.reduce((n, x) => n + x.serie_historica.length, 0), latestRows: latest.serie_historica.length,
      yearAgo: (Number(y) - 1) + '-' + m, monthName: months[Number(m) - 1] + ' de ' + y };
  });
  test('painel existe na Hoje, carrega a série da evidência pública e não altera IDs existentes', async ({ page }) => {
    await clearStore(page);
    const pub = await publicSeries(page);
    const section = page.locator('#pv4-next-level');
    await expect(section).toBeVisible();
    await expect(page.locator('#signals')).toBeVisible();
    /* The public dataset declares the IBGE PMC series (one block; 13 months per release); it is the only series. */
    const blocks = section.locator('[data-view="series"] .pv4-nl-series');
    await expect(blocks).toHaveCount(1);
    await expect(blocks.first()).toHaveAttribute('data-series-state', 'available');
    await expect(blocks.first().locator('.pv4-nl-series-head')).toContainText('PMC');
    await expect(blocks.first().locator('.pv4-nl-series-head')).toContainText('Brasil');
    await expect(blocks.first()).toContainText('Variação observada');
    await expect(blocks.first()).toContainText(`Mesmo mês do ano anterior (${pub.yearAgo})`);
    await expect(blocks.first()).toContainText(`Observações comparáveis: ${pub.latestRows}`);
    await expect(blocks.first()).toContainText('Causalidade: não atribuída');
    await expect(section).toHaveAttribute('data-from-evidence', String(pub.total));
    await expect(section).toHaveAttribute('data-restore', 'empty');
    await expect(page.locator('#pv4-nl-status')).toContainText(`${pub.total} observações`);
    await expect(section.locator('[data-view="role"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    await expect(section.locator('[data-view="local"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    /* The series block links back to its evidence item, which opens in the existing Inspector. */
    await blocks.first().locator('.pv4-nl-open-evidence').click();
    const ins = page.locator('#pv3-inspector');
    await expect(ins).toBeVisible();
    await expect(ins).toContainText(pub.monthName);
    await expect(ins).toContainText('FONTE PRIMÁRIA');
    await expect(ins).toContainText('SIDRA');
    await ins.locator('button[aria-label="Fechar"]').click();
    /* Nothing from the public series is written to the browser store: a reload rebuilds it from the dataset. */
    await page.reload();
    await expect(page.locator('#pv4-next-level')).toHaveAttribute('data-restore', 'empty');
    await expect(page.locator('#pv4-next-level')).toHaveAttribute('data-from-evidence', String(pub.total));
    /* Without any observation the block shows the explicit empty state. */
    await page.evaluate(() => { window.PULSE_NEXT_LEVEL.reset(); window.PULSE_NEXT_LEVEL_UI.refresh(); });
    await expect(section.locator('[data-view="series"] .pv4-nl-state')).toHaveAttribute('data-state', 'empty');
    await expect(section.locator('[data-view="series"]')).toContainText('não conectada');
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
    /* A rejected record adds nothing: only the public series block exists. */
    await expect(section.locator('[data-view="series"] .pv4-nl-series')).toHaveCount(1);
    const manual = section.locator('[data-view="series"] .pv4-nl-series[data-series-metric="volume"]');
    const fill = async (period, value, unit) => {
      await page.fill('#pv4-nl-period', period); await page.fill('#pv4-nl-value', value); await page.fill('#pv4-nl-unit', unit);
      await page.fill('#pv4-nl-metric', 'volume'); await page.fill('#pv4-nl-geography', 'BR'); await page.fill('#pv4-nl-source', 'fixture'); await page.fill('#pv4-nl-provenance', 'synthetic browser test');
      await page.locator('#pv4-nl-series-form button[type="submit"]').click();
    };
    await fill('2026-01', '10', 'u');
    await expect(page.locator('#pv4-nl-series-feedback')).toHaveAttribute('data-status', 'added');
    /* The manual metric gets its own block and state; the public series keeps its own. */
    await expect(section.locator('[data-view="series"] .pv4-nl-series')).toHaveCount(2);
    await expect(manual.locator('.pv4-nl-state')).toHaveAttribute('data-state', 'insufficient');
    await expect(manual).toContainText('1 observação registrada');
    await fill('2026-02', '12', 'outra-unidade');
    await expect(manual.locator('.pv4-nl-state')).toHaveAttribute('data-state', 'not_comparable');
    await fill('2026-02', '12', 'u');
    await expect(manual.locator('.pv4-nl-state')).toHaveAttribute('data-state', 'available');
    await expect(manual).toContainText('Variação observada');
    await expect(manual).toContainText('Causalidade: não atribuída');
    await expect(manual.locator('.pv4-nl-open-evidence')).toHaveCount(0);
    await expect(section.locator('[data-view="series"] .pv4-nl-series[data-series-state="available"]')).toHaveCount(2);
    await fill('2026-02', '99', 'u');
    await expect(page.locator('#pv4-nl-series-feedback')).toHaveAttribute('data-status', 'conflict');
    await page.reload();
    await expect(page.locator('#pv4-next-level')).toHaveAttribute('data-restore', 'restored');
    const restoredManual = page.locator('#pv4-next-level [data-view="series"] .pv4-nl-series[data-series-metric="volume"]');
    await expect(restoredManual.locator('.pv4-nl-state')).toHaveAttribute('data-state', 'available');
    /* Only the three manual rows were persisted; the public rows came back from the dataset. */
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse:next-level:v1')).serie_historica.length);
    expect(stored).toBe(3);
    await expect(page.locator('#pv4-nl-status')).toContainText(`${(await publicSeries(page)).total + 3} observações`);
    await page.evaluate(() => { localStorage.removeItem('pulse:next-level:v1'); });
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
  test('observação local que conflita com a série pública é mostrada, não descartada em silêncio', async ({ page }) => {
    await page.goto('/index.html');
    /* A stale local copy of a public row with a different value, as an older browser store could hold. */
    const seeded = await page.evaluate(() => {
      const row = window.serie_historica.find(x => x.evidenceId);
      const stale = Object.assign({}, row, { value: row.value + 5 }); delete stale.evidenceId; delete stale.id;
      localStorage.setItem('pulse:next-level:v1', JSON.stringify({ version: window.PULSE_NEXT_LEVEL.CONTRACT_VERSION, serie_historica: [stale], papel_ideal: [], local_evidence: [] }));
      return { period: row.period, value: row.value };
    });
    await page.reload();
    const section = page.locator('#pv4-next-level');
    await expect(section).toHaveAttribute('data-restore', 'restored');
    await expect(section).toHaveAttribute('data-not-restored', '1');
    const note = section.locator('[data-view="series"] .pv4-nl-state[data-state="conflict"]');
    await expect(note).toHaveCount(1);
    await expect(note).toContainText(seeded.period);
    await expect(note).toContainText('do dataset público');
    await expect(section.locator('[data-view="series"] .pv4-nl-series')).toHaveCount(1);
    await expect(page.locator('#pv4-nl-status')).toContainText(`${(await publicSeries(page)).total} do dataset público, 0 registradas neste navegador`);
    await page.evaluate(() => { localStorage.removeItem('pulse:next-level:v1'); });
  });
  test('a comparação interanual do bloco público declara que é cálculo sobre a série, não o número oficial', async ({ page }) => {
    await page.goto('/index.html');
    const block = page.locator('#pv4-next-level [data-view="series"] .pv4-nl-series').first();
    await expect(block).toContainText('Cálculo do Pulse sobre esta série');
    await expect(block).toContainText('com ajuste sazonal');
    await expect(block).toContainText('não é a variação interanual publicada pela fonte');
  });
  test('falha de persistência aparece no feedback em vez de ficar silenciosa', async ({ page }) => {
    await page.addInitScript(() => { const proto = Object.getPrototypeOf(window.localStorage); const original = proto.setItem; proto.setItem = function (key, value) { if (key === 'pulse:next-level:v1') throw new Error('quota exceeded (synthetic)'); return original.call(this, key, value); }; });
    await page.goto('/index.html');
    const section = page.locator('#pv4-next-level');
    await section.locator('#pv4-nl-series details.pv4-nl-form summary').click();
    await page.fill('#pv4-nl-period', '2026-01'); await page.fill('#pv4-nl-value', '10'); await page.fill('#pv4-nl-unit', 'u');
    await page.fill('#pv4-nl-metric', 'volume'); await page.fill('#pv4-nl-geography', 'BR'); await page.fill('#pv4-nl-source', 'fixture'); await page.fill('#pv4-nl-provenance', 'synthetic browser test');
    await page.locator('#pv4-nl-series-form button[type="submit"]').click();
    const feedback = page.locator('#pv4-nl-series-feedback');
    await expect(feedback).toHaveAttribute('data-status', 'added');
    await expect(feedback).toHaveAttribute('data-persist', 'storage_error');
    await expect(feedback).toContainText('Não foi salvo neste navegador');
    await expect(section).toHaveAttribute('data-persist', 'storage_error');
  });
});
