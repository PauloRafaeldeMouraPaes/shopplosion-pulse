const fs = require('fs');

const index = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const ask = fs.existsSync('ask.html') ? fs.readFileSync('ask.html', 'utf8') : '';
const workspace = fs.existsSync('pulse-workspace-v3.js') ? fs.readFileSync('pulse-workspace-v3.js', 'utf8') : '';
const app = fs.existsSync('app.html') ? fs.readFileSync('app.html', 'utf8') : '';
const saveEvidenceFunction = fs.existsSync('supabase/functions/pulse-save-evidence/index.ts') ? fs.readFileSync('supabase/functions/pulse-save-evidence/index.ts', 'utf8') : '';
const publicEvidenceJs = fs.existsSync('pulse-public-evidence.js') ? fs.readFileSync('pulse-public-evidence.js', 'utf8') : '';
const publicEvidenceMirror = fs.existsSync('supabase/functions/pulse-ask-ai/public-evidence.ts') ? fs.readFileSync('supabase/functions/pulse-ask-ai/public-evidence.ts', 'utf8') : '';
const failures = [];

// The public evidence registry, browser mirror and Edge Function mirror must
// stay in sync with the public-text hygiene contract. Data wording is never
// rewritten at runtime to hide a repository regression.
for (const [name, content] of [
  ['index.html', index],
  ['pulse-public-evidence.js', publicEvidenceJs],
  ['supabase/functions/pulse-ask-ai/public-evidence.ts', publicEvidenceMirror],
]) {
  if (!content) {
    failures.push(`Public evidence mirror missing: ${name}`);
    continue;
  }
  if (content.includes(String.fromCharCode(0x2013)) || content.includes(String.fromCharCode(0x2014))) failures.push(`Public evidence mirror contains U+2013/U+2014: ${name}`);
  if (/lindt/i.test(content)) failures.push(`Public evidence mirror contains a public brand name: ${name}`);
}

function extractEvidenceArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Marker not found: ${marker}`);
  const start = source.indexOf('[', markerIndex);
  if (start < 0) throw new Error(`Array start not found after: ${marker}`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char.charCodeAt(0) === 92) escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth++;
    else if (char === ']') {
      depth--;
      if (depth === 0) return JSON.parse(source.slice(start, i + 1));
    }
  }
  throw new Error(`Array end not found after: ${marker}`);
}

try {
  const marker = '<script type="application/json" id="pulse-public-evidence-json">';
  const markerStart = index.indexOf(marker);
  const payloadStart = markerStart < 0 ? -1 : index.indexOf('>', markerStart) + 1;
  const payloadEnd = payloadStart < 0 ? -1 : index.indexOf('</script>', payloadStart);
  if (markerStart < 0 || payloadStart <= 0 || payloadEnd < 0) throw new Error('index.html public evidence JSON is missing');
  const htmlEvidence = JSON.parse(index.slice(payloadStart, payloadEnd));
  const browserEvidence = extractEvidenceArray(publicEvidenceJs, 'window.PULSE_EVIDENCE=');
  const edgeEvidence = extractEvidenceArray(publicEvidenceMirror, 'export const PULSE_PUBLIC_EVIDENCE =');
  const canonical = JSON.stringify(htmlEvidence);
  if (JSON.stringify(browserEvidence) !== canonical) failures.push('Public evidence diverges: index.html vs pulse-public-evidence.js');
  if (JSON.stringify(edgeEvidence) !== canonical) failures.push('Public evidence diverges: index.html vs public-evidence.ts');
  if (browserEvidence.length !== htmlEvidence.length || edgeEvidence.length !== htmlEvidence.length) failures.push('Public evidence mirror record counts differ');
} catch (error) {
  failures.push(`Public evidence mirror parity check could not run: ${error.message}`);
}

if (!index.includes('window.PULSE_EVIDENCE')) failures.push('public evidence registry missing');
if (!index.includes('pulse-public-evidence-json')) failures.push('public evidence JSON missing');
if (!ask.includes('pulse-workspace-v3.js')) failures.push('Ask AI canonical workspace runtime missing');
if (!ask.includes("from('investigations')")) failures.push('Investigation persistence missing');
if (!ask.includes('investigation_id')) failures.push('Analysis-investigation link missing');
if (!ask.includes('structured')) failures.push('Structured investigation blocks missing');
if (!ask.includes('shopper_knowledge')) failures.push('Shopper knowledge persistence missing');
if (!ask.includes('knowledge_updates')) failures.push('Knowledge update history persistence missing');
if (!ask.includes('prior_knowledge')) failures.push('Prior shopper knowledge comparison missing');
if (!ask.includes('pulse-save-evidence')) failures.push('Persistent saved evidence flow missing');
if (!index.includes('20260922.08')) failures.push('Public workspace cache version is not canonical');
if (!workspace.includes('MOVIMENTO OBSERVÁVEL')) failures.push('Today narrative still uses static movement claim');
if (!workspace.includes('ev.slice(0,2).map')) failures.push('Today Opportunity Canvas is not evidence-derived');
if (!workspace.includes("routes.investigacao+'?saveEvidence='")) failures.push('Inspector persistent save action missing');
if (!ask.includes('selected_public_evidence_ids:selectedPublicEvidenceIds')) failures.push('Selected public evidence IDs missing from Ask AI request');
const canonicalEdge = fs.existsSync('supabase/functions/pulse-ask-ai/index.ts') ? fs.readFileSync('supabase/functions/pulse-ask-ai/index.ts', 'utf8') : '';
if (!canonicalEdge.includes('selected_public_evidence_ids?: string[]') || !canonicalEdge.includes('requestedPublicEvidenceIds.has(String(item.id))') || !canonicalEdge.includes('PULSE_PUBLIC_EVIDENCE.map')) failures.push('Selected public evidence must be resolved from canonical server-side records');
if (ask.includes('public_evidence:') || ask.includes('public_evidence:selected')) failures.push('Client must not send mutable public evidence payloads to Ask AI');
if (!ask.includes('id="questionBuilder"') || !ask.includes('questionExample')) failures.push('Guided question builder missing');
if (!ask.includes('data-evidence-key') || !ask.includes('selectedEvidenceIds')) failures.push('Explicit evidence selection contract missing');
if (!ask.includes('O Pulse não escolhe automaticamente o primeiro resultado.')) failures.push('Evidence auto-selection guard missing');
if (!ask.includes('As evidências foram exibidas. Selecione pelo menos uma antes de gerar a leitura.')) failures.push('Readiness guard before answer missing');
for (const text of ['pv4-ask-context', 'pv4-progress', '01 Recuperar', '02 Ler', '03 Escrever']) {
  if (!workspace.includes(text)) failures.push(`Ask AI contract missing ${text}`);
}
if (!workspace.includes("scopeLabels") || !workspace.includes("Público") || !workspace.includes("Minha indústria") || !workspace.includes("Ambos")) failures.push('Ask AI shared scope model missing');
if (!workspace.includes('preloadPrivateEvidence') || !workspace.includes('saved_evidence')) failures.push('Shared workspace private saved evidence scope missing');
if (!app.includes('knowledgeUpdates') || !app.includes('savedEvidence')) failures.push('Industry knowledge/update panels missing');
if (!saveEvidenceFunction.includes('saved_evidence') || !saveEvidenceFunction.includes("Authorization") || !saveEvidenceFunction.includes("Bearer ")) failures.push('Authenticated saved evidence function missing');


if (!ask.includes("publicEvidence") || !ask.includes("Abrir fonte original")) failures.push('Public Ask AI rendering contract missing');
if (!ask.includes("target=\"_blank\"")) failures.push('Public source navigation contract missing');
const askFn = fs.existsSync('supabase/functions/pulse-ask-ai/index.ts') ? fs.readFileSync('supabase/functions/pulse-ask-ai/index.ts', 'utf8') : '';
if (!askFn.includes("x-goog-api-key")) failures.push('Gemini authentication header missing');
if (!askFn.includes("gemini-3.5-flash-lite")) failures.push('Current Gemini production model missing');
if (!askFn.includes("originatingEvidenceId") || !askFn.includes("public_evidence_id") || !askFn.includes("String(item.id) === originatingEvidenceId")) failures.push('Origin public evidence preservation missing');

if (!ask.includes('<option value="both" selected>Ambos (público e privado)</option>')) failures.push('Ask AI default combined scope missing');
const askFnText = fs.existsSync('supabase/functions/pulse-ask-ai/index.ts') ? fs.readFileSync('supabase/functions/pulse-ask-ai/index.ts', 'utf8') : '';
if (!askFnText.includes('deterministicFallback')) failures.push('Ask AI evidence fallback missing');
if (!askFnText.includes('fallback: true')) failures.push('Ask AI fallback response contract missing');
const providerRetryStart = askFnText.indexOf('for (let attempt = 0; attempt < 3; attempt++)');
const providerFallbackStart = askFnText.indexOf('function deterministicFallback');
if (providerRetryStart < 0 || !askFnText.slice(providerRetryStart, providerFallbackStart > providerRetryStart ? providerFallbackStart : undefined).includes('providerResponse = null') ||
    !askFnText.slice(providerRetryStart, providerFallbackStart > providerRetryStart ? providerFallbackStart : undefined).includes('lastProviderStatus = 0')) {
  failures.push('Gemini network exceptions must retry and reach deterministic fallback');
}
if (providerFallbackStart < 0 || !askFnText.slice(providerFallbackStart, providerFallbackStart + 4500).includes('source_url: item.source_url || null')) {
  failures.push('Deterministic fallback must preserve canonical evidence source URLs');
}

if (failures.length) {
  console.error('Ask AI regression FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log('Ask AI regression PASSED');
console.log('Public evidence hygiene and three-layer parity contract passed.');

// Persistent investigation and shopper knowledge contract verified.

// Final validation marker: shared scope, saved evidence and knowledge update loop.

if (workspace.includes("function evidence(){") && workspace.indexOf("if(scope==='industry') return privateEvidence") < workspace.indexOf("function confidenceHigh")) failures.push('Scope filter ordering is invalid');

// Final scope regression marker.
