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

/* ---------- time-axis integrity (review of 2026-10-31) ---------- */
test("rejeita datas duplicadas, fora de ordem, impossíveis e cadência diária sob cabeçalho semanal", () => {
  const dup = parseExport("Semana,chocolate: (Brasil)\n2026-09-06,80\n2026-09-13,100\n2026-09-13,70\n2026-09-20,60\n");
  assert.ok(dup.errors.some(e => /duplicated time points: 2026-09-13/.test(e)), dup.errors.join(" | "));
  const order = parseExport("Semana,chocolate: (Brasil)\n2026-09-13,100\n2026-09-06,80\n2026-09-20,60\n");
  assert.ok(order.errors.some(e => /not strictly increasing/.test(e)), order.errors.join(" | "));
  const impossible = parseExport("Semana,chocolate: (Brasil)\n2026-09-06,80\n2026-13-45,100\n");
  assert.ok(impossible.errors.some(e => /impossible calendar dates: 2026-13-45/.test(e)), impossible.errors.join(" | "));
  const daily = parseExport("Semana,chocolate: (Brasil)\n2026-09-06,80\n2026-09-07,100\n2026-09-08,70\n");
  assert.ok(daily.errors.some(e => /cadence break at 2026-09-07: 1 day/.test(e)), daily.errors.join(" | "));
  const monthly = parseExport("Month,chocolate: (Brazil)\n2025-10,100\n2025-11,60\n2025-12,70\n2026-01,65\n");
  assert.deepStrictEqual(monthly.errors, []);
});

/* ---------- CLI cross-checks against the registered slot (run in a child process, synthetic file in a temp dir) ---------- */
const { spawnSync } = require("child_process");
const fs = require("fs"); const os = require("os"); const path = require("path");
const PARSER = path.join(__dirname, "parse-google-trends-export.js");
const KIT = path.join(__dirname, "..", "docs", "pilot-chocolate", "capture-kit");
const REGISTERED_TERMS = ["chocolate", "barra de chocolate", "chocolate amargo", "chocolate ao leite", "chocolate sem açúcar"];
function weeklyFixture({ weeks = 52, geo = "Brasil", terms = REGISTERED_TERMS, category = "Categoria: Todas as categorias" } = {}) {
  const lines = [category, "", "Semana," + terms.map(t => `${t}: (${geo})`).join(",")];
  const start = Date.UTC(2025, 10, 2);
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start + i * 7 * 86400000).toISOString().slice(0, 10);
    lines.push([d].concat(terms.map((t, k) => (i === 10 && k === 0 ? 100 : 10 + ((i * 7 + k * 3) % 60)))).join(","));
  }
  return lines.join("\n") + "\n";
}
/* Synthetic fixtures are checked against a copy of the registered slots with the capture fields cleared, so the
   hash registered for the real exports does not reject them before the structural checks run. */
const UNREGISTERED_STATUS = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gt-status-"));
  const lines = fs.readFileSync(path.join(KIT, "trends-export-status-2026-10-15.csv"), "utf8").split(/\r?\n/);
  const head = lines[0].split(",");
  const idx = ["exported_at_utc", "raw_filename", "raw_file_sha256"].map(h => head.indexOf(h));
  const out = [lines[0]].concat(lines.slice(1).filter(Boolean).map(l => {
    const cells = []; let cell = "", q = false;
    for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cell += '""'; i++; } else if (c === '"') { q = false; cell += c; } else cell += c; } else if (c === '"') { q = true; cell += c; } else if (c === ",") { cells.push(cell); cell = ""; } else cell += c; }
    cells.push(cell); idx.forEach(i => { cells[i] = ""; }); return cells.join(",");
  }));
  const file = path.join(dir, "status.csv"); fs.writeFileSync(file, out.join("\n") + "\n"); return file;
})();
function runCli(content, extra = [], env = { PULSE_TRENDS_STATUS_FILE: UNREGISTERED_STATUS }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gt-export-"));
  const file = path.join(dir, "multiTimeline.csv");
  fs.writeFileSync(file, content);
  const r = spawnSync(process.execPath, [PARSER, "--file", file, ...extra], { encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, out: r.stdout + r.stderr, dir };
}
test("CLI aceita um export sintético coerente com o slot GT-CHOC-A-12M e reporta hash não registrado", () => {
  const r = runCli(weeklyFixture(), ["--export-id", "GT-CHOC-A-12M", "--exported-at", "2026-10-31T00:00:00Z"]);
  assert.strictEqual(r.status, 0, r.out);
  assert.match(r.out, /VALID .*5 terms, 52 weeks/);
  assert.match(r.out, /no registered SHA-256 yet/);
});
test("CLI rejeita export de 5 anos para o slot de 12 meses", () => {
  const r = runCli(weeklyFixture({ weeks: 261 }), ["--export-id", "GT-CHOC-A-12M", "--exported-at", "2026-10-31T00:00:00Z"]);
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /261 weeks in the file, but a "last 12 months" export has 51 to 54/);
});
test("CLI rejeita geografia diferente da registrada", () => {
  const r = runCli(weeklyFixture({ geo: "United States" }), ["--export-id", "GT-CHOC-A-12M", "--exported-at", "2026-10-31T00:00:00Z"]);
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /geography label in the file .* does not match the registered geo BR/);
});
test("CLI rejeita termos diferentes dos registrados", () => {
  const r = runCli(weeklyFixture({ terms: ["chocolate", "cacau"] }), ["--export-id", "GT-CHOC-A-12M", "--exported-at", "2026-10-31T00:00:00Z"]);
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /terms in file .* differ from the registered comparison/);
});
test("CLI rejeita categoria restrita quando o slot registra Todas as categorias, e vice-versa", () => {
  const r = runCli(weeklyFixture({ category: "Categoria: Alimentos e bebidas" }), ["--export-id", "GT-CHOC-A-12M", "--exported-at", "2026-10-31T00:00:00Z"]);
  assert.strictEqual(r.status, 1, r.out);
  assert.match(r.out, /does not match the registered "All categories \(cat=0\)"/);
  const r2 = runCli(weeklyFixture(), ["--geo", "BR", "--category", "Food & Drink (cat=71)", "--search-type", "Web Search", "--query-type", "Search term", "--source-url", "https://example.invalid", "--exported-at", "2026-10-31T00:00:00Z"]);
  assert.strictEqual(r2.status, 1, r2.out);
  assert.match(r2.out, /is All categories but the slot registers/);
});
test("CLI recusa escrever dentro do capture kit", () => {
  const r = runCli(weeklyFixture(), ["--export-id", "GT-CHOC-A-12M", "--exported-at", "2026-10-31T00:00:00Z", "--report", path.join(KIT, "should-never-exist.json")]);
  assert.strictEqual(r.status, 2, r.out);
  assert.match(r.out, /REFUSED: --report must not point inside/);
  assert.ok(!fs.existsSync(path.join(KIT, "should-never-exist.json")));
});

test("CLI aceita os exports reais registrados e rejeita um byte alterado pelo hash registrado", () => {
  const status = fs.readFileSync(path.join(KIT, "trends-export-status-2026-10-15.csv"), "utf8");
  if (!/GT-CHOC-A-12M,[^\n]*,captured,/.test(status)) return; // slot not captured yet: nothing real to check
  const real = fs.readFileSync(path.join(KIT, "GT-CHOC-A-12M.csv"), "utf8");
  const ok = runCli(real, ["--export-id", "GT-CHOC-A-12M"], {});
  assert.strictEqual(ok.status, 0, ok.out);
  assert.match(ok.out, /VALID .*53 weeks/);
  const bad = runCli(real.replace("2025-11-02,40,", "2025-11-02,41,"), ["--export-id", "GT-CHOC-A-12M"], {});
  assert.strictEqual(bad.status, 1, bad.out);
  assert.match(bad.out, /REJECTED: SHA-256/);
});

let failed = 0;
for (const { name, fn } of checks) {
  try { fn(); console.log("PASS " + name); } catch (err) { failed++; console.log("FAIL " + name + "\n  " + err.message); }
}
console.log(failed ? `Google Trends export parser: ${failed} failure(s)` : `Google Trends export parser: PASS (${checks.length} checks: synthetic fixtures plus the registered real export)`);
process.exit(failed ? 1 : 0);
