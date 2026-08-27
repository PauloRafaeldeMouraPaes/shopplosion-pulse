const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const failures = [];

function requireText(label, text) {
  if (!html.includes(text)) failures.push(`${label}: missing ${text}`);
}

[
  ['category selector', 'MINHA CATEGORIA'],
  ['all-categories option', 'Todas as categorias'],
  ['category-specific badge', 'Específico da sua categoria'],
  ['general-market badge', 'Sinal geral do mercado'],
  ['opportunity filters', 'data-filter-scope="opportunities"'],
  ['source-status panel', 'Status das Fontes'],
  ['print stylesheet', '@media print'],
  ['persistent history', 'localStorage'],
  ['evidence registry', 'window.PULSE_EVIDENCE'],
  ['source registry', 'window.PULSE_SOURCES'],
  ['last-updated registry', 'window.PULSE_LAST_UPDATED'],
  ['route function', 'function pulseRoute'],
  ['custom answer renderer', 'function pulseRenderCustomAnswer'],
  ['history renderer', 'function pulseRenderHistory'],
  ['history saver', 'function pulseSaveHistory'],
  ['fuzzy matcher', 'function pulseMatchEvidence']
].forEach(([label, text]) => requireText(label, text));

if (/assets\//i.test(html)) failures.push('artifact: contains forbidden assets/ reference');
if (/sessionStorage/i.test(html)) failures.push('artifact: contains forbidden sessionStorage reference');

for (const tag of ['html', 'head', 'body', 'main', 'script']) {
  const open = (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (open !== close) failures.push(`HTML: unbalanced <${tag}> (${open}/${close})`);
}

const evidenceMarker = html.indexOf('window.PULSE_EVIDENCE');
if (evidenceMarker < 0) {
  failures.push('PULSE_EVIDENCE: registry marker not found');
} else {
  const arrayStart = html.indexOf('[', evidenceMarker);
  const firstItem = html.indexOf('id:', arrayStart);
  if (arrayStart < 0 || firstItem < 0) failures.push('PULSE_EVIDENCE: array structure not found');
}

if (!fs.existsSync('scripts/test-pulse-ask-ai.js')) {
  failures.push('Ask AI: deterministic regression test script missing');
}

if (!html.includes('keywordScores.sort(function(a,b){return b-a;})')) {
  failures.push('Ask AI: per-item keyword score cap not detected');
}

if (failures.length) {
  console.error('Pulse regression validation FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}

console.log('Pulse regression validation PASSED');
