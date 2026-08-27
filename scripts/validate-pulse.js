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

const evidenceMatch = js.match(/(?:const|let|var)\s+PULSE_EVIDENCE\s*=\s*(\[[\s\S]*?\]);/);
if (!evidenceMatch) { fail('PULSE_EVIDENCE declaration not found'); }
else {
  try {
    const evidence = vm.runInNewContext(evidenceMatch[1]);
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

const openTags = (html.match(/<[^/!][^>]*>/g) || []).filter(t => !/^<(meta|link|img|input|br|hr|source|area|base|col|embed|param|track|wbr)\b/i.test(t));
const closeTags = (html.match(/<\/[^>]+>/g) || []).length;
if (openTags.length !== closeTags) fail(`basic HTML tag count mismatch: ${openTags.length} opens vs ${closeTags} closes`); else ok('basic HTML tag counts balanced');

process.exitCode = process.exitCode || 0;
