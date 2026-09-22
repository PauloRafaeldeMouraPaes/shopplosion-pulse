const fs = require('fs');

const index = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const ask = fs.existsSync('ask.html') ? fs.readFileSync('ask.html', 'utf8') : '';
const workspace = fs.existsSync('pulse-workspace-v3.js') ? fs.readFileSync('pulse-workspace-v3.js', 'utf8') : '';
const app = fs.existsSync('app.html') ? fs.readFileSync('app.html', 'utf8') : '';
const saveEvidenceFunction = fs.existsSync('supabase/functions/pulse-save-evidence/index.ts') ? fs.readFileSync('supabase/functions/pulse-save-evidence/index.ts', 'utf8') : '';
const failures = [];

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
if (!index.includes('20260922.07')) failures.push('Public workspace cache version is not canonical');
if (!workspace.includes('MOVIMENTO OBSERVÁVEL')) failures.push('Today narrative still uses static movement claim');
if (!workspace.includes('ev.slice(0,2).map')) failures.push('Today Opportunity Canvas is not evidence-derived');
if (!workspace.includes("routes.investigacao+'?saveEvidence='")) failures.push('Inspector persistent save action missing');
if (!ask.includes('public_evidence:found.publicRows')) failures.push('Public evidence context missing from Ask AI request');
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

if (!ask.includes('<option value="both" selected>Ambos · público + privado</option>')) failures.push('Ask AI default combined scope missing');
const askFnText = fs.existsSync('supabase/functions/pulse-ask-ai/index.ts') ? fs.readFileSync('supabase/functions/pulse-ask-ai/index.ts', 'utf8') : '';
if (!askFnText.includes('deterministicFallback')) failures.push('Ask AI evidence fallback missing');
if (!askFnText.includes('fallback: true')) failures.push('Ask AI fallback response contract missing');

if (failures.length) {
  console.error('Ask AI regression FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log('Ask AI regression PASSED');

// Persistent investigation and shopper knowledge contract verified.

// Final validation marker: shared scope, saved evidence and knowledge update loop.

if (workspace.includes("function evidence(){") && workspace.indexOf("if(scope==='industry') return privateEvidence") < workspace.indexOf("function confidenceHigh")) failures.push('Scope filter ordering is invalid');

// Final scope regression marker.
