#!/usr/bin/env node
"use strict";
/* Unit tests for scripts/lib/chocolate-price-index.js, plus consistency checks of the committed
   pilot-chocolate-prices.json. Invented rows only: no real store or price is used in the fixtures. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildPriceIndex, inferBrand, inferGrams, quantile } = require("./lib/chocolate-price-index.js");

let n = 0; const t = (name, fn) => { fn(); n++; };
const row = (gtin, store, price, sold, description) => ({ gtin, inscricao_estadual: store, valor_ultima_venda_brl: String(price), ultima_venda_estimada_utc: sold, descricao_nfce: description });

t("brand and manufacturer come only from the invoice text", () => {
  assert.deepEqual(inferBrand("CHOC NESTLE KITKAT 4"), { brand: "KitKat", manufacturer: "Nestlé" });
  assert.deepEqual(inferBrand("Bombom Sonho de Valsa 20g"), { brand: "Sonho de Valsa", manufacturer: "Mondelez (Lacta)" });
  assert.deepEqual(inferBrand("CHOC LINDT CLASSIC AO LEITE 100G"), { brand: "Lindt", manufacturer: "Lindt & Sprüngli" });
  assert.deepEqual(inferBrand("BATOM GAROTO 16G"), { brand: "Baton", manufacturer: "Garoto (grupo Nestlé)" });
  assert.deepEqual(inferBrand("BISCOITO RECHEADO 120G"), { brand: "", manufacturer: "" });
  assert.deepEqual(inferBrand("CHOCOLATE AO LEITE 80G"), { brand: "", manufacturer: "" });
});

t("grams only when the text states them", () => {
  assert.equal(inferGrams("CHOC GAROTO AO LEITE 80G"), 80);
  assert.equal(inferGrams("BOMB SERENATA DE AMOR 16,5G"), 16.5);
  assert.equal(inferGrams("COBERTURA HARALD 1,01KG"), 1010);
  assert.equal(inferGrams("TABLETE 90 GR"), 90);
  assert.equal(inferGrams("CHOC NESTLE KITKAT 4"), null);
  assert.equal(inferGrams("CAIXA BOMBOM 2G"), null);
});

t("quantile uses linear interpolation", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([10, 20], 0.1), 11);
  assert.equal(quantile([], 0.5), null);
});

const latestRecords = [];
for (let s = 1; s <= 12; s++) latestRecords.push(row("111", "L" + s, 10 + (s - 1) * 0.5, "2026-01-10T10:00:00Z", "CHOC GAROTO AO LEITE 80G"));
latestRecords.push(row("111", "L1", 99, "2026-01-09T10:00:00Z", "CHOC GAROTO AO LEITE 80G"));   // older sale of the same EAN x store: ignored
latestRecords.push(row("111", "L13", 120, "2026-01-10T10:00:00Z", "CX CHOC GAROTO AO LEITE"));  // case price: another sale unit
latestRecords.push(row("", "L1", 5, "2026-01-10T10:00:00Z", "SEM EAN"));
latestRecords.push(row("222", "L1", 0, "2026-01-10T10:00:00Z", "SEM PRECO"));
latestRecords.push(row("333", "L2", 40, "2026-01-10T10:00:00Z", "CHOCOLATE ARTESANAL"));
const previousRecords = [];
for (let s = 1; s <= 6; s++) previousRecords.push(row("111", "L" + s, 10, "2026-01-03T10:00:00Z", "CHOC GAROTO AO LEITE 80G"));
previousRecords.push(row("111", "L99", 30, "2026-01-03T10:00:00Z", "CHOC GAROTO AO LEITE 80G")); // store absent from the latest capture: not used for the change
previousRecords.push(row("333", "L2", 20, "2026-01-03T10:00:00Z", "CHOCOLATE ARTESANAL"));        // one store in common: too few for a change
const index = buildPriceIndex({ day: "2026-01-10", places: ["CIDADE"], records: latestRecords }, { day: "2026-01-03", places: ["CIDADE"], records: previousRecords });

t("one observation per EAN x store, most recent sale wins", () => {
  const i = index.items.find(x => x.gtin === "111");
  assert.equal(i.stores, 12);
  assert.equal(i.min_brl, 10);
  assert.equal(i.max_brl, 15.5);
  assert.equal(i.median_brl, 12.75);
});

t("a case price is counted as another sale unit and left out of the statistics", () => {
  const i = index.items.find(x => x.gtin === "111");
  assert.equal(i.other_unit_observations, 1);
  assert.ok(i.max_brl < 120);
  assert.equal(index.totals.other_unit_observations, 1);
});

t("spread, price per 100 g and change against the previous capture", () => {
  const i = index.items.find(x => x.gtin === "111");
  assert.equal(i.p10_brl, 10.55);
  assert.equal(i.p90_brl, 14.95);
  assert.equal(i.spread_pct, 41.7);
  assert.equal(i.price_per_100g_brl, 15.94);
  assert.equal(i.matched_stores, 6);        // L1 to L6 sold it in both captures: 10,00 before; 10,00 to 12,50 now
  assert.equal(i.previous_median_brl, 10);
  assert.equal(i.change_pct, 12.5);
});

t("unknown brand and missing grams stay empty; few stores give no spread", () => {
  const i = index.items.find(x => x.gtin === "333");
  assert.equal(i.brand, ""); assert.equal(i.manufacturer, ""); assert.equal(i.grams, null);
  assert.equal(i.spread_pct, null); assert.equal(i.price_per_100g_brl, null); assert.equal(i.change_pct, null);
});

t("rows without EAN or price are counted, not used", () => {
  assert.equal(index.totals.rows_without_ean, 1);
  assert.equal(index.totals.rows_without_price, 1);
  assert.equal(index.items.some(x => x.gtin === "222"), false);
  assert.equal(index.totals.ean, 2);
});

t("the result does not depend on the order of the rows", () => {
  const shuffled = buildPriceIndex({ day: "2026-01-10", places: ["CIDADE"], records: [...latestRecords].reverse() }, { day: "2026-01-03", places: ["CIDADE"], records: [...previousRecords].reverse() });
  assert.deepEqual(shuffled, index);
});

t("manufacturer coverage counts stores, not rows", () => {
  const g = index.manufacturer_coverage.find(x => x.manufacturer === "Garoto (grupo Nestlé)");
  assert.equal(g.stores, 13);
  assert.equal(index.totals.stores, 13);
  assert.equal(g.store_share_pct, 100);
});

t("committed file is internally consistent and never lists an item without stores", () => {
  const file = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "pilot-chocolate-prices.json"), "utf8"));
  assert.equal(file.method.brand_inferred, true);
  assert.equal(file.items.length, file.totals.ean);
  assert.equal(file.items.filter(i => ![8, 12, 13, 14].includes(i.gtin.length)).length, file.totals.codes_not_gtin_length);
  for (const i of file.items) {
    assert.ok(/^\d{1,14}$/.test(i.gtin), `code ${i.gtin}`);
    assert.ok(i.stores >= 1 && i.median_brl > 0);
    assert.ok(i.min_brl <= i.p10_brl && i.p10_brl <= i.median_brl && i.median_brl <= i.p90_brl && i.p90_brl <= i.max_brl, `order ${i.gtin}`);
    if (i.spread_pct !== null) assert.ok(i.stores >= 10);
    if (i.price_per_100g_brl !== null) assert.ok(i.grams > 0);
  }
  for (const c of file.manufacturer_coverage) assert.ok(c.stores <= file.totals.stores && c.store_share_pct <= 100);
});

t("description, brand and grams use the most frequent value that states them", () => {
  const { describe } = require("./lib/chocolate-price-index.js");
  const d = describe([{ description: "CHOC LINDT EXCELLENC" }, { description: "CHOC LINDT EXCELLENC" }, { description: "CHOC LINDT EXCELLENCE 70 100G" }, { description: "CHOCOLATE 70 CACAU 100G" }]);
  assert.deepEqual(d, { description: "CHOC LINDT EXCELLENCE 70 100G", brand: "Lindt", manufacturer: "Lindt & Sprüngli", grams: 100 });
});

console.log(`chocolate price index: ${n} tests passed`);
