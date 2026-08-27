const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const js = scripts.join('\n');
const evidenceMatch = js.match(/(?:const|let|var)\s+PULSE_EVIDENCE\s*=\s*(\[[\s\S]*?\]);/);
if (!evidenceMatch) throw new Error('PULSE_EVIDENCE not found');
const evidence = vm.runInNewContext(evidenceMatch[1]);

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\b(a|o|e|de|da|do|das|dos|em|no|na|nos|nas|por|para|com|sem|um|uma)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function score(item, query) {
  const q = normalize(query);
  const qWords = q.split(' ').filter(Boolean);
  const values = item.keywords.map(normalize).map(k => {
    if (!k) return 0;
    if (q === k) return 100;
    if (q.includes(k) || k.includes(q)) return 40;
    const words = k.split(' ').filter(Boolean);
    return words.filter(w => qWords.some(qw => qw === w || qw.includes(w) || w.includes(qw))).length * 10;
  });
  return Math.max(0, ...values);
}
function best(query) {
  return evidence.map(item => ({id:item.id, score:score(item,query)})).sort((a,b)=>b.score-a.score)[0];
}

const tests = [
  ['consumidor sem dinheiro','confianca-financeira'],
  ['aperto no bolso','confianca-financeira'],
  ['renda menor','confianca-financeira'],
  ['precos mais altos',null],
  ['inflacao',null],
  ['compras no atacarejo','canal'],
  ['comprar no supermercado','canal'],
  ['compras pela internet','canal']
];
let failed = 0;
for (const [q, expected] of tests) {
  const got = best(q);
  if (expected && got.id !== expected) { console.error(`FAIL: ${q} -> ${got.id} (${got.score}), expected ${expected}`); failed++; }
  else console.log(`PASS: ${q} -> ${got.id} (${got.score})`);
}
if (failed) process.exitCode = 1;
