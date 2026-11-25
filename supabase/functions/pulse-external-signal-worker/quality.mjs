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

/* Category topic. The terms come from the industry (industries.signal_topic_terms): nothing in this file names a
   category. A term matches anywhere in a word, without accents or case ("confeit" matches "confeitaria").
   An industry without terms has no declared topic, so nothing is treated as on-topic for it. */
const plainText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function normalizeTopicTerms(terms) {
  return [...new Set((Array.isArray(terms) ? terms : []).map((t) => plainText(t).trim()).filter((t) => t.length >= 3))];
}
export function topicMentions(text, terms) {
  const haystack = plainText(text);
  let count = 0;
  for (const term of normalizeTopicTerms(terms)) {
    for (let i = haystack.indexOf(term); i !== -1; i = haystack.indexOf(term, i + term.length)) count++;
  }
  return count;
}
// Words that make a quantified sentence about a market in any category.
const MARKET_WORDS = /(produ[cç][aã]o|consumo|lan[cç]amentos?|exporta[cç][aã]o|importa[cç][aã]o|empregos?)/i;
const MARKET_UNITS = /(toneladas|R\$|bilh[oõ]es|milh[oõ]es|quilos|\bkg\b)/i;

export function isGoodEvidenceQuote(quote, content, topicTerms) {
  const q = String(quote || "").trim();
  if (q.length < 35 || q.length > 500 || !String(content || "").includes(q)) return false;
  if (/pular para o conte[uú]do|ir para o conte[uú]do|[uú]ltimas not[ií]cias|feed rss|menu|carta de servi[cç]os|transpar[eê]ncia|in[ií]cio\s+[uú]ltimas/i.test(q)) return false;
  if (/(entre jovens|classes [a-e]{1,2}|faixas socioecon[oô]micas|entre consumidores)/i.test(q) && !/(em rela[cç][aã]o a 20\d{2}|comparad[oa] com 20\d{2}|contra 20\d{2}|ante 20\d{2}|pontos percentuais|passou de \d.*para \d|caiu de \d.*para \d|subiu de \d.*para \d)/i.test(q)) return false;
  return /\d/.test(q) && (MARKET_WORDS.test(q) || MARKET_UNITS.test(q) || topicMentions(q, topicTerms) > 0);
}

/* Page layout often glues a heading (the article title, sometimes repeated) before the first sentence. The lead-in
   is cut from the start of the quote, which stays a verbatim suffix of the source text. */
function stripLeadIn(quote, sourceTitle) {
  let q = String(quote || "");
  const keep = (rest) => rest.length >= 35 && /\d/.test(rest);
  for (let changed = true; changed;) {
    changed = false;
    for (let k = 20; k <= q.length / 2; k++) {
      if (q[k] === " " && q.startsWith(q.slice(0, k), k + 1) && keep(q.slice(k + 1))) { q = q.slice(k + 1); changed = true; break; }
    }
  }
  const head = String(sourceTitle || "").split(/\s+[-|\u2013]\s+/)[0].trim();
  if (head.length >= 20 && q.startsWith(head + " ") && keep(q.slice(head.length + 1).trim())) q = q.slice(head.length + 1).trim();
  return q;
}
// A title is the first sentence of the quote, cut at a word boundary when longer than 180 characters.
function signalTitle(quote) {
  const first = String(quote).split(/(?<=[.!?])\s+/)[0];
  if (first.length <= 180) return first;
  const cut = first.slice(0, 177);
  return cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : 177).replace(/[\s,;:]+$/, "") + "...";
}

export function deterministicCandidates(item, topicTerms) {
  const text = String(item.content || "");
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 35 && s.length <= 500);
  const candidates = [];
  const seen = new Set();
  for (let i = 0; i < sentences.length && candidates.length < 5; i++) {
    const sentence = sentences[i];
    if (/varia[cç][aã]o/i.test(sentence) && !(/\d+(?:[,.]\d+)?\s*%/.test(sentence) || (sentence.match(/R\$\s*\d+(?:[,.]\d+)?/g) || []).length >= 2)) continue;
    if (!/(subiu|subiram|cresceu|cresceram|crescimento|avançou|passou|aument|queda|caiu|caíram|recuou|redu[cç][aã]o|reduziu|contra |declinou|diminuiu|mais do que|menos do que|dobrou|triplicou|varia[cç][aã]o|diferen[cç]a no valor|chegou a|chega a|pontos percentuais)/i.test(sentence)) continue;
    let quote = stripLeadIn(sentence, item.title);
    const explicitTopic = MARKET_WORDS.test(quote) || topicMentions(quote, topicTerms) > 0;
    if (!explicitTopic && i > 0) quote = sentences[i - 1] + " " + quote;
    if (!isGoodEvidenceQuote(quote, text, topicTerms) || seen.has(quote)) continue;
    seen.add(quote);
    const title = signalTitle(quote);
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

export function deterministicCandidate(item, topicTerms) {
  return deterministicCandidates(item, topicTerms)[0] || null;
}

export function isGenericSummary(summary) {
  return /captured external source reports a quantified change|may be relevant to the industry|fonte externa reporta uma mudança quantitativa gen[eé]rica/i.test(String(summary || ""));
}

/* Relevance gate: a candidate becomes a signal only with confidence of at least 0.3 and the topic of the industry
   present either in the signal itself (title, summary, quotes), in the title of the source article, or in the
   sentence right before or after the quote in its text. Without topic terms the gate is closed: an industry must declare its topic to receive signals. */
export function isRelevantSignal({ confidence, text, quote, sourceTitle, sourceContent, topicTerms }) {
  if (!(Number(confidence) >= 0.3)) return false;
  if (!normalizeTopicTerms(topicTerms).length) return false;
  if (topicMentions(text, topicTerms) > 0 || topicMentions(sourceTitle, topicTerms) > 0) return true;
  return topicMentions(quoteNeighbourhood(quote || text, sourceContent), topicTerms) > 0;
}
/* The sentence before and the sentence after the quote in the source text. An article that covers several products
   mentions the topic somewhere; only the text around the quote says what the quote is about. */
function quoteNeighbourhood(quote, content) {
  const q = String(quote || "").trim(), c = String(content || "");
  const at = q ? c.indexOf(q) : -1;
  if (at < 0) return "";
  const before = c.slice(0, at).split(/(?<=[.!?])\s+/).filter((x) => x.trim()).slice(-1).join(" ");
  const after = c.slice(at + q.length).split(/(?<=[.!?])\s+/).filter((x) => x.trim()).slice(0, 1).join(" ");
  return `${before} ${after}`;
}
