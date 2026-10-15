#!/usr/bin/env node
"use strict";

// Integrity checks for the pre-production Chocolate capture kit.
// Uses only checked-in files and Node built-ins; never downloads or fabricates observations.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = process.cwd();
const KIT = "docs/pilot-chocolate/capture-kit";
const errors = [];
const checks = [];

function parseCsv(text, label) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (quoted) errors.push(`${label}: unterminated quoted CSV field`);
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
  if (!rows.length) { errors.push(`${label}: empty CSV`); return { headers: [], records: [] }; }
  const headers = rows[0];
  if (new Set(headers).size !== headers.length) errors.push(`${label}: duplicate header`);
  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) errors.push(`${label}: row ${index + 2} has ${values.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((key, i) => [key, values[i] ?? ""]));
  });
  return { headers, records };
}

function readCsv(relativePath) {
  const full = path.resolve(ROOT, relativePath);
  if (!full.startsWith(ROOT + path.sep)) {
    errors.push(`${relativePath}: path escapes repository root`);
    return { headers: [], records: [] };
  }
  try { return parseCsv(fs.readFileSync(full, "utf8"), relativePath); }
  catch (error) { errors.push(`${relativePath}: cannot read file (${error.message})`); return { headers: [], records: [] }; }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

// Review rows must point to the exact current bytes of the cited checked-in artifact.
const reviewPath = `${KIT}/public-source-review-2026-10-14.csv`;
const review = readCsv(reviewPath);
if (!review.headers.includes("signal_id") || !review.headers.includes("artifact_path") || !review.headers.includes("artifact_sha256")) {
  errors.push(`${reviewPath}: required provenance columns are missing`);
}
const signalIds = review.records.map(row => row.signal_id).filter(Boolean);
if (new Set(signalIds).size !== signalIds.length) errors.push(`${reviewPath}: duplicate signal_id`);
for (const row of review.records) {
  if (!row.signal_id) continue;
  if (!row.artifact_path || !row.artifact_sha256) {
    errors.push(`${reviewPath}: ${row.signal_id} lacks artifact path or SHA-256`);
    continue;
  }
  const full = path.resolve(ROOT, row.artifact_path);
  if (!full.startsWith(ROOT + path.sep)) {
    errors.push(`${reviewPath}: ${row.signal_id} artifact path escapes repository root`);
    continue;
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    errors.push(`${reviewPath}: ${row.signal_id} artifact does not exist: ${row.artifact_path}`);
    continue;
  }
  if (!/^[a-f0-9]{64}$/i.test(row.artifact_sha256)) {
    errors.push(`${reviewPath}: ${row.signal_id} has invalid SHA-256 format`);
    continue;
  }
  const actual = sha256(full);
  if (actual !== row.artifact_sha256.toLowerCase()) {
    errors.push(`${reviewPath}: ${row.signal_id} hash mismatch for ${row.artifact_path}; recorded=${row.artifact_sha256}, actual=${actual}`);
  }
}
checks.push(`artifact hashes checked for ${review.records.filter(row => row.signal_id).length} signal rows`);

// Structural and identity checks across all supporting capture registers.
const supportingCsvs = [
  { file: "public-source-capture-2026-10-14.csv", id: "capture_id", required: ["source_url", "source_name", "observed_fact"] },
  { file: "public-retail-snapshot-2026-10-14.csv", id: "observation_id", required: ["source_url", "retailer", "observed_price_brl", "review_status"] },
  { file: "public-source-provenance-2026-10-14.csv", id: "source_id", required: ["source_url", "access_method", "source_status"] },
  { file: "product-universe-initial-2026-10-14.csv", id: "product_id", required: ["brand", "product_name", "retailer", "inclusion_status"] },
  { file: "retail-sample-acceptance-2026-10-14.csv", id: "sample_id", required: ["source_url", "overall_row_decision", "notes"] },
];
for (const spec of supportingCsvs) {
  const file = `${KIT}/${spec.file}`;
  const csv = readCsv(file);
  for (const column of [spec.id, ...spec.required]) {
    if (!csv.headers.includes(column)) errors.push(`${file}: required column missing: ${column}`);
  }
  const ids = csv.records.map(row => row[spec.id]).filter(Boolean);
  if (ids.length !== csv.records.length) errors.push(`${file}: blank ${spec.id} value`);
  if (new Set(ids).size !== ids.length) errors.push(`${file}: duplicate ${spec.id}`);
  for (const [index, row] of csv.records.entries()) {
    if (row.source_url && !(row.source_url.startsWith("https://") || row.source_url.startsWith("http://"))) {
      errors.push(`${file}: row ${index + 2} has a non-HTTP source_url`);
    }
  }
  if (spec.file === "product-universe-initial-2026-10-14.csv") {
    for (const [index, row] of csv.records.entries()) {
      if (row.inclusion_status !== "exploratory_only") errors.push(`${file}: row ${index + 2} must remain exploratory_only until QA`);
    }
  }
  if (spec.file === "retail-sample-acceptance-2026-10-14.csv") {
    for (const [index, row] of csv.records.entries()) {
      if (row.overall_row_decision !== "exploratory_only") errors.push(`${file}: row ${index + 2} must not pass baseline acceptance without completed QA`);
    }
  }
}
checks.push(`five supporting CSV registers checked for structure, unique identities and exploratory-only status`);

// Uncaptured Trends slots must never masquerade as zero/empty search interest or a completed export.
const trendsPath = `${KIT}/trends-export-status-2026-10-15.csv`;
const trends = readCsv(trendsPath);
const requiredIds = ["GT-CHOC-A-5Y", "GT-CHOC-A-12M", "GT-CHOC-B-5Y", "GT-CHOC-B-12M"];
const trendById = new Map(trends.records.map(row => [row.export_id, row]));
if (trends.records.length !== requiredIds.length) errors.push(`${trendsPath}: expected exactly ${requiredIds.length} registered export slots`);
for (const id of requiredIds) {
  const row = trendById.get(id);
  if (!row) { errors.push(`${trendsPath}: missing required export slot ${id}`); continue; }
  if (row.geo !== "BR" || row.search_type !== "Web Search" || row.query_type !== "Search term") {
    errors.push(`${trendsPath}: ${id} has unexpected geography/search configuration`);
  }
  if (row.status === "not_captured") {
    if (row.exported_at_utc || row.raw_filename || row.raw_file_sha256) {
      errors.push(`${trendsPath}: ${id} is not_captured but contains export metadata`);
    }
    if (row.qa_status !== "not_started") errors.push(`${trendsPath}: ${id} is not_captured but QA is not not_started`);
  } else {
    if (!row.exported_at_utc || !row.raw_filename || !/^[a-f0-9]{64}$/i.test(row.raw_file_sha256 || "")) {
      errors.push(`${trendsPath}: ${id} is marked ${row.status} without timestamp, filename and SHA-256`);
    } else {
      const full = path.resolve(ROOT, KIT, row.raw_filename);
      if (!full.startsWith(path.resolve(ROOT, KIT) + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
        errors.push(`${trendsPath}: ${id} raw export is not present inside the capture kit`);
      } else if (sha256(full) !== row.raw_file_sha256.toLowerCase()) {
        errors.push(`${trendsPath}: ${id} raw export SHA-256 does not match file bytes`);
      }
    }
  }
}
checks.push(`four registered Google Trends slots checked without fabricating missing exports`);

if (errors.length) {
  console.error("Chocolate capture-kit integrity FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Chocolate capture-kit integrity passed:");
for (const check of checks) console.log(`- ${check}`);
