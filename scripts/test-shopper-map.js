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

console.log(`shopper map: ${n} tests passed`);
