const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const failures = [];

function balancedSpan(text, start, open, close) {
  let depth = 0, quote = null, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    if (c === close) { depth--; if (depth === 0) return [start, i + 1]; }
  }
  throw new Error(`Unclosed ${open}${close} span`);
}

function extractAssignedArray(marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${marker} not found`);
  const start = html.indexOf('[', markerIndex);
  if (start < 0) throw new Error(`${marker} array not found`);
  const [a, b] = balancedSpan(html, start, '[', ']');
  return vm.runInNewContext(html.slice(a, b));
}

let evidence;
let sources;
try {
  evidence = extractAssignedArray('window.PULSE_EVIDENCE');
  sources = extractAssignedArray('window.PULSE_SOURCES');
} catch (err) {
  console.error(`Pulse data integrity FAILED: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(evidence) || evidence.length === 0) failures.push('PULSE_EVIDENCE must be a non-empty array');
if (!Array.isArray(sources) || sources.length === 0) failures.push('PULSE_SOURCES must be a non-empty array');

const allowedCategories = new Set(['chocolates', 'bebidas', 'higiene', 'geral']);
const evidenceIds = new Set();
const sourceOrgs = new Set(sources.map(s => s && s.org).filter(Boolean));

for (const item of evidence || []) {
  if (!item || typeof item !== 'object') { failures.push('PULSE_EVIDENCE contains a non-object item'); continue; }
  if (!item.id) failures.push('evidence item missing id');
  else if (evidenceIds.has(item.id)) failures.push(`duplicate evidence id: ${item.id}`);
  else evidenceIds.add(item.id);

  for (const field of ['categoria', 'proxima_revisao', 'proxima_revisao_iso', 'keywords', 'fato', 'contexto', 'interpretacao', 'hipotese', 'acao', 'fonte', 'periodo', 'confianca']) {
    if (item[field] === undefined || item[field] === null || item[field] === '') failures.push(`${item.id || '<unknown>'}: missing ${field}`);
  }

  if (item.categoria && !allowedCategories.has(item.categoria)) failures.push(`${item.id}: unsupported categoria ${item.categoria}`);
  if (!Array.isArray(item.keywords) || item.keywords.length < 3) failures.push(`${item.id}: insufficient keywords`);
  if (item.proxima_revisao_iso && !/^\\d{4}-\\d{2}-\\d{2}$/.test(item.proxima_revisao_iso)) failures.push(`${item.id}: invalid proxima_revisao_iso`);
  if (item.proxima_revisao_iso && Number.isNaN(Date.parse(`${item.proxima_revisao_iso}T00:00:00Z`))) failures.push(`${item.id}: unparseable proxima_revisao_iso`);
  if (item.fonte && !sourceOrgs.has(item.fonte)) failures.push(`${item.id}: fonte not represented in PULSE_SOURCES: ${item.fonte}`);
}

const sourceKeys = new Set();
for (const source of sources || []) {
  if (!source || typeof source !== 'object') { failures.push('PULSE_SOURCES contains a non-object item'); continue; }
  for (const field of ['org', 'title', 'date', 'url']) {
    if (!source[field]) failures.push(`source missing ${field}`);
  }
  const key = `${source.org}|${source.title}`;
  if (sourceKeys.has(key)) failures.push(`duplicate source: ${key}`);
  sourceKeys.add(key);
  if (source.url && !/^https?:\\/\\//i.test(source.url)) failures.push(`source has invalid URL: ${source.url}`);
}

if (evidenceIds.size < 10) failures.push(`expected at least 10 evidence items, found ${evidenceIds.size}`);

const scriptIds = [...html.matchAll(/<script\\b[^>]*\\bid=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
const seenScriptIds = new Set();
for (const id of scriptIds) {
  if (seenScriptIds.has(id)) failures.push(`duplicate script id: ${id}`);
  seenScriptIds.add(id);
}

if (failures.length) {
  console.error('Pulse data integrity FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log(`Pulse data integrity PASSED (${evidence.length} evidence items, ${sources.length} sources, ${scriptIds.length} identified script ids)`);
