#!/usr/bin/env node
"use strict";
/* The shopper question map (pulse-shopper-map.js) against the canonical public evidence base.
   A new public evidence item that is not an IBGE monthly series must be classified in the map before it ships. */
const assert = require("node:assert/strict");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
global.window = {};
require(path.join(ROOT, "pulse-public-evidence.js"));
const evidence = global.window.PULSE_EVIDENCE;
const S = require(path.join(ROOT, "pulse-shopper-map.js"));

let n = 0; const t = (name, fn) => { fn(); n++; };
const keys = S.QUESTIONS.map(q => q.key);

t("every public evidence item is classified", () => {
  const missing = evidence.filter(e => !S.entry(e)).map(e => e.id);
  assert.deepEqual(missing, [], `classify in pulse-shopper-map.js: ${missing.join(", ")}`);
});

t("the map names only items that exist, with valid questions and levels", () => {
  for (const [id, m] of Object.entries(S.MAP)) {
    assert.ok(evidence.some(e => e.id === id), `map lists an item that is not in the base: ${id}`);
    assert.ok(S.LEVEL_ORDER.includes(m.level), `${id}: level ${m.level}`);
    assert.ok(Array.isArray(m.q) && m.q.every(k => keys.includes(k)), `${id}: questions ${m.q}`);
  }
});

t("IBGE monthly series are market context, never shopper behaviour", () => {
  for (const e of evidence.filter(x => S.CONTEXT_TYPES.includes(x.tipo))) assert.deepEqual(S.entry(e), { q: [], level: "mercado" });
});

t("an item only counts as observed purchase when its declared nature says panel", () => {
  for (const [id, m] of Object.entries(S.MAP)) {
    if (m.level !== "observado") continue;
    const e = evidence.find(x => x.id === id);
    assert.match(String(e.natureza).toLowerCase(), /painel|lares/, `${id}: nature "${e.natureza}" does not state a panel`);
  }
});

t("coverage: strongest level first, category apart from the rest, empty is a result", () => {
  const fake = [
    { id: "kantar-chocolate-brasil-volume-q1-2025", categoria: "chocolate", periodo: "2025-T1" },
    { id: "locomotiva-pascoa-2026-intencao-drivers", categoria: "chocolate", periodo: "Páscoa 2026" },
    { id: "niq-full-view-2026-price", categoria: "shopper", periodo: "2026" },
    { id: "x", tipo: "IPCA", categoria: "preços", periodo: "2026-10" },
    { id: "not-in-map", categoria: "chocolate", periodo: "2026" },
  ];
  const rows = S.coverage(fake, "chocolate");
  assert.deepEqual(rows.map(r => r.key), keys);
  const preco = rows.find(r => r.key === "preco");
  assert.equal(preco.category.count, 2); assert.equal(preco.category.level, "observado");
  assert.equal(preco.category.items[0].id, "kantar-chocolate-brasil-volume-q1-2025");
  assert.equal(preco.general.count, 1); assert.equal(preco.general.level, "declarado");
  const quem = rows.find(r => r.key === "quem");
  assert.deepEqual(quem.category, { count: 0, level: null, items: [] });
  assert.deepEqual(quem.general, { count: 0, level: null, items: [] });
});

t("classify: shopper questions, market-share questions and text that is neither", () => {
  assert.deepEqual(S.classify("O que o shopper faz quando o preço do chocolate sobe?").questions, ["preco"]);
  assert.deepEqual(S.classify("Quem compra chocolate premium?").questions, ["quem"]);
  assert.deepEqual(S.classify("Em que canal o shopper compra chocolate?").questions, ["canal"]);
  assert.deepEqual(S.classify("Com que frequência o lar compra chocolate?").questions, ["quanto"]);
  assert.deepEqual(S.classify("Chocolate é compra por impulso ou planejada?").questions, ["escolha"]);
  assert.deepEqual(S.classify("Qual a missão de compra de chocolate fora da Páscoa?").questions, ["ocasiao"]);
  assert.deepEqual(S.classify("O shopper está trocando de marca de chocolate por causa do preço?").questions, ["preco", "escolha"]);
  assert.deepEqual(S.classify("Qual é a participação de mercado em chocolate?"), { questions: [], noMarketData: true });
  assert.deepEqual(S.classify("Como está o varejo?"), { questions: [], noMarketData: false });
  assert.deepEqual(S.classify("   "), { questions: [], noMarketData: false });
});

t("reading: facts by level in citation order, declared limits, gaps named, no cause inferred", () => {
  const pick = ids => ids.map(id => evidence.find(e => e.id === id));
  const r = S.reading("O que o shopper faz quando o preço do chocolate sobe?", pick(["locomotiva-pascoa-2026-intencao-drivers", "kantar-chocolate-brasil-volume-q1-2025"]), evidence, "chocolate");
  assert.deepEqual(r.ordered.map(e => e.id), ["kantar-chocolate-brasil-volume-q1-2025", "locomotiva-pascoa-2026-intencao-drivers"]);
  assert.match(r.text, /^LEITURA: \[E1\] Chocolate: compra observada em painel \(2025-T1\): /);
  assert.ok(r.text.includes("[E2] Chocolate: declaração em pesquisa (Páscoa 2026): "));
  for (const e of r.ordered) { assert.ok(r.text.includes(e.fato.trim())); assert.ok(r.text.includes(e.nao_representa.trim().replace(/\.$/, ""))); }
  for (const label of ["HIPÓTESE:", "RECOMENDAÇÃO:", "DESCONHECIDOS:", "ATUALIZAÇÃO: INSUFFICIENT"]) assert.ok(r.text.includes(label), label);
  assert.ok(r.text.includes("só a compra observada mostra o que fizeram"));

  // A base without any evidence for "quem compra": the reading must name the gap.
  const withoutWho = evidence.filter(e => !(S.entry(e).q || []).includes("quem"));
  const gap = S.reading("Quem compra chocolate premium?", pick(["rico-preco-chocolate-barra-bombom-out-2026"]), withoutWho, "chocolate");
  assert.ok(gap.text.includes("indicadores de mercado"));
  assert.ok(gap.text.includes("buscar evidência de chocolate para: quem compra"));
  assert.ok(gap.text.includes("A base não tem evidência de chocolate para: quem compra."));

  assert.deepEqual(S.reading("qualquer", [], evidence, "chocolate"), { text: "", ordered: [] });
  const five = S.reading("preço", evidence.slice(0, 6), evidence, "chocolate");
  assert.equal(five.ordered.length, 4);
});

t("category registry: unique keys, searchable terms, and every category has evidence in the base", () => {
  const seen = new Set();
  for (const c of S.CATEGORIES) {
    assert.ok(c.key && c.label && Array.isArray(c.terms) && c.terms.length, `category ${c.key}`);
    assert.ok(!seen.has(c.key), `duplicate category ${c.key}`); seen.add(c.key);
    for (const w of c.terms) assert.equal(w, w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), `term "${w}" must be lower case without accents`);
    assert.ok(evidence.some(e => e.categoria === c.key), `category ${c.key} has no evidence in the public base`);
  }
  assert.deepEqual(S.categoriesIn(evidence).map(c => c.key), S.CATEGORIES.map(c => c.key));
  assert.equal(S.categoryOf("O que o shopper faz quando o preço do chocolate sobe?"), "chocolate");
  assert.equal(S.categoryOf("Quem compra ovo de Páscoa?"), "chocolate");
  assert.equal(S.categoryOf("Como está o varejo?"), null);
});

t("a second category needs only a registry entry, its evidence and its classification", () => {
  const added = { key: "cafe", label: "Café", terms: ["cafe"] };
  S.CATEGORIES.push(added);
  S.MAP["teste-cafe-painel"] = { q: ["quem"], level: "observado" };
  try {
    const base = evidence.concat([{ id: "teste-cafe-painel", categoria: "cafe", periodo: "2026-T1", fato: "Fato inventado para teste.", nao_representa: "Limite inventado para teste." }]);
    assert.deepEqual(S.categoriesIn(base).map(c => c.key), S.CATEGORIES.filter(c => base.some(e => e.categoria === c.key)).map(c => c.key));
    assert.equal(S.categoriesIn(base).at(-1).key, "cafe");
    assert.equal(S.categoryOf("Quem compra café em cápsula?"), "cafe");
    const rows = S.coverage(base, "cafe");
    assert.equal(rows.find(r => r.key === "quem").category.count, 1);
    assert.equal(rows.find(r => r.key === "preco").category.count, 0);
    // Evidence of another category is never "general": the general layer is the shopper as a whole.
    assert.ok(!rows.find(r => r.key === "preco").general.items.some(i => i.id === "kantar-chocolate-brasil-volume-q1-2025"));
    assert.ok(!S.coverage(base, "chocolate").find(r => r.key === "quem").general.items.some(i => i.id === "teste-cafe-painel"));
    // The general layer is the same whichever category is read.
    assert.deepEqual(S.coverage(base, "cafe").map(r => r.general), S.coverage(base, "chocolate").map(r => r.general));
    const r = S.reading("Como o shopper de café reage ao preço?", [base[base.length - 1]], base, "cafe");
    assert.ok(r.text.includes("buscar evidência de café para: como reage ao preço"));
    assert.ok(!r.text.includes("chocolate"));
    assert.equal(S.activeCategory(base), "chocolate");
    assert.equal(S.activeCategory(base.filter(e => e.categoria === "cafe" || !S.isCategoryEvidence(e))), "cafe");
    assert.equal(S.setActiveCategory("inexistente"), false);
  } finally { S.CATEGORIES.pop(); delete S.MAP["teste-cafe-painel"]; }
});

t("the base answers every shopper question for the shopper as a whole", () => {
  // The general layer is what every category reading starts from; a question with no general evidence is a gap in the base.
  const empty = S.coverage(evidence, S.CATEGORIES[0].key).filter(r => !r.general.count).map(r => r.key);
  assert.deepEqual(empty, []);
});

t("the reading names each layer and never passes another category off as general", () => {
  const cats = S.categoriesIn(evidence).map(c => c.key);
  if (cats.length < 2) return;
  const [other, read] = cats;
  const mine = evidence.find(e => e.categoria === read), theirs = evidence.find(e => e.categoria === other), general = evidence.find(e => !S.isCategoryEvidence(e) && S.entry(e));
  const r = S.reading("Com que frequência o shopper compra?", [theirs, general, mine], evidence, read);
  const lines = r.text.replace(/^LEITURA: /, "").split("\n").filter(l => /^\[E\d\]/.test(l));
  assert.ok(lines[0].startsWith("[E1] " + S.category(read).label + ":"), lines[0]);
  assert.ok(lines[1].startsWith("[E2] Shopper em geral:"), lines[1]);
  assert.ok(lines[2].startsWith("[E3] Outra categoria (" + S.category(other).label + "), não vale para"), lines[2]);
});

console.log(`shopper map: ${n} tests passed`);
