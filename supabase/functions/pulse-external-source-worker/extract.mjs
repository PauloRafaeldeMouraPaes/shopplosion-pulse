/* Main text of an HTML page. Candidates are every <article>, the <main> element and the JSON-LD articleBody;
   the one with the most visible text wins, so a sidebar card that comes first is not taken for the story.
   Without any candidate the whole page is returned, as before. */
const visible = (html) => String(html || "")
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function htmlArticleContent(html) {
  const page = String(html || "");
  const candidates = [];
  for (const m of page.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)) candidates.push(m[1]);
  const main = page.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) candidates.push(main[1]);
  for (const m of page.matchAll(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    try { candidates.push(JSON.parse(`"${m[1]}"`)); } catch { /* malformed JSON-LD: ignored */ }
  }
  if (!candidates.length) return page;
  return candidates.reduce((best, c) => (visible(c).length > visible(best).length ? c : best));
}
