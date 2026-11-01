#!/usr/bin/env node
'use strict';
/* Unit tests for the next-level data contract that lives inline in pulse-workspace-v3.js
   (between PULSE_NEXT_LEVEL_CONTRACT_START/END). The block is dependency-free, so it is
   evaluated here under Node with a bare `window` object: no DOM, no network, no fixtures
   that could be mistaken for market data. Every value below is synthetic test input. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const runtimePath = path.join(__dirname, '..', 'pulse-workspace-v3.js');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const start = runtime.indexOf('/* PULSE_NEXT_LEVEL_CONTRACT_START');
const end = runtime.indexOf('/* PULSE_NEXT_LEVEL_CONTRACT_END */');
assert(start > 0 && end > start, 'contract markers must exist in pulse-workspace-v3.js');
const block = runtime.slice(start, end);
assert(!/\bdocument\b|\blocation\b|querySelector/.test(block), 'contract block must stay free of DOM access');

function freshWindow() {
  const window = { PULSE_LOCAL_EVIDENCE: [], serie_historica: [], papel_ideal: [], PULSE_NEXT_LEVEL: {} };
  /* Same V8 context as the test file, so arrays/objects created by the contract keep the
     prototypes assert.deepStrictEqual expects; `window` is the only name the block needs. */
  vm.runInThisContext('(function (window) {\n' + block + '\n})', { filename: 'pulse-next-level-contract-block.js' })(window);
  return window;
}

const checks = [];
function test(name, fn) { checks.push({ name, fn }); }

/* ---------- B.1 série histórica ---------- */
const base = { period: '2026-01', value: 100, metric: 'volume', unit: 'mil unidades', geography: 'Brasil', source: 'fixture', provenance: 'synthetic unit test' };

test('rejeita registro incompleto e lista os campos ausentes', () => {
  const w = freshWindow();
  const out = w.PULSE_NEXT_LEVEL.addHistoricalObservation({ period: '2026-01', value: 10 });
  assert.strictEqual(out.status, 'rejected');
  assert.strictEqual(out.reason, 'incomplete');
  assert.deepStrictEqual(out.missing.sort(), ['geography', 'metric', 'provenance', 'source']);
  assert.strictEqual(w.serie_historica.length, 0);
});

test('rejeita período inválido e valor não numérico como inválidos, não incompletos', () => {
  const w = freshWindow();
  const bad = w.PULSE_NEXT_LEVEL.addHistoricalObservation({ ...base, period: '2026-13' });
  assert.strictEqual(bad.status, 'rejected');
  assert.strictEqual(bad.reason, 'invalid');
  assert.deepStrictEqual(bad.invalid, ['period']);
  const nan = w.PULSE_NEXT_LEVEL.addHistoricalObservation({ ...base, value: 'abc' });
  assert.strictEqual(nan.reason, 'invalid');
  assert.deepStrictEqual(nan.invalid, ['value']);
  const day = w.PULSE_NEXT_LEVEL.addHistoricalObservation({ ...base, period: '2026-02-30' });
  assert.strictEqual(day.reason, 'invalid');
});

test('distingue valor zero de valor ausente', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  assert.strictEqual(api.addHistoricalObservation({ ...base, value: 0 }).status, 'added');
  assert.strictEqual(api.addHistoricalObservation({ ...base, period: '2026-02', value: null }).reason, 'incomplete');
  assert.strictEqual(api.addHistoricalObservation({ ...base, period: '2026-02', value: '' }).reason, 'incomplete');
  assert.strictEqual(api.addHistoricalObservation({ ...base, period: '2026-02', value: undefined }).reason, 'incomplete');
  const cmp = api.compareSeries(0, 0);
  assert.strictEqual(cmp.status, 'observed_change');
  assert.strictEqual(cmp.direction, 'no_change');
  assert.strictEqual(cmp.deltaPct, null);
  assert.strictEqual(cmp.deltaPctReason, 'previous_value_is_zero');
  const missing = api.compareSeries(null, 5);
  assert.strictEqual(missing.status, 'unavailable');
  assert.strictEqual(missing.reason, 'current_value_missing');
});

test('bloqueia duplicata e sinaliza conflito quando o mesmo ponto chega com valor diferente', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  assert.strictEqual(api.addHistoricalObservation(base).status, 'added');
  const dup = api.addHistoricalObservation({ ...base });
  assert.strictEqual(dup.status, 'duplicate');
  const conflict = api.addHistoricalObservation({ ...base, value: 101 });
  assert.strictEqual(conflict.status, 'conflict');
  assert.strictEqual(w.serie_historica.length, 1, 'conflicting value must not overwrite nor duplicate');
});

test('série com uma única observação é insuficiente', () => {
  const w = freshWindow();
  w.PULSE_NEXT_LEVEL.addHistoricalObservation(base);
  const s = w.PULSE_NEXT_LEVEL.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'insufficient');
  assert.strictEqual(s.reason, 'too_few_observations');
  assert.strictEqual(s.causal, false);
  assert.strictEqual(s.interpretation, null);
});

test('não compara unidades diferentes', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  api.addHistoricalObservation(base);
  api.addHistoricalObservation({ ...base, period: '2026-02', value: 110, unit: 'toneladas' });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'not_comparable');
  assert.ok(s.mixedDimensions.includes('unit'));
});

test('não compara fontes ou metodologias diferentes', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  api.addHistoricalObservation(base);
  api.addHistoricalObservation({ ...base, period: '2026-02', value: 110, source: 'outra fonte' });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'not_comparable');
  assert.ok(s.mixedDimensions.includes('source'));
  const w2 = freshWindow();
  w2.PULSE_NEXT_LEVEL.addHistoricalObservation({ ...base, methodology: 'painel A' });
  w2.PULSE_NEXT_LEVEL.addHistoricalObservation({ ...base, period: '2026-02', value: 110, methodology: 'painel B' });
  assert.strictEqual(w2.PULSE_NEXT_LEVEL.historicalSummary('volume', 'Brasil').status, 'not_comparable');
});

test('não compara períodos de granularidade diferente (ano vs mês)', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  api.addHistoricalObservation({ ...base, period: '2025' });
  api.addHistoricalObservation({ ...base, period: '2026-01' });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'not_comparable');
  assert.ok(s.mixedDimensions.includes('granularity'));
});

test('ordena observações por período, mesmo inseridas fora de ordem', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  api.addHistoricalObservation({ ...base, period: '2026-03', value: 130 });
  api.addHistoricalObservation({ ...base, period: '2026-01', value: 100 });
  api.addHistoricalObservation({ ...base, period: '2026-02', value: 120 });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'observed_change');
  assert.strictEqual(s.previous.period, '2026-02');
  assert.strictEqual(s.current.period, '2026-03');
  assert.strictEqual(s.delta, 10);
  assert.strictEqual(s.consecutive, true);
  assert.strictEqual(s.count, 3);
});

test('explicita lacuna quando os períodos comparados não são consecutivos', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  api.addHistoricalObservation(base);
  api.addHistoricalObservation({ ...base, period: '2026-05', value: 90 });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'observed_change');
  assert.strictEqual(s.consecutive, false);
  assert.ok(s.limitations.some(l => /não são consecutivos/.test(l)));
  assert.strictEqual(s.direction, 'down');
  assert.strictEqual(s.deltaPct, -10);
});

test('resultado válido separa observação de interpretação e nunca declara causa', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  api.addHistoricalObservation({ ...base, period: '2025-02', value: 95 });
  api.addHistoricalObservation(base);
  api.addHistoricalObservation({ ...base, period: '2026-02', value: 110 });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'observed_change');
  assert.strictEqual(s.causal, false);
  assert.strictEqual(s.interpretation, null);
  assert.ok(/Variação observada/.test(s.observation));
  assert.ok(!/porque|causa|devido/i.test(s.observation));
  assert.ok(s.yearOverYear && s.yearOverYear.previous.period === '2025-02');
  assert.strictEqual(s.yearOverYear.delta, 15);
  assert.ok(s.limitations.some(l => /Fonte única/.test(l)));
  assert.ok(s.limitations.some(l => /Metodologia não declarada/.test(l)));
});

test('unidade não declarada entra como limitação explícita', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const { unit, ...noUnit } = base;
  api.addHistoricalObservation(noUnit);
  api.addHistoricalObservation({ ...noUnit, period: '2026-02', value: 101 });
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'observed_change');
  assert.strictEqual(s.unit, api.UNDECLARED);
  assert.ok(s.limitations.some(l => /Unidade não declarada/.test(l)));
});

test('carrega blocos serie_historica declarados em evidências e ignora períodos em texto livre', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const r = api.loadFromEvidence([
    { id: 'ev-1', fonte: 'fixture', url: 'https://example.invalid', fonte_primaria: 'fixture primária', universo_observado: 'Brasil', periodo: 'Julho/2026; publicado em 27/08/2026',
      serie_historica: [{ period: '2026-06', value: 1, metric: 'm', unit: 'u' }, { period: '2026-07', value: 2, metric: 'm', unit: 'u' }] },
    { id: 'ev-2', fonte: 'fixture', periodo: '2026-07 vs 2025-07' }
  ]);
  assert.strictEqual(r.added, 2);
  assert.strictEqual(w.serie_historica[0].provenance, 'fixture primária');
  assert.strictEqual(api.historicalSummary('m', 'Brasil').status, 'observed_change');
});

/* ---------- B.2 papel ideal ---------- */
test('papel da categoria é heurístico, registra evidências, limitações e condições de revisão', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const out = api.setCategoryRole('categoria-teste', 'destino', [{ id: 'e1', source: 'fixture', provenance: 'teste' }, { id: 'e2', source: 'fixture' }],
    { limitations: ['amostra sintética'], competingHypotheses: ['papel de rotina'], confidence: 'baixa', confidenceBasis: 'duas evidências sintéticas' });
  assert.strictEqual(out.status, 'added');
  const item = out.item;
  assert.strictEqual(item.status, 'heuristic');
  assert.ok(/não é fato/.test(item.provenance));
  assert.strictEqual(item.evidenceCount, 2);
  assert.strictEqual(item.evidenceWithProvenance, 1);
  assert.strictEqual(item.evidenceQuality, 'proveniência parcial');
  assert.ok(item.limitations.includes('amostra sintética'));
  assert.ok(item.limitations.some(l => /1 de 2 evidências sem proveniência/.test(l)));
  assert.deepStrictEqual(item.competingHypotheses, ['papel de rotina']);
  assert.strictEqual(item.confidence.level, 'baixa');
  assert.ok(item.reviewConditions.length >= 1);
  assert.strictEqual(w.papel_ideal.length, 1);
  api.setCategoryRole('Categoria-Teste', 'rotina', []);
  assert.strictEqual(w.papel_ideal.length, 1, 'same category replaces instead of duplicating');
  assert.strictEqual(w.papel_ideal[0].evidenceQuality, 'sem evidência');
});

test('confiança sem justificativa fica como não declarada', () => {
  const w = freshWindow();
  const out = w.PULSE_NEXT_LEVEL.setCategoryRole('c', 'r', [], { confidence: 'alta' });
  assert.strictEqual(out.item.confidence.level, 'não declarada');
  assert.strictEqual(w.PULSE_NEXT_LEVEL.setCategoryRole('', 'r').status, 'rejected');
});

/* ---------- B.3 evidência local ---------- */
const local = { claim: 'afirmação sintética', source: 'fixture', geography: 'Brasil', date: '2026-10-31', provenance: 'teste unitário' };

test('evidência local distingue incompleta, inválida e válida', () => {
  const api = freshWindow().PULSE_NEXT_LEVEL;
  assert.strictEqual(api.validateLocalEvidence({ claim: 'x' }).status, 'incomplete');
  assert.deepStrictEqual(api.validateLocalEvidence({ claim: 'x' }).missing.sort(), ['date', 'geography', 'provenance', 'source']);
  assert.strictEqual(api.validateLocalEvidence({ ...local, date: '31/10/2026' }).status, 'rejected');
  assert.strictEqual(api.validateLocalEvidence(local).status, 'valid');
  const rejected = api.addLocalEvidence({ claim: 'x' });
  assert.strictEqual(rejected.status, 'rejected');
  assert.strictEqual(rejected.reason, 'incomplete');
});

test('evidência local deduplica por id e por impressão digital do conteúdo', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const a = api.addLocalEvidence({ ...local, id: 'loc-1' });
  assert.strictEqual(a.status, 'added');
  assert.strictEqual(api.addLocalEvidence({ ...local, id: 'loc-1', claim: 'outra' }).matchedBy, 'id');
  const b = api.addLocalEvidence({ ...local, id: 'loc-2' });
  assert.strictEqual(b.status, 'duplicate');
  assert.strictEqual(b.matchedBy, 'content');
  assert.strictEqual(w.PULSE_LOCAL_EVIDENCE.length, 1);
  assert.strictEqual(w.PULSE_LOCAL_EVIDENCE[0].status, 'valid');
});

test('evidência local se projeta no vocabulário de PULSE_EVIDENCE sem inventar campos', () => {
  const api = freshWindow().PULSE_NEXT_LEVEL;
  const item = api.addLocalEvidence({ ...local, limitations: ['uma loja'] }).item;
  const ev = api.localEvidenceAsEvidence(item);
  assert.strictEqual(ev.fato, local.claim);
  assert.strictEqual(ev.fonte, local.source);
  assert.strictEqual(ev.periodo, local.date);
  assert.strictEqual(ev.fonte_primaria, local.provenance);
  assert.strictEqual(ev.fato_verificado_na_fonte, api.UNDECLARED);
  assert.ok(/uma loja/.test(ev.contexto));
  assert.strictEqual(ev.tipo, 'evidência local');
});

/* ---------- B.4 síntese executiva ---------- */
test('síntese executiva separa cinco blocos e não recomenda sem evidência', () => {
  const api = freshWindow().PULSE_NEXT_LEVEL;
  const empty = api.executiveSummary([{ type: 'action', text: 'fazer algo', basis: ['e1'] }, { type: 'hypothesis', text: 'h' }]);
  assert.strictEqual(empty.status, 'insufficient');
  assert.deepStrictEqual(empty.actions, []);
  assert.deepStrictEqual(empty.unsupportedActions, ['fazer algo']);
  assert.strictEqual(empty.confidence, 'insufficient');
  const full = api.executiveSummary([
    { id: 'e1', type: 'observed', text: 'observação 1' },
    { id: 'e2', type: 'observed', text: 'observação 2' },
    { type: 'interpretation', text: 'leitura' },
    { type: 'hypothesis', text: 'hipótese' },
    { type: 'implication', text: 'implicação' },
    { type: 'action', text: 'ação apoiada', basis: ['e1'] },
    { type: 'action', text: 'ação solta' },
    { type: 'rumor', text: 'ignorar' }
  ]);
  assert.strictEqual(full.status, 'available');
  assert.deepStrictEqual(full.evidence, ['observação 1', 'observação 2']);
  assert.deepStrictEqual(full.observed, full.evidence, 'legacy alias preserved');
  assert.deepStrictEqual(full.interpretations, ['leitura']);
  assert.deepStrictEqual(full.hypotheses, ['hipótese']);
  assert.deepStrictEqual(full.implications, ['implicação']);
  assert.deepStrictEqual(full.actions, ['ação apoiada']);
  assert.deepStrictEqual(full.unsupportedActions, ['ação solta']);
  assert.strictEqual(full.causal, false);
  assert.ok(full.warnings.some(x => /ação solta/i.test(x)));
  assert.ok(full.warnings.some(x => /rumor/.test(x)));
  assert.strictEqual(api.executiveSummary([{ type: 'observed', text: 'só uma' }]).confidence, 'single_observation');
});

/* ---------- persistence ---------- */
test('restore distingue armazenamento vazio, corrompido e válido', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
  assert.strictEqual(api.restore(storage).status, 'empty');
  api.addHistoricalObservation(base);
  api.addHistoricalObservation({ ...base, period: '2026-02', value: 110 });
  api.addLocalEvidence(local);
  api.setCategoryRole('cat', 'role', [], { limitations: ['l'] });
  assert.strictEqual(api.persist(storage).status, 'saved');
  const w2 = freshWindow();
  const r = w2.PULSE_NEXT_LEVEL.restore(storage);
  assert.strictEqual(r.status, 'restored');
  assert.strictEqual(w2.serie_historica.length, 2);
  assert.strictEqual(w2.PULSE_LOCAL_EVIDENCE.length, 1);
  assert.strictEqual(w2.papel_ideal.length, 1);
  assert.strictEqual(w2.papel_ideal[0].limitations.filter(l => /Nenhuma evidência registrada/.test(l)).length, 1, 'auto limitation stays idempotent across restore');
  assert.strictEqual(w2.PULSE_NEXT_LEVEL.historicalSummary('volume', 'Brasil').status, 'observed_change');
  mem.set('pulse:next-level:v1', '{not json');
  assert.strictEqual(freshWindow().PULSE_NEXT_LEVEL.restore(storage).status, 'source_error');
  const broken = { getItem: () => { throw new Error('denied'); } };
  assert.strictEqual(freshWindow().PULSE_NEXT_LEVEL.restore(broken).status, 'storage_error');
});

/* ---------- fixes from the independent review of 2026-10-31 ---------- */
test('valor só com espaços, booleano, array, hexadecimal e expoente nunca viram número', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const blank = api.addHistoricalObservation({ ...base, value: '   ' });
  assert.strictEqual(blank.status, 'rejected');
  assert.strictEqual(blank.reason, 'incomplete', 'whitespace-only is an absence, not zero');
  assert.ok(blank.missing.includes('value'));
  for (const bad of [true, [], ['1'], {}, '0x10', '1e3', 'NaN', 'Infinity', '1.2.3', '10 unidades']) {
    const out = api.addHistoricalObservation({ ...base, value: bad });
    assert.notStrictEqual(out.status, 'added', 'must not accept ' + JSON.stringify(bad));
    assert.strictEqual(w.serie_historica.length, 0);
  }
  assert.strictEqual(api.addHistoricalObservation({ ...base, value: ' 1,5 ' }).item.value, 1.5, 'decimal comma with surrounding spaces is a value');
  assert.strictEqual(api.addHistoricalObservation({ ...base, period: '2026-02', value: '-0.25' }).item.value, -0.25);
  assert.strictEqual(api.addHistoricalObservation({ ...base, period: '2026-03', value: 0 }).item.value, 0, 'zero is a value');
});

test('metodologia faz parte da identidade da observação, como faz parte da comparabilidade', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  assert.strictEqual(api.addHistoricalObservation({ ...base, methodology: 'com ajuste' }).status, 'added');
  assert.strictEqual(api.addHistoricalObservation({ ...base, value: 90, methodology: 'sem ajuste' }).status, 'added', 'same period, different methodology: two observations');
  assert.strictEqual(api.addHistoricalObservation({ ...base, value: 90, methodology: 'com ajuste' }).status, 'conflict');
  assert.strictEqual(api.addHistoricalObservation({ ...base, value: 90 }).status, 'added', 'undeclared methodology is its own identity');
});

test('grupos concorrentes são declarados como limitação, com contagem e critério de empate', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const row = (period, value, unit) => api.addHistoricalObservation({ ...base, period, value, unit });
  row('2026-01', 10, 'a'); row('2026-02', 11, 'a'); row('2026-03', 12, 'a');
  row('2026-01', 10, 'b'); row('2026-02', 13, 'b');
  const s = api.historicalSummary('volume', 'Brasil');
  assert.strictEqual(s.status, 'observed_change');
  assert.strictEqual(s.count, 3);
  assert.strictEqual(s.excluded, 2);
  assert.strictEqual(s.groups, 2);
  assert.ok(s.limitations.some(l => /2 observações com outra unidade/.test(l)), 'the ignored group is named in the limitations: ' + JSON.stringify(s.limitations));
  const w2 = freshWindow();
  const api2 = w2.PULSE_NEXT_LEVEL;
  const row2 = (period, value, unit) => api2.addHistoricalObservation({ ...base, period, value, unit });
  row2('2026-01', 10, 'old'); row2('2026-02', 11, 'old');
  row2('2026-05', 10, 'new'); row2('2026-06', 11, 'new');
  const tie = api2.historicalSummary('volume', 'Brasil');
  assert.strictEqual(tie.unit, 'new', 'equal-sized groups: the one with the most recent period wins');
  assert.ok(tie.limitations.some(l => /empate resolvido pelo período mais recente/.test(l)));
});

test('síntese executiva só sustenta ação cujo basis aponta para evidência observada identificada', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const out = api.executiveSummary([
    { type: 'observed', text: 'observação sem id' },
    { type: 'action', text: 'ação com base inexistente', basis: ['nonexistent-id'] },
  ]);
  assert.strictEqual(out.status, 'available');
  assert.deepStrictEqual(out.actions, []);
  assert.deepStrictEqual(out.unsupportedActions, ['ação com base inexistente']);
  assert.ok(out.warnings.some(x => /não aponta para evidência observada/.test(x)));
  const ok = api.executiveSummary([
    { id: 'obs-1', type: 'observed', text: 'observação com id' },
    { type: 'action', text: 'ação sustentada', basis: ['obs-1'] },
  ]);
  assert.deepStrictEqual(ok.actions, ['ação sustentada']);
});

test('reset limpa o armazenamento só quando pedido e persist reporta a falha', () => {
  const w = freshWindow();
  const api = w.PULSE_NEXT_LEVEL;
  const mem = new Map();
  const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  api.addHistoricalObservation(base);
  assert.strictEqual(api.persist(storage).status, 'saved');
  assert.deepStrictEqual(api.reset(), { status: 'reset', storage: 'kept' });
  assert.ok(mem.has('pulse:next-level:v1'));
  assert.deepStrictEqual(api.reset({ storage }), { status: 'reset', storage: 'cleared' });
  assert.ok(!mem.has('pulse:next-level:v1'));
  const broken = { setItem: () => { throw new Error('quota'); } };
  assert.strictEqual(api.persist(broken).status, 'storage_error');
  assert.strictEqual(typeof api.norm, 'function');
  assert.strictEqual(api.norm('  Índice  de Volume '), 'indice de volume');
});

let failed = 0;
for (const { name, fn } of checks) {
  try { fn(); console.log('PASS ' + name); }
  catch (err) { failed++; console.log('FAIL ' + name + '\n  ' + (err && err.message)); }
}
console.log(failed ? `Next-level contract: ${failed} failure(s)` : `Next-level contract: PASS (${checks.length} checks)`);
process.exit(failed ? 1 : 0);
