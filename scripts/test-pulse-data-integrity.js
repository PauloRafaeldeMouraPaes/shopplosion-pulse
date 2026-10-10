const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const failures = [];
const warnings = [];

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

function extractEvidence() {
  const external = html.match(/<script[^>]+src=["'](?:\.\/)?pulse-public-evidence\.js(?:\?[^"']*)?["'][^>]*><\/script>/i);
  if (external) {
    const source = fs.readFileSync('pulse-public-evidence.js', 'utf8');
    const marker = 'window.PULSE_EVIDENCE=';
    const idx = source.indexOf(marker);
    if (idx >= 0) {
      const start = source.indexOf('[', idx);
      if (start >= 0) { const [a,b] = balancedSpan(source,start,'[',']'); return vm.runInNewContext(source.slice(a,b)); }
    }
  }
  const jsonMarker = '<script type="application/json" id="pulse-public-evidence-json">';
  const markerIndex = html.indexOf(jsonMarker);
  if (markerIndex >= 0) {
    const start = markerIndex + jsonMarker.length;
    const end = html.indexOf('</script>', start);
    if (end < 0) throw new Error('pulse-public-evidence-json has no closing script');
    return JSON.parse(html.slice(start, end));
  }
  const marker = 'window.PULSE_EVIDENCE =';
  const markerIndex2 = html.indexOf(marker);
  if (markerIndex2 < 0) throw new Error('window.PULSE_EVIDENCE not found');
  const start = html.indexOf('[', markerIndex2);
  if (start < 0) throw new Error('PULSE_EVIDENCE array not found');
  const [a, b] = balancedSpan(html, start, '[', ']');
  return vm.runInNewContext(html.slice(a, b));
}

function extractRuntimeEvidence() {
  const jsonMarker = '<script type="application/json" id="pulse-public-evidence-json">';
  const markerIndex = html.indexOf(jsonMarker);
  if (markerIndex < 0) throw new Error('pulse-public-evidence-json not found');
  const dataStart = markerIndex + jsonMarker.length;
  const jsonEnd = html.indexOf('</script>', dataStart);
  if (jsonEnd < 0) throw new Error('pulse-public-evidence-json has no closing script');
  const assignment = '<script>try{window.PULSE_EVIDENCE=JSON.parse(document.getElementById("pulse-public-evidence-json")?.textContent||"[]")}catch(e){window.PULSE_EVIDENCE=[]}</script>';
  const assignmentIndex = html.indexOf(assignment, jsonEnd + 9);
  if (assignmentIndex < 0) throw new Error('runtime evidence assignment must parse pulse-public-evidence-json after the data block');
  return JSON.parse(html.slice(dataStart, jsonEnd));
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
let runtimeEvidence;
let sources;
try {
  evidence = extractEvidence();
  runtimeEvidence = extractRuntimeEvidence();
  sources = extractAssignedArray('window.PULSE_SOURCES =');
} catch (err) {
  console.error(`Pulse data integrity FAILED: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(evidence) || evidence.length === 0) failures.push('PULSE_EVIDENCE must be a non-empty array');

let standaloneEvidence;
try {
  const source = fs.readFileSync('pulse-public-evidence.js', 'utf8');
  const marker = 'window.PULSE_EVIDENCE=';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('window.PULSE_EVIDENCE not found in pulse-public-evidence.js');
  const start = source.indexOf('[', markerIndex);
  if (start < 0) throw new Error('PULSE_EVIDENCE array not found in pulse-public-evidence.js');
  const [a, b] = balancedSpan(source, start, '[', ']');
  standaloneEvidence = vm.runInNewContext(source.slice(a, b));
} catch (err) {
  failures.push(`standalone public evidence failed to load: ${err.message}`);
}
if (Array.isArray(evidence) && Array.isArray(standaloneEvidence) &&
    JSON.stringify(evidence) !== JSON.stringify(standaloneEvidence)) {
  failures.push('embedded index.html evidence and pulse-public-evidence.js are out of sync');
}
let serverEvidence;
try {
  const serverSource = fs.readFileSync('supabase/functions/pulse-ask-ai/public-evidence.ts', 'utf8');
  const serverMarker = 'export const PULSE_PUBLIC_EVIDENCE =';
  const serverMarkerIndex = serverSource.indexOf(serverMarker);
  if (serverMarkerIndex < 0) throw new Error('PULSE_PUBLIC_EVIDENCE export not found');
  const serverStart = serverSource.indexOf('[', serverMarkerIndex);
  if (serverStart < 0) throw new Error('PULSE_PUBLIC_EVIDENCE array not found');
  const [serverA, serverB] = balancedSpan(serverSource, serverStart, '[', ']');
  serverEvidence = vm.runInNewContext(serverSource.slice(serverA, serverB));
} catch (err) {
  failures.push(`server-side public evidence failed to load: ${err.message}`);
}
if (Array.isArray(standaloneEvidence) && Array.isArray(serverEvidence) &&
    JSON.stringify(standaloneEvidence) !== JSON.stringify(serverEvidence)) {
  failures.push('server-side public evidence and pulse-public-evidence.js are out of sync');
}
const edgeSource = fs.readFileSync('supabase/functions/pulse-ask-ai/index.ts', 'utf8');
if (!edgeSource.includes('PULSE_PUBLIC_EVIDENCE.map') ||
    edgeSource.includes('publicEvidence.map') ||
    edgeSource.includes('Array.isArray(body.public_evidence)')) {
  failures.push('Ask AI must retrieve public evidence from the canonical server-side dataset');
}
if (Array.isArray(evidence) && Array.isArray(runtimeEvidence) &&
    JSON.stringify(evidence) !== JSON.stringify(runtimeEvidence)) {
  failures.push('runtime window.PULSE_EVIDENCE and embedded index.html evidence are out of sync');
}

let serverEvidence;
try {
  const source = fs.readFileSync('supabase/functions/pulse-ask-ai/public-evidence.ts', 'utf8');
  const marker = 'export const PULSE_PUBLIC_EVIDENCE =';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('PULSE_PUBLIC_EVIDENCE export not found');
  const start = source.indexOf('[', markerIndex);
  if (start < 0) throw new Error('PULSE_PUBLIC_EVIDENCE array not found');
  const [a, b] = balancedSpan(source, start, '[', ']');
  serverEvidence = vm.runInNewContext(source.slice(a, b));
} catch (err) {
  failures.push(`server public evidence failed to load: ${err.message}`);
}
if (Array.isArray(evidence) && Array.isArray(serverEvidence) &&
    JSON.stringify(evidence) !== JSON.stringify(serverEvidence)) {
  failures.push('server public evidence and client public evidence are out of sync');
}
if (Array.isArray(evidence) && evidence.length < 34) failures.push(`expected at least 34 public evidence records, found ${evidence.length}`);
for (const id of [
  'kantar-chocolate-brasil-volume-q1-2025',
  'kantar-chocolate-brasil-compras-pascoa-2024',
  'abicab-chocolate-producao-brasil-2025-pascoa-2026',
  'locomotiva-pascoa-2026-intencao-drivers',
  'rico-preco-chocolate-barra-bombom-out-2026'
]) {
  if (!Array.isArray(evidence) || !evidence.some(item => item.id === id)) failures.push(`required chocolate evidence missing: ${id}`);
}
if (!Array.isArray(sources) || sources.length === 0) failures.push('PULSE_SOURCES must be a non-empty array');

const allowedCategories = null;
const evidenceIds = new Set();

for (const item of evidence || []) {
  if (!item || typeof item !== 'object') { failures.push('PULSE_EVIDENCE contains a non-object item'); continue; }
  if (!item.id) failures.push('evidence item missing id');
  else if (evidenceIds.has(item.id)) failures.push(`duplicate evidence id: ${item.id}`);
  else evidenceIds.add(item.id);

  for (const field of ['categoria', 'fato', 'contexto', 'interpretacao', 'hipotese', 'acao', 'fonte', 'periodo', 'natureza', 'universo_observado', 'representa', 'nao_representa', 'fonte_primaria', 'fato_verificado_na_fonte', 'alcance_para_pergunta']) {
    if (item[field] === undefined || item[field] === null || item[field] === '') failures.push(`${item.id || '<unknown>'}: missing ${field}`);
  }
  if (!item.categoria || typeof item.categoria !== 'string') failures.push(`${item.id}: invalid categoria`);
  if (Object.prototype.hasOwnProperty.call(item, 'confianca')) failures.push(`${item.id}: deprecated confidence score must not be used`);
  if (item.url && !/^https?:\/\//i.test(item.url)) failures.push(`${item.id}: invalid evidence URL`);
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
  if (source.url && !/^https?:\/\//i.test(source.url)) failures.push(`source has invalid URL: ${source.url}`);
}

const sourceUrls = new Set((sources || []).map(s => String(s.url || '')));
for (const item of evidence || []) if (item.url && !sourceUrls.has(item.url)) failures.push(item.id + ': evidence source URL is missing from PULSE_SOURCES');

if (evidenceIds.size < 10) failures.push(`expected at least 10 evidence items, found ${evidenceIds.size}`);

const scriptIds = [...html.matchAll(/<script\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
const seenScriptIds = new Set();
for (const id of scriptIds) {
  if (seenScriptIds.has(id)) warnings.push(`duplicate script id: ${id}`);
  seenScriptIds.add(id);
}

if (failures.length) {
  console.error('Pulse data integrity FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log(`Pulse data integrity PASSED (${evidence.length} evidence items, ${sources.length} sources, ${scriptIds.length} identified script ids)`);
if (warnings.length) {
  console.warn('Pulse data integrity WARNINGS');
  warnings.forEach(w => console.warn(`- ${w}`));
}
