#!/usr/bin/env node
"use strict";
/* Owner's rule (2026-11-20, 2026-11-23): the product is the same for every category; a category exists only as
   configuration (the CATEGORIES registry in pulse-shopper-map.js, pilots.json and each pilot.json, the
   industries.signal_topic_terms column) and as data (evidence, captures, pages of a pilot). This test fails when a
   file that holds logic names a registered category or the folder of a pilot. To add logic, keep the category in
   the configuration and pass it in. */
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
global.window = {};
const S = require(path.join(ROOT, "pulse-shopper-map.js"));
const { loadPilots } = require(path.join(ROOT, "scripts/lib/pilot-config.js"));

const LOGIC_FILES = [
  "pulse-workspace-v3.js", "ask.html",
  "scripts/pilot-autonomy.js", "scripts/lib/pilot-config.js", "scripts/lib/pilot_config.py", "scripts/lib/pilot-price-index.js",
  "scripts/capture-economiza-alagoas.py", "scripts/trends-term-screen.js", "scripts/parse-google-trends-export.js",
  "scripts/test-pilot-capture-kit-integrity.js",
  "supabase/functions/pulse-external-signal-worker/index.ts", "supabase/functions/pulse-external-signal-worker/quality.mjs",
  "supabase/functions/pulse-external-deterministic-backstop/index.ts", "supabase/functions/pulse-external-deterministic-backstop/quality.mjs",
  "supabase/functions/pulse-external-deterministic-backstop/conversation.mjs", "supabase/functions/pulse-external-source-worker/social.mjs", "supabase/functions/pulse-external-source-worker/extract.mjs",
  "supabase/functions/pulse-external-source-worker/index.ts",
  "supabase/functions/pulse-ask-ai/index.ts", "supabase/functions/pulse-ask-ai/layers.mjs",
];
const plain = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = new Set();
for (const c of S.CATEGORIES) { words.add(plain(c.key)); words.add(plain(c.label)); }
const pilots = loadPilots(ROOT);
for (const p of pilots) { words.add(plain(p.key)); words.add(plain(p.label)); }
const folders = pilots.map(p => p.kit.split("/").slice(0, 2).join("/"));

const failures = [];
for (const rel of LOGIC_FILES) {
  const text = plain(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  for (const w of words) if (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text)) failures.push(`${rel} names the category "${w}"`);
  for (const f of folders) if (text.includes(plain(f))) failures.push(`${rel} names the pilot folder ${f}`);
}
if (failures.length) { console.error("No fixed category: FAIL"); for (const f of failures) console.error(" - " + f); process.exit(1); }
console.log(`No fixed category: PASS (${LOGIC_FILES.length} logic files; categories and pilots only in configuration: ${[...words].join(", ")})`);
