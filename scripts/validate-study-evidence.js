const assert = require('node:assert/strict');

// Pure-function guardrail for the evidence contract. The browser implementation
// intentionally keeps the same semantics: claims are descriptive signals and
// contradictions are only candidates for human review.
function polarity(text) {
  const s = text.toLowerCase();
  if (/(não|nao|menor|queda|caiu|cai|reduz|redução|reducao|fraco|negativo|não valoriz|nao valoriz|não influencia|nao influencia)/.test(s)) return 'negative';
  if (/(aument|cresce|cresceu|crescimento|maior|forte|positivo|valoriza|valorizam|influencia|preferem|preferência|preferencia)/.test(s)) return 'positive';
  return 'neutral';
}

const a = 'Consumidores valorizam fortemente promoções de preço.';
const b = 'Consumidores não valorizam promoções de preço.';
assert.equal(polarity(a), 'positive');
assert.equal(polarity(b), 'negative');
assert.notEqual(polarity(a), polarity(b));
console.log('Study evidence contract: PASS');
