// Two layers in every shopper reading (AGENTS.md, owner 2026-11-23): the shopper as a whole and the category read.
// Pure functions, shared by the Edge Function and scripts/test-ask-ai-layers.mjs. No category is named here:
// the registered categories come from categories.mjs, generated from pulse-shopper-map.js.
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function evidenceLayer(item, categories) {
  const hit = (categories || []).find((c) => c.key === (item && item.categoria));
  return hit ? { kind: 'category', key: hit.key, label: hit.label } : { kind: 'general', key: null, label: 'Shopper em geral' };
}

export function askedCategory(question, categories) {
  const t = plain(question);
  const hit = (categories || []).find((c) => (c.terms || []).some((w) => t.includes(plain(w))));
  return hit ? hit.key : null;
}

export function layerRules(categoryKey, categories) {
  const cat = (categories || []).find((c) => c.key === categoryKey);
  const asked = cat ? `A pergunta é sobre a categoria ${cat.label}.` : 'A pergunta não cita nenhuma categoria cadastrada.';
  return `${asked} Cada evidência traz o atributo camada: "Shopper em geral" vale para qualquer categoria; "Categoria: <nome>" vale só para aquela categoria. Na LEITURA, separe o que vem de "Shopper em geral" do que é específico da categoria perguntada, nessa ordem, e diga quando uma das duas camadas não tem evidência. Nunca apresente evidência de uma categoria como válida para o shopper em geral nem para outra categoria.`;
}
