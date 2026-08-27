const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');

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
  throw new Error('Unclosed balanced span');
}

const marker = html.indexOf('PULSE_EVIDENCE');
if (marker < 0) throw new Error('PULSE_EVIDENCE not found');
const arrayStart = html.indexOf('[', marker);
const [a, b] = balancedSpan(html, arrayStart, '[', ']');
const evidence = vm.runInNewContext(html.slice(a, b));

const fnStart = html.indexOf('function pulseNormalize');
const fnEnd = html.indexOf('function pulseRankEvidence', fnStart);
if (fnStart < 0 || fnEnd < 0) throw new Error('Ask AI fuzzy functions not found');
const fuzzySource = html.slice(fnStart, fnEnd);
const context = { window: { PULSE_EVIDENCE: evidence } };
vm.createContext(context);
vm.runInContext(fuzzySource, context);

const cases = [
  ['consumidor sem dinheiro', 'confianca-financeira'],
  ['aperto no bolso', 'confianca-financeira'],
  ['renda menor', 'confianca-financeira'],
  ['preços mais altos', null],
  ['inflação', null],
  ['compras no atacarejo', 'canal'],
  ['comprar no supermercado', 'canal'],
  ['compras pela internet', 'canal']
];

let failures = 0;
for (const [question, expected] of cases) {
  const result = context.pulseMatchEvidence(question);
  const id = result && result.id;
  if (expected && id !== expected) {
    console.error(`FAIL: ${question} -> ${id || 'null'}; expected ${expected}`);
    failures++;
  } else {
    console.log(`PASS: ${question} -> ${id || 'null'}`);
  }
}

if (!html.includes('keywordScores.sort(function(a,b){return b-a;})')) {
  console.error('FAIL: per-item keyword score cap not detected');
  failures++;
}

process.exitCode = failures ? 1 : 0;
