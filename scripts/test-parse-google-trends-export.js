#!/usr/bin/env node
"use strict";
/* Tests for parse-google-trends-export.js. Every input below is a SYNTHETIC FIXTURE that mimics the
   shape of a Google Trends multiTimeline CSV; the numbers are invented for the test and are not search
   data. Nothing here is written into the capture kit. */
const assert = require("assert");
const { parseExport } = require("./parse-google-trends-export.js");

const checks = [];
function test(name, fn) { checks.push({ name, fn }); }

const fixture = [
  "Categoria: Todas as categorias", "",
  "Semana,chocolate: (Brasil),barra de chocolate: (Brasil),chocolate amargo: (Brasil)",
  "2026-09-06,80,5,<1", "2026-09-13,100,6,2", "2026-09-20,77,4,<1", "2026-09-27,70,7,1",
].join("\n") + "\n";

test("aceita o formato multiTimeline e preserva <1 como baixo volume, não zero", () => {
  const r = parseExport(fixture);
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.granularity, "week");
  assert.strictEqual(r.category, "Todas as categorias");
  assert.deepStrictEqual(r.terms.map(t => t.label), ["chocolate", "barra de chocolate", "chocolate amargo"]);
  assert.strictEqual(r.series.length, 12);
  assert.strictEqual(r.series.filter(s => s.lowVolume).length, 2);
  assert.ok(r.series.every(s => s.value !== 0 || !s.lowVolume));
  assert.ok(r.limitations.some(l => /<1/.test(l)));
  assert.ok(r.limitations.some(l => /not search volume/.test(l)));
  assert.deepStrictEqual(r.dates, ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
});

test("aceita cabeçalho em inglês e granularidade mensal", () => {
  const r = parseExport("Category: All categories\n\nMonth,chocolate: (Brazil),Lindt: (Brazil)\n2025-10,100,10\n2025-11,60,8\n");
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.granularity, "month");
  assert.strictEqual(r.terms[0].geoLabel, "Brazil");
});

test("rejeita arquivo sem cabeçalho de tempo", () => {
  const r = parseExport("foo,bar\n1,2\n");
  assert.ok(r.errors.some(e => /time header/.test(e)));
});

test("rejeita valores fora de 0..100, datas incompatíveis e linhas truncadas", () => {
  const r = parseExport("Semana,chocolate: (Brasil),Lacta: (Brasil)\n2026-09-06,100,150\n2026-09,50,5\n2026-09-20,40\n");
  assert.ok(r.errors.some(e => /not an index 0\.\.100/.test(e)));
  assert.ok(r.errors.some(e => /unexpected week date/.test(e)));
  assert.ok(r.errors.some(e => /expected 3 cells/.test(e)));
});

test("rejeita série sem pico 100 (arquivo editado ou truncado)", () => {
  const r = parseExport("Semana,chocolate: (Brasil)\n2026-09-06,40\n2026-09-13,55\n");
  assert.ok(r.errors.some(e => /no term reaches 100/.test(e)));
});

test("rejeita série com um único ponto", () => {
  const r = parseExport("Semana,chocolate: (Brasil)\n2026-09-06,100\n");
  assert.ok(r.errors.some(e => /fewer than two time points/.test(e)));
});

let failed = 0;
for (const { name, fn } of checks) {
  try { fn(); console.log("PASS " + name); } catch (err) { failed++; console.log("FAIL " + name + "\n  " + err.message); }
}
console.log(failed ? `Google Trends export parser: ${failed} failure(s)` : `Google Trends export parser: PASS (${checks.length} checks, synthetic fixtures only)`);
process.exit(failed ? 1 : 0);
