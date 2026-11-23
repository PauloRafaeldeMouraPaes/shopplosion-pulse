"use strict";
/* Category pilots. A pilot is the weekly capture and rule set of one product category. Everything that is specific
   to a category lives in its configuration file (pilots.json lists them); the scripts are the same for every
   category and take the pilot as a parameter. To add a pilot: create its pilot.json and add the path to pilots.json. */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const REQUIRED = ["key", "label", "kit", "status_file", "prices_file", "page", "status_title", "nfce", "retail", "trends", "price_index"];

function validatePilot(pilot) {
  const errors = [];
  for (const f of REQUIRED) if (pilot[f] === undefined || pilot[f] === null || pilot[f] === "") errors.push(`missing ${f}`);
  if (errors.length) return errors;
  if (!/^[a-z][a-z0-9-]*$/.test(pilot.key)) errors.push("key must be lower case letters, digits or hyphen");
  for (const f of ["source", "scope", "terms_file", "keep_pattern", "drop_pattern"]) if (!pilot.nfce[f]) errors.push(`missing nfce.${f}`);
  for (const f of ["keep_pattern", "drop_pattern"]) { try { new RegExp(pilot.nfce[f], "i"); } catch (e) { errors.push(`nfce.${f} is not a valid pattern`); } }
  if (!Array.isArray(pilot.retail.name_stopwords)) errors.push("retail.name_stopwords must be a list");
  if (!pilot.trends.status_file || !Array.isArray(pilot.trends.required_exports)) errors.push("trends needs status_file and required_exports");
  const cal = pilot.trends.seasonal_calendar;
  if (!cal || !cal.anchor || !cal.anchor.name || !Array.isArray(cal.peak_windows) || !Array.isArray(cal.band)) errors.push("trends.seasonal_calendar needs anchor, peak_windows and band");
  else for (const e of [cal.anchor, ...cal.peak_windows, ...cal.band]) if (!(e.event === "easter" || (e.event === "date" && e.month >= 1 && e.month <= 12 && e.day >= 1 && e.day <= 31))) errors.push(`seasonal_calendar: unknown event ${JSON.stringify(e)}`);
  const b = pilot.price_index.benchmark;
  if (!b || !b.label || !(b.minGrams > 0) || !(b.maxGrams >= b.minGrams) || !(b.minObservations > 0)) errors.push("price_index.benchmark needs label, minGrams, maxGrams and minObservations");
  if (!Array.isArray(pilot.price_index.brand_rules)) errors.push("price_index.brand_rules must be a list");
  else for (const r of pilot.price_index.brand_rules) { try { if (!Array.isArray(r) || r.length !== 3 || !r[1] || !r[2]) throw new Error(); new RegExp(r[0]); } catch (e) { errors.push(`price_index.brand_rules: invalid rule ${JSON.stringify(r)}`); } }
  return errors;
}

function loadPilots(root = ROOT) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, "pilots.json"), "utf8"));
  const pilots = (registry.pilots || []).map(p => ({ ...JSON.parse(fs.readFileSync(path.join(root, p), "utf8")), config_path: p }));
  const seen = new Set();
  for (const p of pilots) {
    const errors = validatePilot(p);
    if (errors.length) throw new Error(`${p.config_path}: ${errors.join("; ")}`);
    if (seen.has(p.key)) throw new Error(`pilots.json: duplicate pilot ${p.key}`);
    seen.add(p.key);
  }
  return pilots;
}

// The pilot named by --pilot; with a single registered pilot the argument may be left out.
function getPilot(key, root = ROOT) {
  const pilots = loadPilots(root);
  if (!key) { if (pilots.length === 1) return pilots[0]; throw new Error(`--pilot <key> is required; registered: ${pilots.map(p => p.key).join(", ")}`); }
  const pilot = pilots.find(p => p.key === key);
  if (!pilot) throw new Error(`unknown pilot ${key}; registered: ${pilots.map(p => p.key).join(", ")}`);
  return pilot;
}
const pilotArg = argv => { const i = argv.indexOf("--pilot"); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null; };

// The profile scripts/lib/pilot-price-index.js needs, built from the configuration of the pilot.
function priceProfile(pilot, generatedBy) {
  return { key: pilot.key, label: pilot.label, generatedBy: generatedBy || "", benchmark: pilot.price_index.benchmark,
    brandRules: pilot.price_index.brand_rules.map(([source, brand, manufacturer]) => [new RegExp(source), brand, manufacturer]) };
}

module.exports = { ROOT, loadPilots, getPilot, pilotArg, priceProfile, validatePilot };
