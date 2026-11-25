/* Reading of the public online conversation about the topic of an industry: which themes the posts and comments of
   the last 7 days mention, against the 21 days before. Themes describe how people talk about any product and name
   no category. It is spontaneous public conversation: it shows what is said, not who buys nor how much. */
const DAY = 86400000;
const plain = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const THEMES = [
  { id: "sabor", label: "sabor e gosto", terms: ["sabor", "gosto", "gostoso", "delicia", "amargo", "doce demais", "enjoativ"] },
  { id: "preco", label: "preço e promoção", terms: ["preco", "caro", "barato", "promocao", "desconto", "oferta", "r$", "reais"] },
  { id: "acucar", label: "açúcar, versão zero e saúde", terms: ["acucar", "zero", "diet", "light", "saude", "saudavel", "caloria"] },
  { id: "embalagem", label: "embalagem e tamanho", terms: ["lata", "garrafa", "embalagem", "litro", "tamanho", "pacote", "retornavel"] },
  { id: "ocasiao", label: "ocasião de consumo", terms: ["churrasco", "festa", "almoco", "jantar", "jogo", "calor", "lanche", "fim de semana", "aniversario"] },
  { id: "compra", label: "onde e como compra", terms: ["mercado", "supermercado", "delivery", "aplicativo", "atacado", "padaria", "comprei", "comprar"] },
  { id: "troca", label: "troca e comparação", terms: ["troquei", "prefiro", "melhor que", "pior que", "substitu", "no lugar de"] },
];

const mentions = (text, theme) => {
  const t = ` ${plain(text)} `;
  return theme.terms.some((w) => t.includes(w.length <= 4 ? ` ${w}` : w));
};
const onTopic = (text, topicTerms) => {
  const t = plain(text);
  return (Array.isArray(topicTerms) ? topicTerms : []).map((x) => plain(x).trim()).filter((x) => x.length >= 3).some((x) => t.includes(x));
};
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

// A verbatim excerpt of the item around the first theme word, at most 240 characters.
function excerpt(content, theme) {
  const text = String(content || "");
  const sentences = text.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((s) => mentions(s, theme)) || text;
  return hit.length <= 240 ? hit : hit.slice(0, 240);
}

export function conversationSignals({ items, topicTerms, now = Date.now(), minWeek = 15, minTheme = 5 }) {
  const dated = (items || [])
    .map((it) => ({ it, t: new Date(it.published_at || it.fetched_at || 0).getTime() }))
    .filter(({ it, t }) => Number.isFinite(t) && t <= now && t > now - 28 * DAY && onTopic(it.content, topicTerms));
  const week = dated.filter(({ t }) => t > now - 7 * DAY).map(({ it }) => it);
  const before = dated.filter(({ t }) => t <= now - 7 * DAY).map(({ it }) => it);
  if (week.length < minWeek) return [];
  const out = [];
  for (const theme of THEMES) {
    const hits = week.filter((it) => mentions(it.content, theme));
    if (hits.length < minTheme) continue;
    const share = pct(hits.length, week.length);
    const baseHits = before.filter((it) => mentions(it.content, theme)).length;
    const hasBase = before.length >= minWeek;
    const baseShare = hasBase ? pct(baseHits, before.length) : null;
    const direction = baseShare == null ? "new" : share - baseShare >= 5 ? "up" : share - baseShare <= -5 ? "down" : "stable";
    const compare = baseShare == null
      ? "Ainda não há três semanas anteriores com volume suficiente para comparar."
      : `Nas três semanas anteriores, ${baseShare}% de ${before.length} menções citavam o tema.`;
    const examples = hits.slice(0, 2).map((it) => ({ item: it, quote: excerpt(it.content, theme) }));
    out.push({
      key: `conversa|${theme.id}`,
      theme: theme.id,
      signal_type: "change",
      title: `Conversa online: ${theme.label} em ${share}% das menções da semana`,
      summary: `Em ${week.length} posts e comentários públicos dos últimos 7 dias sobre o tema da indústria, ${hits.length} citam ${theme.label} (${share}%). ${compare} É conversa pública espontânea: mostra o que se fala, não quem compra nem quanto.`,
      confidence: 0.5,
      direction,
      share,
      base_share: baseShare,
      examples,
    });
  }
  return out;
}
