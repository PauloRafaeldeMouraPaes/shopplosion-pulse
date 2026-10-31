#!/usr/bin/env node
"use strict";
/* Deterministic reader for a Google Trends "multiTimeline" CSV export (Chocolate pilot).

   Usage:
     node scripts/parse-google-trends-export.js --export-id GT-CHOC-A-12M --file <path/to/original.csv> [--out <observations.csv>] [--report <report.json>]
     node scripts/parse-google-trends-export.js --file <path> --geo BR --category "All categories (cat=0)" --search-type "Web Search" --query-type "Search term" --source-url <url> --exported-at <ISO UTC>

   What it does: validates the export structure (metadata header, blank line, time header, one
   column per term, index values 0..100 or "<1"), computes the SHA-256 of the unchanged file,
   cross-checks the registered slot in trends-export-status-2026-10-15.csv when --export-id is given,
   and emits rows in the trends-observations template. Low-volume "<1" values are kept as "<1" and
   listed as limitations; nothing is interpolated, nothing is converted to zero.
   What it never does: download data, touch the status/manifest files, or accept a file whose
   metadata disagrees with the registered slot. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const KIT = path.join(ROOT, "docs", "pilot-chocolate", "capture-kit");
const STATUS = path.join(KIT, "trends-export-status-2026-10-15.csv");
const TIME_HEADERS = { week: ["week", "semana"], month: ["month", "mês", "mes"], day: ["day", "dia"] };
const CATEGORY_LINES = /^(category|categoria)\s*:\s*(.+)$/i;

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function readStatusRow(exportId) {
  const rows = parseCsv(fs.readFileSync(STATUS, "utf8"));
  const headers = rows[0];
  const found = rows.slice(1).filter(r => r.length === headers.length).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])))
    .find(r => r.export_id === exportId);
  if (!found) throw new Error(`export id ${exportId} is not registered in ${path.relative(ROOT, STATUS)}`);
  return found;
}
function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) { out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"; } }
  return out;
}

function parseExport(text) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const errors = []; const limitations = [];
  let category = null; let headerIndex = -1; let granularity = null;
  for (let i = 0; i < rows.length; i++) {
    const first = String(rows[i][0] || "").trim();
    const m = CATEGORY_LINES.exec(first);
    if (m) { category = m[2].trim(); continue; }
    const key = first.toLowerCase();
    const g = Object.keys(TIME_HEADERS).find(k => TIME_HEADERS[k].includes(key));
    if (g) { headerIndex = i; granularity = g; break; }
  }
  if (headerIndex < 0) { errors.push("time header (Week/Semana, Month/Mês, Day/Dia) not found; this does not look like a Google Trends multiTimeline export"); return { errors, limitations }; }
  const header = rows[headerIndex];
  const terms = header.slice(1).map(h => { const m = /^(.*?)\s*:\s*\(([^)]*)\)\s*$/.exec(String(h).trim()); return m ? { label: m[1].trim(), geoLabel: m[2].trim(), raw: String(h).trim() } : { label: String(h).trim(), geoLabel: null, raw: String(h).trim() }; });
  if (!terms.length) errors.push("no query columns after the time column");
  const dateRe = granularity === "month" ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  const series = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const r = rows[i]; if (r.length === 1 && !String(r[0]).trim()) continue;
    const date = String(r[0] || "").trim();
    if (!dateRe.test(date)) { errors.push(`line ${i + 1}: unexpected ${granularity} date "${date}"`); continue; }
    if (r.length !== header.length) { errors.push(`line ${i + 1}: expected ${header.length} cells, found ${r.length}`); continue; }
    terms.forEach((t, k) => {
      const raw = String(r[k + 1]).trim();
      if (raw === "<1") { series.push({ date, term: t, value: "<1", lowVolume: true }); return; }
      if (!/^\d{1,3}$/.test(raw) || Number(raw) > 100) { errors.push(`line ${i + 1}: value "${raw}" for ${t.raw} is not an index 0..100 or "<1"`); return; }
      series.push({ date, term: t, value: Number(raw), lowVolume: false });
    });
  }
  const dates = [...new Set(series.map(s => s.date))].sort();
  if (dates.length < 2) errors.push("fewer than two time points");
  const low = series.filter(s => s.lowVolume).length;
  if (low) limitations.push(`${low} value(s) reported as "<1" (low volume); kept as "<1", never converted to zero`);
  const maxByTerm = terms.map(t => ({ term: t.label, max: Math.max(-1, ...series.filter(s => s.term === t && !s.lowVolume).map(s => s.value)) }));
  if (!maxByTerm.some(x => x.max === 100)) errors.push('no term reaches 100: a Google Trends comparison is normalized so that its peak is 100; the file may be truncated or edited');
  limitations.push("Values are relative search interest normalized within this export (peak = 100), not search volume, sales, preference or market share; never join indices across exports.");
  if (!category) limitations.push("Category line not found in the file header; verify the category setting manually.");
  return { errors, limitations, category, granularity, terms, series, dates, maxByTerm };
}

function main() {
  const a = args(process.argv.slice(2));
  if (!a.file) { console.error("usage: --file <original.csv> (--export-id <id> | --geo --category --search-type --query-type --source-url --exported-at) [--out] [--report]"); process.exit(2); }
  const filePath = path.resolve(a.file);
  const bytes = fs.readFileSync(filePath);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  let slot = null;
  if (a["export-id"]) {
    slot = readStatusRow(a["export-id"]);
    if (slot.status === "not_captured") console.error(`note: slot ${slot.export_id} is still not_captured in the status file; the parser validates the file but does not change the slot`);
    if (slot.raw_file_sha256 && slot.raw_file_sha256.toLowerCase() !== sha256) { console.error(`REJECTED: SHA-256 of ${a.file} (${sha256}) differs from the hash registered for ${slot.export_id} (${slot.raw_file_sha256}); the original export must stay byte-for-byte unchanged`); process.exit(1); }
  }
  const meta = {
    geo: a.geo || (slot && slot.geo) || "", category: a.category || (slot && slot.category) || "",
    search_type: a["search-type"] || (slot && slot.search_type) || "", query_type: a["query-type"] || (slot && slot.query_type) || "",
    source_url: a["source-url"] || (slot && slot.source_url) || "", exported_at_utc: a["exported-at"] || (slot && slot.exported_at_utc) || "",
  };
  const missingMeta = Object.entries(meta).filter(([, v]) => !v).map(([k]) => k);
  const parsed = parseExport(bytes.toString("utf8"));
  const errors = parsed.errors.slice();
  if (missingMeta.length) errors.push(`missing provenance metadata: ${missingMeta.join(", ")} (register the slot or pass the flags)`);
  if (parsed.category && meta.category && !parsed.category.toLowerCase().includes("all categories") && !parsed.category.toLowerCase().includes("todas as categorias") && /cat=0/.test(meta.category)) {
    errors.push(`file category "${parsed.category}" does not match the registered "All categories (cat=0)"`);
  }
  if (slot && parsed.terms && parsed.terms.length) {
    const registered = decodeURIComponent((/[?&]q=([^&]+)/.exec(slot.source_url) || [,""])[1]).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const fileTerms = parsed.terms.map(t => t.label.toLowerCase());
    if (registered.length && (registered.length !== fileTerms.length || registered.some(t => !fileTerms.includes(t)))) errors.push(`terms in file [${fileTerms.join(", ")}] differ from the registered comparison [${registered.join(", ")}]`);
  }
  const report = { file: path.relative(ROOT, filePath), sha256, export_id: slot ? slot.export_id : null, granularity: parsed.granularity || null, category_in_file: parsed.category || null, terms: (parsed.terms || []).map(t => t.raw), points: parsed.series ? parsed.series.length : 0, date_range: parsed.dates && parsed.dates.length ? [parsed.dates[0], parsed.dates[parsed.dates.length - 1]] : null, peak_by_term: parsed.maxByTerm || [], limitations: parsed.limitations, errors, status: errors.length ? "rejected" : "valid" };
  if (a.report) fs.writeFileSync(path.resolve(a.report), JSON.stringify(report, null, 2) + "\n");
  if (errors.length) { console.error("REJECTED " + report.file); errors.forEach(e => console.error(" - " + e)); process.exit(1); }
  const header = ["query_label", "query_type", "query_text", "geo", "region", "category", "search_type", "date_range_start", "date_range_end", "series_date", "interest_index", "exported_at_utc", "source_url", "raw_file_sha256", "notes"];
  const lines = [header.join(",")].concat(parsed.series.map(s => [s.term.label, meta.query_type, s.term.label, meta.geo, s.term.geoLabel || "", meta.category, meta.search_type, parsed.dates[0], parsed.dates[parsed.dates.length - 1], s.date, s.value, meta.exported_at_utc, meta.source_url, sha256, s.lowVolume ? "low volume (<1); not zero" : ""].map(csvCell).join(",")));
  if (a.out) fs.writeFileSync(path.resolve(a.out), lines.join("\n") + "\n");
  console.log(`VALID ${report.file}: ${parsed.terms.length} terms, ${parsed.dates.length} ${parsed.granularity}s (${report.date_range[0]} to ${report.date_range[1]}), ${parsed.series.length} rows${a.out ? ", written to " + a.out : ""}`);
  report.limitations.forEach(l => console.log(" - limitation: " + l));
}

if (require.main === module) main();
module.exports = { parseExport, parseCsv };
