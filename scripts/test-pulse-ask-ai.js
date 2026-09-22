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
if (!index.includes('20260922.01')) failures.push('Public workspace cache version not refreshed');
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

if (failures.length) {
  console.error('Ask AI regression FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log('Ask AI regression PASSED');

// Persistent investigation and shopper knowledge contract verified.

// Final validation marker: shared scope, saved evidence and knowledge update loop.
