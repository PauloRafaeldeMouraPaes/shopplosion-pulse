const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const workspace = fs.existsSync('pulse-workspace-v3.js') ? fs.readFileSync('pulse-workspace-v3.js', 'utf8') : '';
const nextLevel = fs.existsSync('scripts/pulse-next-level-runtime.js') ? fs.readFileSync('scripts/pulse-next-level-runtime.js', 'utf8') : '';
const failures = [];

function requireText(label, text, haystack = html) {
  if (!haystack.includes(text)) failures.push(`${label}: missing ${text}`);
}
const canonicalWorkspace = html.includes('__PULSE_CANONICAL_WORKSPACE_PAGE__');
function requireHtmlOrRuntime(label, text) {
  if (!html.includes(text) && !nextLevel.includes(text)) failures.push(`${label}: missing ${text}`);
}

[
  ...(canonicalWorkspace ? [] : [['category selector', 'Todas as categorias']]),
  ['evidence registry', 'window.PULSE_EVIDENCE'],
  ['source registry', 'window.PULSE_SOURCES'],
  ['accessibility focus contract', 'focus-visible'],
  ['workspace runtime', 'pulse-workspace-v3.js'],
  ['workspace five destinations', 'data-nav'],
  ['workspace scope', 'ESCOPO'],
  ['workspace evidence canvas', 'pv4-canvas'],
  ['workspace inspector', 'pv4-inspector'],
  ['workspace proposal story', 'pv4-story']
].forEach(([label, text]) => {
  const haystack = label === 'workspace runtime' ? html : (label.startsWith('workspace') ? workspace : html);
  requireText(label, text, haystack);
});

if (!canonicalWorkspace) {
  requireHtmlOrRuntime('local evidence contract', 'PULSE_LOCAL_EVIDENCE');
  requireHtmlOrRuntime('next-level runtime', 'PULSE_NEXT_LEVEL');
}

if (/assets\//i.test(html)) failures.push('artifact: contains forbidden assets/ reference');
if (/sessionStorage/i.test(html)) failures.push('artifact: contains forbidden sessionStorage reference');

for (const tag of ['html', 'head', 'body', 'main', 'script']) {
  const open = (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
  if (open !== close) failures.push(`HTML: unbalanced <${tag}> (${open}/${close})`);
}

const evidenceMarker = html.indexOf('window.PULSE_EVIDENCE');
if (evidenceMarker < 0) failures.push('PULSE_EVIDENCE: registry marker not found');

if (!fs.existsSync('scripts/test-pulse-ask-ai.js')) failures.push('Ask AI: deterministic regression test script missing');

const v6MarkerCount = (html.match(/<!-- PULSE_PRODUCT_V6 -->/g) || []).length;
if (v6MarkerCount > 1) failures.push(`Product V6: expected at most one marker, found ${v6MarkerCount}`);
if (!canonicalWorkspace && v6MarkerCount === 1) {
  if (!html.includes('const parseDate=')) failures.push('Product V6: temporal parser missing');
  if (!html.includes('const periodKey=')) failures.push('Product V6: period normalization missing');
  if (!html.includes('qualityBand')) failures.push('Product V6: evidence quality bands missing');
  if (!html.includes('navigator.clipboard')) failures.push('Product V6: executive-copy action missing');
}

if (failures.length) {
  console.error('Pulse regression validation FAILED');
  failures.forEach(f => console.error(`- ${f}`));
  process.exit(1);
}
console.log('Pulse regression validation PASSED');
