#!/usr/bin/env node
'use strict';
/* Public-evidence ranking used by Ask AI: parity between the browser (ask.html) and the server
   (supabase/functions/pulse-ask-ai/index.ts), plus a retrieval floor on the evaluation set
   docs/eval/ask-ai-questions.json (the expected evidence must be among the 8 items sent to the model). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.join(__dirname, '..');
const between = (text, file) => {
  const a = text.indexOf('/* PULSE_PUBLIC_RANK_START */'), b = text.indexOf('/* PULSE_PUBLIC_RANK_END */');
  assert(a >= 0 && b > a, `ranking markers missing in ${file}`);
  return text.slice(a, b);
};
const browser = between(fs.readFileSync(path.join(ROOT, 'ask.html'), 'utf8'), 'ask.html');
const serverTs = between(fs.readFileSync(path.join(ROOT, 'supabase/functions/pulse-ask-ai/index.ts'), 'utf8'), 'index.ts');
const stripTypes = (s) => s.replace(/\(idf as any\)/g, 'idf').replace(/Object\.fromEntries<number>/g, 'Object.fromEntries').replace(/: (any|string|number)\b/g, '');
const norm = (s) => s.replace(/\s+/g, ' ').replace(/;\s*/g, ';').trim();
assert.strictEqual(norm(stripTypes(serverTs)), norm(browser), 'browser and server ranking blocks diverge (ignoring type annotations)');

const ctx = {}; vm.createContext(ctx);
vm.runInContext(browser + '\nthis.pulseRankPublic = pulseRankPublic; this.pulseRankTerms = pulseRankTerms;', ctx);
const evSrc = fs.readFileSync(path.join(ROOT, 'supabase/functions/pulse-ask-ai/public-evidence.ts'), 'utf8');
const evidence = JSON.parse(evSrc.slice(evSrc.indexOf('[', evSrc.indexOf('PULSE_PUBLIC_EVIDENCE')), evSrc.lastIndexOf('] as const') + 1));
assert.deepStrictEqual(Array.from(ctx.pulseRankTerms('Qual a produção de chocolate em 2025?')), ['producao', 'chocolate', '2025'], 'stopwords are not search terms');
assert.deepStrictEqual(Array.from(ctx.pulseRankTerms('o que é isso?')), [], 'a stopword-only question has no terms');
const set = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/eval/ask-ai-questions.json'), 'utf8'));
let top8 = 0, top3 = 0, total = 0; const misses = [];
for (const q of set.questions) {
  if (!q.expect_ids.length) continue;
  const ids = ctx.pulseRankPublic(q.q, evidence).slice(0, 8).map((r) => r.item.id);
  total++;
  if (q.expect_ids.every((id) => ids.includes(id))) top8++; else misses.push(q.id);
  if (q.expect_ids.every((id) => ids.slice(0, 3).includes(id))) top3++;
}
assert.strictEqual(top8, total, `expected evidence outside the 8 items sent to the model for: ${misses.join(', ')}`);
assert(top3 >= Math.ceil(total * 0.85), `expected evidence in the top 3 for only ${top3}/${total} questions`);
console.log(`Public evidence ranking: PASS (browser/server parity; expected evidence in top 8 for ${top8}/${total}, in top 3 for ${top3}/${total})`);
