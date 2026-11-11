#!/usr/bin/env node
"use strict";
/* Chocolate pilot autonomy rules, version 1 (docs/pilot-chocolate/capture-kit/autonomy-rules-v1.md).

   The pilot was first designed with a human "accept" at every gate. On 2026-11-04 Paulo decided the Pulse must run
   without him validating each step, so the gates became rules applied by this script. It reads only checked-in
   files, never downloads anything, and changes exactly three kinds of row:

   1. Google Trends slots (trends-export-status-2026-10-15.csv) with qa_status = pending_review: the slot becomes
      auto_accepted when the parser says VALID for the registered slot and the term screen runs; any FLAGGED term is
      copied into the notes as a limitation (a flag is information, not a rejection). A parser rejection or a missing
      file makes the slot an exception.
   2. Signal review rows (public-source-review-*.csv and weekly-signal-review-*.csv) with decision =
      pending_human_decision: the decision follows the first rule that matches, in this order:
        R1 hypothesis starts with "Unexplained"            -> follow_up_required (exception, 14 days to find a dated explanation)
        R2 hypothesis starts with "Explained" or "Context" -> context_only
        R3 single_source_preliminary = true                 -> preliminary_only
        R4 corroborated and confidence = high               -> consolidated
        R5 corroborated and confidence medium or low        -> preliminary_only
      Rows decided before the rules existed (reviewer = unassigned) keep their decision and are ratified, so the
      first review is not rewritten after the fact.
   3. Retail observations (public-retail-snapshot-*.csv) with review_status = preliminary: a row becomes accepted
      when the same URL was captured again at least 7 days apart with the same net weight and a matching product name
      (the kit's reproducibility rule); the two rows reference each other in reviewer_notes.

   Everything else is reporting: AUTONOMY_STATUS.md carries the computed state of every gate and the exception queue,
   which is the only thing a person is asked to look at. Idempotent: a second run changes nothing.

   Usage: node scripts/chocolate-pilot-autonomy.js [--check] [--today YYYY-MM-DD]
     --check  write nothing; exit 1 when a pending row is older than 7 days, a decided row contradicts the rules,
              or AUTONOMY_STATUS.md is stale (CI mode). */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const ROOT = process.cwd();
const KIT = "docs/pilot-chocolate/capture-kit";
const RULES_VERSION = "auto-rule v1";
const DAY = 86400000;

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const todayArg = args[args.indexOf("--today") + 1];
const TODAY = args.includes("--today") && /^\d{4}-\d{2}-\d{2}$/.test(todayArg || "") ? todayArg : new Date().toISOString().slice(0, 10);

// ---------- CSV helpers (same conventions as the integrity test; writes keep the file's own line ending) ----------
function parseCsv(text) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') quoted = false; else field += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift() || [];
  const records = rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== "")).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return { headers, records, eol: /\r\n/.test(text) ? "\r\n" : "\n" };
}
function quote(v) { v = v == null ? "" : String(v); return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function writeCsv(rel, csv) {
  const text = [csv.headers.join(","), ...csv.records.map(r => csv.headers.map(h => quote(r[h])).join(","))].join(csv.eol) + csv.eol;
  fs.writeFileSync(path.resolve(ROOT, rel), text);
}
function readCsv(rel) { return parseCsv(fs.readFileSync(path.resolve(ROOT, rel), "utf8")); }
function listKit(re) { return fs.readdirSync(path.resolve(ROOT, KIT)).filter(f => re.test(f)).sort(); }
const sha256 = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

const changes = []; const exceptions = []; const notes = [];
function change(file, what) { changes.push(`${file}: ${what}`); }
function exception(where, what, action) { exceptions.push({ where, what, action }); }

// ---------- 1. Google Trends slots ----------
const trendsFile = `${KIT}/trends-export-status-2026-10-15.csv`;
const trends = readCsv(trendsFile);
let trendsDirty = false;
for (const row of trends.records) {
  if (row.status === "captured" && row.qa_status === "pending_review") {
    const file = path.resolve(ROOT, KIT, row.raw_filename || "");
    if (!row.raw_filename || !fs.existsSync(file)) { exception(`${trendsFile} ${row.export_id}`, "raw export file missing", "re-capture the slot"); continue; }
    const parser = spawnSync(process.execPath, ["scripts/parse-google-trends-export.js", "--export-id", row.export_id, "--file", file, "--exported-at", row.exported_at_utc], { encoding: "utf8", cwd: ROOT });
    const valid = parser.status === 0 && /VALID/.test(parser.stdout + parser.stderr);
    if (!valid) { exception(`${trendsFile} ${row.export_id}`, "parser rejected the export: " + (parser.stdout + parser.stderr).split("\n").filter(l => /REJECTED|error/i.test(l)).join(" | ").slice(0, 300), "fix the capture or the registration before anything else uses it"); continue; }
    const screen = spawnSync(process.execPath, ["scripts/trends-term-screen.js", "--file", file, "--exported-at", row.exported_at_utc], { encoding: "utf8", cwd: ROOT });
    if (screen.status !== 0) { exception(`${trendsFile} ${row.export_id}`, "term screen could not run: " + (screen.stdout + screen.stderr).slice(0, 200), "inspect the file"); continue; }
    const flagged = (screen.stdout.match(/^\s*FLAGGED\s+(.+)$/gm) || []).map(l => l.replace(/^\s*FLAGGED\s+/, "").trim());
    row.qa_status = "auto_accepted";
    row.notes = (row.notes ? row.notes + " " : "") + `${RULES_VERSION} on ${TODAY}: parser VALID; screen ${flagged.length ? "FLAGGED " + flagged.length + " term(s): " + flagged.join("; ") : "PASS for every term"}.`;
    trendsDirty = true; change(trendsFile, `${row.export_id} -> auto_accepted${flagged.length ? " with " + flagged.length + " flagged term(s)" : ""}`);
  }
}

// ---------- 2. Signal review rows ----------
function decide(row) {
  const h = (row.hypothesis || "").trim();
  if (/^Unexplained\b/i.test(h)) return { decision: "follow_up_required", rule: "R1 unexplained observation" };
  if (/^(Explained|Context)\b/i.test(h)) return { decision: "context_only", rule: "R2 explained or context" };
  const single = String(row.single_source_preliminary).trim().toLowerCase();
  if (single === "true") return { decision: "preliminary_only", rule: "R3 single source" };
  if (single !== "false") return null;
  const c = (row.confidence || "").trim().toLowerCase();
  if (c === "high") return { decision: "consolidated", rule: "R4 corroborated, high confidence" };
  if (c === "medium" || c === "low") return { decision: "preliminary_only", rule: "R5 corroborated, confidence " + c };
  return null;
}
const reviewFiles = [...listKit(/^public-source-review-\d{4}-\d{2}-\d{2}\.csv$/), ...listKit(/^weekly-signal-review-\d{4}-\d{2}-\d{2}\.csv$/)];
const decisionCounts = {}; const reviewRows = [];
for (const file of reviewFiles) {
  const rel = `${KIT}/${file}`; const csv = readCsv(rel); let dirty = false;
  for (const row of csv.records) {
    if (!row.signal_id) continue;
    reviewRows.push({ file, row });
    const pending = row.decision === "pending_human_decision" || row.decision === "";
    if (pending) {
      const d = decide(row);
      if (!d) { exception(`${rel} ${row.signal_id}`, "row cannot be decided by the rules (confidence or single_source_preliminary not set)", "complete the row"); continue; }
      const weekEnd = Date.parse((row.review_week_end || TODAY) + "T00:00:00Z");
      row.decision = d.decision; row.reviewer = RULES_VERSION;
      row.decision_rationale = `[${RULES_VERSION} on ${TODAY}: ${d.rule}] ` + (row.decision_rationale || "");
      if (d.decision === "follow_up_required") {
        row.follow_up_owner = row.follow_up_owner || "autonomy-agent";
        row.follow_up_due_utc = new Date(weekEnd + 14 * DAY).toISOString().slice(0, 10);
      }
      dirty = true; change(rel, `${row.signal_id} -> ${d.decision} (${d.rule})`);
    } else if ((row.reviewer || "").trim() === "unassigned") {
      const d = decide(row);
      row.reviewer = `${RULES_VERSION} (ratified legacy decision)`;
      row.decision_rationale = `[${RULES_VERSION} on ${TODAY}: legacy decision ${row.decision} kept${d && d.decision !== row.decision ? "; the rules alone would say " + d.decision : ""}] ` + (row.decision_rationale || "");
      dirty = true; change(rel, `${row.signal_id} legacy decision ${row.decision} ratified`);
    } else if (CHECK && !/\(ratified legacy decision\)/.test(row.reviewer || "") && (row.reviewer || "").startsWith(RULES_VERSION)) {
      const d = decide(row);
      if (d && d.decision !== row.decision) exception(`${rel} ${row.signal_id}`, `decision ${row.decision} contradicts the rules (${d.rule} -> ${d.decision})`, "re-run the autonomy script without --check");
    }
    // Overdue follow-ups are exceptions whoever owns them.
    if (row.decision === "follow_up_required" && row.follow_up_due_utc && Date.parse(row.follow_up_due_utc + "T00:00:00Z") < Date.parse(TODAY + "T00:00:00Z")) {
      exception(`${rel} ${row.signal_id}`, `follow-up due ${row.follow_up_due_utc} is overdue (owner ${row.follow_up_owner || "none"})`, "find a dated explanation or close the row as context_only with the reason");
    }
    if (CHECK && (row.decision === "pending_human_decision" || row.decision === "")) {
      const weekEnd = Date.parse((row.review_week_end || TODAY) + "T00:00:00Z");
      if (Date.parse(TODAY + "T00:00:00Z") - weekEnd > 7 * DAY) exception(`${rel} ${row.signal_id}`, "still pending more than 7 days after the review week", "run the autonomy script");
    }
  }
  if (dirty && !CHECK) writeCsv(rel, csv);
  for (const row of csv.records) if (row.signal_id) decisionCounts[row.decision || "(blank)"] = (decisionCounts[row.decision || "(blank)"] || 0) + 1;
}

// ---------- 3. Retail reproducibility ----------
const retailFiles = listKit(/^public-retail-snapshot-\d{4}-\d{2}-\d{2}\.csv$/);
const retail = retailFiles.map(f => ({ rel: `${KIT}/${f}`, csv: readCsv(`${KIT}/${f}`), dirty: false }));
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%]+/g, " ").trim();
// Product identity across captures: same net weight and brand, and the name tokens of one capture contain the
// other's or overlap by at least 60% (retailers add or drop words such as "Pacote" or "Ao Leite" between visits).
const tokens = s => new Set(norm(s).split(" ").filter(t => t && !["pacote", "barra", "tablete", "chocolate", "de", "com"].includes(t)));
const sameProduct = (a, b) => {
  if ((a.net_weight_g || "") !== (b.net_weight_g || "") || norm(a.brand) !== norm(b.brand)) return false;
  const ta = tokens(a.product_name), tb = tokens(b.product_name);
  const inter = [...ta].filter(t => tb.has(t)).length;
  return inter === ta.size || inter === tb.size || inter / new Set([...ta, ...tb]).size >= 0.6;
};
// Files cited as artifacts by any review row are frozen (their SHA-256 is recorded), so the rules never rewrite them;
// the later capture carries the acceptance and names the earlier row.
const frozen = new Set();
for (const file of reviewFiles) for (const row of readCsv(`${KIT}/${file}`).records) for (const p of (row.artifact_path || "").split(";")) if (p.trim()) frozen.add(path.resolve(ROOT, p.trim()));
const byUrl = new Map();
for (const f of retail) for (const row of f.csv.records) { if (!row.source_url) continue; const k = row.source_url.trim(); if (!byUrl.has(k)) byUrl.set(k, []); byUrl.get(k).push({ f, row }); }
let retailListings = 0, retailReproduced = 0, retailWithEan = 0; const retailers = new Set();
for (const [url, obs] of byUrl) {
  retailListings++; retailers.add(obs[0].row.retailer); if (obs.some(o => (o.row.ean || "").trim())) retailWithEan++;
  if (obs.length < 2) continue;
  obs.sort((a, b) => a.row.observed_at_utc.localeCompare(b.row.observed_at_utc));
  const first = obs[0], last = obs[obs.length - 1];
  const gap = (Date.parse(last.row.observed_at_utc.slice(0, 10)) - Date.parse(first.row.observed_at_utc.slice(0, 10))) / DAY;
  const same = sameProduct(first.row, last.row);
  if (gap >= 7 && same) {
    retailReproduced++;
    for (const o of obs) if (o.row.review_status === "preliminary") {
      if (frozen.has(path.resolve(ROOT, o.f.rel))) continue; // hashed by a review row: stays as captured
      o.row.review_status = "accepted";
      o.row.reviewer_notes = (o.row.reviewer_notes ? o.row.reviewer_notes + " " : "") + `${RULES_VERSION} on ${TODAY}: identity reproduced at the same URL on ${obs.map(x => x.row.observation_id + " (" + x.row.observed_at_utc.slice(0, 10) + ")").join(" and ")}, same brand and weight, matching name; price fields are observations of their own day, never a series.`;
      o.f.dirty = true; change(o.f.rel, `${o.row.observation_id} -> accepted (reproduced)`);
    }
  } else if (obs.length >= 2 && !same) {
    exception(`retail ${url}`, `the listing changed identity between captures (${first.row.product_name} ${first.row.net_weight_g}g vs ${last.row.product_name} ${last.row.net_weight_g}g)`, "register the new product as a new listing and keep the old rows preliminary");
  }
}
if (!CHECK) for (const f of retail) if (f.dirty) writeCsv(f.rel, f.csv);
if (!CHECK && trendsDirty) writeCsv(trendsFile, trends);

// ---------- 3b. NFC-e transacted prices with EAN (Economiza Alagoas, SEFAZ/AL) ----------
// Weekly gzipped captures written by scripts/capture-economiza-alagoas.py. Only file contents count, never the date
// of the run, so the status page stays reproducible in CI.
const zlib = require("node:zlib");
const nfce = fs.readdirSync(path.resolve(ROOT, KIT)).filter(f => /^economiza-alagoas-\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(f)).sort().map(f => {
  const text = zlib.gunzipSync(fs.readFileSync(path.resolve(ROOT, KIT, f))).toString("utf8");
  const records = parseCsv(text).records;
  const eans = new Set(records.map(r => (r.gtin || "").trim()).filter(Boolean));
  const places = new Set(records.map(r => (r.municipio_bairro_cep || "").split(",")[0].trim()).filter(Boolean));
  const day = f.slice(18, 28); const d = new Date(day + "T00:00:00Z"); const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
  return { f, day, monday, rows: records.length, eans: eans.size, places: [...places].sort() };
});
const nfceWeeks = [...new Set(nfce.map(c => c.monday))].sort();
const nfceLast = nfce[nfce.length - 1];
const BASELINE_WEEKS = 4;

// ---------- 4. Gate evaluation and status page ----------
const provenance = readCsv(`${KIT}/public-source-provenance-2026-10-14.csv`);
const provGaps = provenance.records.filter(r => /not located|not reviewed|not reachable|not opened/i.test(r.access_or_license_basis || "")).length;
const slotCounts = {}; for (const r of trends.records) slotCounts[`${r.status}/${r.qa_status}`] = (slotCounts[`${r.status}/${r.qa_status}`] || 0) + 1;
const testsManifest = fs.existsSync(path.resolve(ROOT, KIT, "tests/trends-test-views-2026-11-04.csv")) ? readCsv(`${KIT}/tests/trends-test-views-2026-11-04.csv`).records.filter(r => /^Reproducibility/i.test(r.purpose)) : [];
const trendsRepeat = testsManifest.map(r => `${r.file.replace(/^tests\//, "")}: ${r.outcome}`);
const gates = [
  ["Source provenance", provGaps === 0 ? "documented" : `documented with ${provGaps} source(s) at citation-and-summary use only (terms not located, not reachable or not reviewed)`],
  ["Google Trends capture", Object.entries(slotCounts).map(([k, v]) => `${v} ${k}`).join(", ") || "no slots"],
  ["Retail coverage", `Retail pages: ${retailListings} listing(s) at ${retailers.size} retailer(s); ${retailWithEan} with EAN; ${retailReproduced} reproduced. ` +
    (nfceLast ? `NFC-e prices with EAN (Economiza Alagoas): ${nfce.length} weekly capture(s); latest ${nfceLast.day}: ${nfceLast.rows} observation(s), ${nfceLast.eans} EAN, municipality ${nfceLast.places.join(", ") || "not parsed"}. Coverage by EAN x store is documented for that municipality only, not for Brazil.` : "No source exposes an EAN yet, so coverage by EAN x store cannot be documented")],
  ["Reproducibility", `Trends: ${trendsRepeat.length ? trendsRepeat.join("; ") : "no repeat export recorded"}. Retail: ${retailReproduced} of ${retailListings} listing(s) reproduced at least 7 days apart`],
  ["Signal review (rules v1)", Object.entries(decisionCounts).map(([k, v]) => `${v} ${k}`).join(", ") || "no rows"],
  ["Baseline", !nfceLast && retailWithEan === 0 ? "not_started: retail coverage gate open (EAN)"
    : nfceWeeks.length < BASELINE_WEEKS ? `collecting: ${nfceWeeks.length} of ${BASELINE_WEEKS} weekly NFC-e captures (weeks of ${nfceWeeks.join(", ")})`
    : `started on NFC-e prices (${nfceLast.places.join(", ")}): ${nfceWeeks.length} weekly captures since the week of ${nfceWeeks[0]}`],
];
const status = [
  `# Chocolate pilot: autonomy status (${RULES_VERSION}, computed ${TODAY})`, "",
  "Generated by `scripts/chocolate-pilot-autonomy.js`. Rules: `autonomy-rules-v1.md`. Nothing here waits for a person except the exception queue.", "",
  "## Gates (computed)", "", "| Gate | State |", "|---|---|", ...gates.map(([g, s]) => `| ${g} | ${s} |`), "",
  "## Exception queue", "",
  ...(exceptions.length ? ["| Where | What | Action |", "|---|---|---|", ...exceptions.map(e => `| ${e.where} | ${e.what} | ${e.action} |`)] : ["(empty)"]), "",
  "## Last run", "", ...(changes.length ? changes.map(c => `- ${c}`) : ["- no changes"]), "",
].join("\n");
const statusPath = path.resolve(ROOT, KIT, "AUTONOMY_STATUS.md");
if (CHECK) {
  const current = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, "utf8") : "";
  const strip = s => s.replace(/computed \d{4}-\d{2}-\d{2}/, "").replace(/## Last run[\s\S]*$/, "");
  if (strip(current) !== strip(status)) exception(`${KIT}/AUTONOMY_STATUS.md`, "status page is stale", "run the autonomy script and commit the result");
  const hard = exceptions.filter(e => /stale|contradicts|still pending/.test(e.what));
  console.log(`autonomy check: ${hard.length ? "FAILED" : "OK"}; ${exceptions.length} queued exception(s)`);
  for (const e of exceptions) console.log(`  - ${e.where}: ${e.what}`);
  process.exit(hard.length ? 1 : 0);
}
fs.writeFileSync(statusPath, status);
console.log(`autonomy run (${TODAY}): ${changes.length} change(s), ${exceptions.length} exception(s) queued`);
for (const c of changes) console.log(`  - ${c}`);
for (const e of exceptions) console.log(`  ! ${e.where}: ${e.what}`);
