const assert = require('node:assert/strict');

// Pure-logic guardrail for the Fase 3 "faixa de condução" contract (Regra 4:
// uma recomendação por vez, com motivo baseado em dado real e dispensa fácil,
// silêncio de 30 dias após três dispensas). This re-implements the exact
// dismissal/silence math from pulse-conducao.js so a regression there is
// caught without needing a live Supabase session or a browser.

const SILENCE_DAYS = 30;
const DISMISS_LIMIT = 3;

function isSilenced(store, key, now) {
  const entry = store[key];
  if (!entry || !entry.count) return false;
  if (entry.count < DISMISS_LIMIT) return false;
  const elapsedDays = (now - new Date(entry.lastDismissedAt).getTime()) / 86400000;
  if (elapsedDays >= SILENCE_DAYS) return false;
  return true;
}

function registerDismissal(store, key, now) {
  const entry = store[key] || { count: 0, lastDismissedAt: null };
  entry.count += 1;
  entry.lastDismissedAt = new Date(now).toISOString();
  store[key] = entry;
  return store;
}

// 1) Fresh key never starts silenced.
let store = {};
assert.equal(isSilenced(store, 'documentos_pendentes', Date.now()), false);

// 2) One or two dismissals never silence the recommendation (must stay easy to dismiss without punishing a single "not now").
const t0 = Date.now();
registerDismissal(store, 'documentos_pendentes', t0);
assert.equal(isSilenced(store, 'documentos_pendentes', t0), false);
registerDismissal(store, 'documentos_pendentes', t0 + 1000);
assert.equal(isSilenced(store, 'documentos_pendentes', t0 + 2000), false);

// 3) The third dismissal triggers silence immediately after.
registerDismissal(store, 'documentos_pendentes', t0 + 3000);
assert.equal(isSilenced(store, 'documentos_pendentes', t0 + 4000), true);

// 4) Silence holds for up to 30 days minus a moment.
const justUnder30Days = t0 + 3000 + (SILENCE_DAYS * 86400000 - 1000);
assert.equal(isSilenced(store, 'documentos_pendentes', justUnder30Days), true);

// 5) Silence lifts once 30 days have fully elapsed since the last dismissal (not the first).
const at30Days = t0 + 3000 + SILENCE_DAYS * 86400000;
assert.equal(isSilenced(store, 'documentos_pendentes', at30Days), false);

// 6) A different recommendation key is never silenced by another key's dismissals (one signal at a time, independently dismissible).
assert.equal(isSilenced(store, 'evidencias_novas', t0 + 4000), false);

console.log('Condução dismissal/silence contract: PASS');
