/* Mirrors the database trigger rule (docs/database/signal-event-trigger-draft.sql): an event is expected on a first
   observation, on the transition to resolved, on a fingerprint change, or on a confidence move of at least 0.05
   measured on the stored numeric(5,4) precision. A status change that is not a resolution is not an event by
   itself, and nothing is emitted for a signal that stays resolved. The trigger is the only writer; this predicate
   only predicts what it will do. */
const round4 = (value) => Math.round(Number(value) * 10000) / 10000;
export function shouldRecordSignalEvent({ priorConfidence, existingFingerprint, fingerprint, confidence, priorStatus, status }) {
  if (priorStatus === "resolved" && status === "resolved") return false;
  if (status === "resolved" && priorStatus !== "resolved" && priorStatus !== undefined) return true;
  const hasPrior = priorConfidence !== null && priorConfidence !== undefined;
  if (!hasPrior) return true;
  if (existingFingerprint !== fingerprint) return true;
  return Math.abs(round4(confidence) - round4(priorConfidence)) >= 0.05 - Number.EPSILON;
}

export function signalEventDirection({ priorConfidence, confidence, candidateDirection = "new" }) {
  if (priorConfidence === null || priorConfidence === undefined) return "new";
  const delta = Number(confidence) - Number(priorConfidence);
  if (Math.abs(delta) >= 0.05 - Number.EPSILON) return delta > 0 ? "up" : "down";
  return ["new", "up", "down", "stable", "resolved"].includes(String(candidateDirection))
    ? String(candidateDirection)
    : "new";
}

export function isGoodEvidenceQuote(quote, content) {
  const q = String(quote || "").trim();
  if (q.length < 35 || q.length > 500 || !String(content || "").includes(q)) return false;
  if (/pular para o conte[uú]do|ir para o conte[uú]do|[uú]ltimas not[ií]cias|feed rss|menu|carta de servi[cç]os|transpar[eê]ncia|in[ií]cio\s+[uú]ltimas/i.test(q)) return false;
  if (/(entre jovens|classes [a-e]{1,2}|faixas socioecon[oô]micas|entre consumidores)/i.test(q) && !/(em rela[cç][aã]o a 20\d{2}|comparad[oa] com 20\d{2}|contra 20\d{2}|ante 20\d{2}|pontos percentuais|passou de \d.*para \d|caiu de \d.*para \d|subiu de \d.*para \d)/i.test(q)) return false;
  return /\d/.test(q) && /(chocolate|cacau|produ[cç][aã]o|consumo|p[aá]scoa|ovos|lan[cç]amentos?|exporta[cç][aã]o|importa[cç][aã]o|empregos?|toneladas|R\$|bilh[oõ]es|milh[oõ]es|quilos|\bkg\b)/i.test(q);
}

export function deterministicCandidates(item) {
  const text = String(item.content || "");
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 35 && s.length <= 500);
  const candidates = [];
  const seen = new Set();
  for (let i = 0; i < sentences.length && candidates.length < 5; i++) {
    const sentence = sentences[i];
    if (/varia[cç][aã]o/i.test(sentence) && !(/\d+(?:[,.]\d+)?\s*%/.test(sentence) || (sentence.match(/R\$\s*\d+(?:[,.]\d+)?/g) || []).length >= 2)) continue;
    if (!/(subiu|subiram|cresceu|cresceram|crescimento|avançou|passou|aument|queda|caiu|caíram|recuou|redu[cç][aã]o|reduziu|contra |declinou|diminuiu|mais do que|menos do que|dobrou|triplicou|varia[cç][aã]o|diferen[cç]a no valor|chegou a|chega a|pontos percentuais)/i.test(sentence)) continue;
    let quote = sentence;
    const explicitTopic = /(chocolate|cacau|produ[cç][aã]o|consumo|p[aá]scoa|ovos|lan[cç]amentos?|exporta[cç][aã]o|importa[cç][aã]o|empregos?)/i.test(quote);
    if (!explicitTopic && i > 0) quote = sentences[i - 1] + " " + quote;
    if (!isGoodEvidenceQuote(quote, text) || seen.has(quote)) continue;
    seen.add(quote);
    const title = quote.length <= 180 ? quote : quote.slice(0, 177) + "...";
    candidates.push({
      signal_type: "change",
      title,
      summary: "A fonte registra o seguinte dado quantitativo: " + quote + " O dado descreve o que a fonte reporta; isoladamente, não comprova mudança de compra, preferência ou comportamento individual do shopper. Tratar como sinal contextual a validar com evidências independentes.",
      confidence: 0.65,
      direction: "new",
      change_score: 0.25,
      evidence: [{ source_item_id: item.id, quote }],
    });
  }
  return candidates;
}

export function deterministicCandidate(item) {
  return deterministicCandidates(item)[0] || null;
}

export function isGenericSummary(summary) {
  return /captured external source reports a quantified change|may be relevant to the industry|fonte externa reporta uma mudança quantitativa gen[eé]rica/i.test(String(summary || ""));
}
