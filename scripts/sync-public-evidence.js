#!/usr/bin/env node
"use strict";
/* Keeps the three public evidence layers identical from one canonical source.

   The canonical array is the JSON embedded in index.html (<script id="pulse-public-evidence-json">). This script
   regenerates pulse-public-evidence.js (compact, for lightweight consumers) and
   supabase/functions/pulse-ask-ai/public-evidence.ts (pretty, for the Edge Function) from it, byte for byte in the
   formats CI already enforces (scripts/test-pulse-ask-ai.js). It can also add items first:

     node scripts/sync-public-evidence.js                      # regenerate the two mirrors from index.html
     node scripts/sync-public-evidence.js --add items.json     # append the items of a JSON array (ids must be new), then regenerate
     node scripts/sync-public-evidence.js --add-source src.json # append PULSE_SOURCES entries (ids and org|title must be new)
     node scripts/sync-public-evidence.js --check              # exit 1 when a mirror differs from what would be generated

   Nothing here invents content: an item is written exactly as given, and the data-integrity and Ask AI tests still
   decide whether it is acceptable (required fields, source URL present in PULSE_SOURCES, parity). */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const INDEX = path.join(ROOT, "index.html");
const JS = path.join(ROOT, "pulse-public-evidence.js");
const TS = path.join(ROOT, "supabase/functions/pulse-ask-ai/public-evidence.ts");
const MARKER = '<script type="application/json" id="pulse-public-evidence-json">';

function readIndex() {
  const html = fs.readFileSync(INDEX, "utf8");
  const m = html.indexOf(MARKER); if (m < 0) throw new Error("index.html: public evidence JSON block not found");
  const start = html.indexOf(">", m) + 1; const end = html.indexOf("</script>", start);
  return { html, start, end, evidence: JSON.parse(html.slice(start, end)) };
}
function readSources(html) {
  const key = "window.PULSE_SOURCES = "; const s = html.indexOf(key); if (s < 0) throw new Error("index.html: PULSE_SOURCES not found");
  const start = s + key.length; const end = html.indexOf("];</script>", start) + 1;
  return { start, end, sources: JSON.parse(html.slice(start, end)) };
}
const compact = arr => JSON.stringify(arr);
const jsText = arr => `/* Public Pulse evidence dataset: extracted from index.html for lightweight consumers. */\nwindow.PULSE_EVIDENCE=${compact(arr)};\n`;
const tsText = arr => `// Generated from pulse-public-evidence.js; CI enforces exact synchronization.\nexport const PULSE_PUBLIC_EVIDENCE = ${JSON.stringify(arr, null, 2)} as const;\n`;

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
let { html, start, end, evidence } = readIndex();

if (opt("--add-source")) {
  const extra = JSON.parse(fs.readFileSync(path.resolve(opt("--add-source")), "utf8"));
  const { start: s0, end: e0, sources } = readSources(html);
  for (const src of extra) {
    if (sources.some(x => x.id === src.id)) throw new Error(`source id already exists: ${src.id}`);
    if (sources.some(x => x.org === src.org && x.title === src.title)) throw new Error(`source already exists: ${src.org} | ${src.title}`);
    sources.push(src);
  }
  html = html.slice(0, s0) + compact(sources) + html.slice(e0);
  const m = html.indexOf(MARKER); start = html.indexOf(">", m) + 1; end = html.indexOf("</script>", start);
  console.log(`PULSE_SOURCES: ${extra.length} source(s) added (${sources.length} total)`);
}
if (opt("--add")) {
  const extra = JSON.parse(fs.readFileSync(path.resolve(opt("--add")), "utf8"));
  for (const item of extra) {
    if (!item.id) throw new Error("item without id");
    if (evidence.some(x => x.id === item.id)) throw new Error(`evidence id already exists: ${item.id}`);
    evidence.push(item);
  }
  console.log(`public evidence: ${extra.length} item(s) added (${evidence.length} total)`);
}

const newHtml = html.slice(0, start) + compact(evidence) + html.slice(end);
const expectedJs = jsText(evidence), expectedTs = tsText(evidence);
if (args.includes("--check")) {
  const bad = [];
  if (fs.readFileSync(JS, "utf8") !== expectedJs) bad.push("pulse-public-evidence.js");
  if (fs.readFileSync(TS, "utf8") !== expectedTs) bad.push("supabase/functions/pulse-ask-ai/public-evidence.ts");
  console.log(bad.length ? `mirrors out of sync: ${bad.join(", ")}` : `three layers in sync (${evidence.length} items)`);
  process.exit(bad.length ? 1 : 0);
}
if (newHtml !== fs.readFileSync(INDEX, "utf8")) fs.writeFileSync(INDEX, newHtml);
fs.writeFileSync(JS, expectedJs);
fs.writeFileSync(TS, expectedTs);
console.log(`three layers written (${evidence.length} items)`);
