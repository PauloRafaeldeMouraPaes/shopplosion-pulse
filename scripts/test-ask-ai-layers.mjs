// Ask AI: every public evidence item is labelled with its layer (the shopper as a whole or one registered category),
// so the answer never presents one category's evidence as general (AGENTS.md, owner 2026-11-23).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { evidenceLayer, askedCategory, layerRules } from '../supabase/functions/pulse-ask-ai/layers.mjs';
import { PULSE_PRODUCT_CATEGORIES } from '../supabase/functions/pulse-ask-ai/categories.mjs';

const require = createRequire(import.meta.url);
const S = require('../pulse-shopper-map.js');
let n = 0; const t = (name, fn) => { fn(); n++; };

// Invented categories: the logic must work for any category, not only the first pilot.
const CATS = [{ key: 'cafe', label: 'Café', terms: ['cafe', 'capsula'] }, { key: 'biscoito', label: 'Biscoito', terms: ['biscoito', 'bolacha'] }];

t('generated categories mirror the shopper map', () => {
  assert.deepEqual(PULSE_PRODUCT_CATEGORIES, S.CATEGORIES.map(c => ({ key: c.key, label: c.label, terms: c.terms })));
});
t('evidence of a registered category is that category, never general', () => {
  assert.deepEqual(evidenceLayer({ categoria: 'cafe' }, CATS), { kind: 'category', key: 'cafe', label: 'Café' });
  assert.deepEqual(evidenceLayer({ categoria: 'shopper' }, CATS), { kind: 'general', key: null, label: 'Shopper em geral' });
  assert.deepEqual(evidenceLayer({ categoria: 'preços' }, CATS), { kind: 'general', key: null, label: 'Shopper em geral' });
});
t('the asked category comes from the question terms, accents and case ignored', () => {
  assert.equal(askedCategory('Quem compra CÁPSULA de café?', CATS), 'cafe');
  assert.equal(askedCategory('quem compra bolacha recheada', CATS), 'biscoito');
  assert.equal(askedCategory('como o shopper reage ao preço', CATS), null);
});
t('the rules name both layers and forbid presenting a category as general', () => {
  const r = layerRules('cafe', CATS);
  assert.match(r, /Shopper em geral/);
  assert.match(r, /Café/);
  assert.match(r, /nunca/i);
  assert.match(layerRules(null, CATS), /nenhuma categoria/i);
});
t('the Edge Function labels each evidence with its layer and sends the rules', () => {
  const src = fs.readFileSync(new URL('../supabase/functions/pulse-ask-ai/index.ts', import.meta.url), 'utf8');
  assert.match(src, /camada="\$\{/);
  assert.match(src, /layerRules\(/);
  assert.match(src, /askedCategory\(query/);
});
console.log(`Ask AI layers: ${n} passed`);
