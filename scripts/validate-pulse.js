const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'index.html';
const html = fs.readFileSync(file, 'utf8');

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`PASS: ${msg}`);

if (/assets\//.test(html)) fail('found assets/ reference'); else ok('zero assets/ references');
if (/sessionStorage/.test(html)) fail('found sessionStorage'); else ok('zero sessionStorage references');
if (!/localStorage/.test(html)) fail('localStorage is missing'); else ok('localStorage present');
if (!/proxima_revisao/.test(html)) fail('proxima_revisao is missing'); else ok('proxima_revisao present');
if (!/categoria/.test(html)) fail('categoria is missing'); else ok('categoria present');
if (!/@media\s+print/.test(html)) fail('@media print is missing'); else ok('@media print present');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const js = scripts.join('\n');
try { new vm.Script(js, { filename: file }); ok('JavaScript parses without syntax error'); }
catch (e) { fail(`JavaScript syntax error: ${e.message}`); }

function extractBalancedArray(source, start) {
  const open = source.indexOf('[', start);
  if (open < 0) throw new Error('array start not found');
  let depth = 0, quote = null, escape = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return source.slice(open, i + 1); }
  }
  throw new Error('unterminated array');
}

const evidencePos = js.search(/(?:window\.)?PULSE_EVIDENCE\s*=/);
if (evidencePos < 0) {
  fail('PULSE_EVIDENCE declaration not found');
} else {
  try {
    const evidence = vm.runInNewContext(extractBalancedArray(js, evidencePos));
    if (!Array.isArray(evidence) || evidence.length === 0) fail('PULSE_EVIDENCE is empty/invalid');
    else {
      ok(`PULSE_EVIDENCE valid (${evidence.length} items)`);
      evidence.forEach((item, i) => {
        if (!item.categoria) fail(`PULSE_EVIDENCE[${i}] missing categoria`);
        if (!item.proxima_revisao) fail(`PULSE_EVIDENCE[${i}] missing proxima_revisao`);
        if (!Array.isArray(item.keywords) || !item.keywords.length) fail(`PULSE_EVIDENCE[${i}] missing keywords`);
      });
    }
  } catch (e) { fail(`PULSE_EVIDENCE cannot be parsed: ${e.message}`); }
}

for (const name of ['pulseRoute','pulseRenderCustomAnswer','pulseRenderHistory','pulseSaveHistory','pulseMatchEvidence']) {
  const declaration = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=)`);
  if (declaration.test(js)) ok(`${name} declaration found`); else fail(`${name} declaration missing`);
}

// HTML balance is checked by scripts/validate_pulse.py, which runs before this validator.
ok('HTML balance delegated to scripts/validate_pulse.py');

process.exitCode = process.exitCode || 0;
