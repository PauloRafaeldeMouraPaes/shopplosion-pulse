// Online conversation: collectors read only official APIs with the industry topic terms, and the reading of themes
// counts what is said without naming any category.
import assert from "node:assert/strict";
import { searchTerms, youtubeItems, blueskyItems, socialItems } from "../supabase/functions/pulse-external-source-worker/social.mjs";
import { conversationSignals, THEMES } from "../supabase/functions/pulse-external-deterministic-backstop/conversation.mjs";

const now = Date.parse("2026-11-25T12:00:00Z");
const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
const res = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

// Search terms come from the industry, never from the code; matching-only stems are left out.
assert.deepEqual(searchTerms(["cafe", "cafe", "nao-alcoolic", "x", "cafe soluvel"]), ["cafe", "cafe soluvel"]);

// Missing secrets fail with a clear reason, recorded as the source error.
await assert.rejects(youtubeItems({ terms: ["cafe"], apiKey: "" }), /secret_missing:YOUTUBE_API_KEY/);
await assert.rejects(blueskyItems({ terms: ["cafe"], handle: "", appPassword: "" }), /secret_missing:BLUESKY/);

// YouTube: one search with the terms, then comments of each video; disabled comments are skipped.
{
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    if (u.pathname.endsWith("/search")) {
      assert.equal(u.searchParams.get("q"), 'cafe|"cafe soluvel"');
      assert.equal(u.searchParams.get("regionCode"), "BR");
      assert.equal(u.searchParams.get("publishedAfter"), iso(7));
      return res({ items: [{ id: { videoId: "v1" }, snippet: { title: "Teste &amp; resenha", publishedAt: iso(2) } }, { id: { videoId: "v2" }, snippet: { title: "Sem comentários" } }] });
    }
    if (u.searchParams.get("videoId") === "v2") return res({}, 403);
    return res({ items: [
      { snippet: { topLevelComment: { id: "c1", snippet: { textOriginal: "Achei o preço muito alto no mercado esta semana", publishedAt: iso(1), authorDisplayName: "Fulano" } } } },
      { snippet: { topLevelComment: { id: "c2", snippet: { textOriginal: "ok" } } } },
    ] });
  };
  const items = await youtubeItems({ terms: ["cafe", "cafe soluvel"], apiKey: "k", fetchFn, now });
  assert.equal(items.length, 1, "short comments are dropped");
  assert.equal(items[0].external_id, "ytc:c1");
  assert.equal(items[0].url, "https://www.youtube.com/watch?v=v1&lc=c1");
  assert.equal(items[0].title, "Comentário no YouTube: Teste & resenha");
  assert.ok(!JSON.stringify(items).includes("Fulano"), "author names are not kept");
  assert.ok(calls.every((c) => c.startsWith("https://www.googleapis.com/youtube/v3/")), "only the official API is called");
}

// Bluesky: one login, one search per term, posts deduplicated, link by DID without the handle.
{
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith("createSession")) {
      assert.deepEqual(JSON.parse(init.body), { identifier: "h.bsky.social", password: "app-pass" });
      return res({ accessJwt: "jwt" });
    }
    assert.equal(init.headers.authorization, "Bearer jwt");
    const post = { uri: "at://did:plc:abc/app.bsky.feed.post/3k1", indexedAt: iso(1), record: { text: "Prefiro a versão sem açúcar no calor", createdAt: iso(1) }, author: { handle: "alguem.bsky.social" } };
    return res({ posts: [post] });
  };
  const items = await blueskyItems({ terms: ["cafe", "cafe soluvel"], handle: "h.bsky.social", appPassword: "app-pass", fetchFn, now });
  assert.equal(calls.filter((c) => c.includes("searchPosts")).length, 2);
  assert.equal(items.length, 1, "the same post found by two terms is kept once");
  assert.equal(items[0].url, "https://bsky.app/profile/did:plc:abc/post/3k1");
  assert.ok(!JSON.stringify(items).includes("alguem.bsky.social"), "handles are not kept");
}

await assert.rejects(socialItems("x", { terms: [], env: () => "" }), /unknown_social_source/);

// Conversation reading.
{
  const topic = ["cafe"];
  const mk = (n, daysAgo, text) => Array.from({ length: n }, (_, i) => ({ id: `${daysAgo}-${i}-${text.length}`, source_id: "s", url: "u", title: "t", published_at: iso(daysAgo), content: text }));
  const week = [...mk(8, 2, "O cafe ficou caro demais no mercado."), ...mk(12, 3, "Tomei um cafe no lanche da tarde.")];
  const before = [...mk(2, 10, "O cafe ficou caro."), ...mk(18, 15, "Cafe bom de manhã.")];
  const offTopic = mk(30, 1, "O preço da gasolina subiu.");
  const out = conversationSignals({ items: [...week, ...before, ...offTopic], topicTerms: topic, now });
  const preco = out.find((s) => s.theme === "preco");
  assert.ok(preco, "a theme with at least 5 mentions in the week becomes a reading");
  assert.equal(preco.share, 40, "8 of 20 on-topic items of the week; off-topic items do not count");
  assert.equal(preco.base_share, 10);
  assert.equal(preco.direction, "up");
  assert.match(preco.summary, /não quem compra nem quanto/);
  assert.ok(preco.examples.every((e) => e.item.content.includes(e.quote)), "examples are verbatim");
  assert.equal(preco.key, "conversa|preco", "one signal per theme, updated every week");
  assert.ok(!out.find((s) => s.theme === "embalagem"), "a theme without mentions is not a reading");
  assert.deepEqual(conversationSignals({ items: mk(10, 1, "cafe caro"), topicTerms: topic, now }), [], "too little conversation in the week, no reading");
  const fresh = conversationSignals({ items: week, topicTerms: topic, now }).find((s) => s.theme === "preco");
  assert.equal(fresh.direction, "new");
  assert.match(fresh.summary, /Ainda não há três semanas anteriores/);
  assert.ok(THEMES.length >= 5);
}

console.log("social conversation: PASS");

// The workers keep the social items out of the extraction of quantified changes and read them only as conversation.
import { readFileSync } from "node:fs";
const src = (p) => readFileSync(new URL(`../supabase/functions/${p}`, import.meta.url), "utf8");
for (const w of ["pulse-external-signal-worker/index.ts", "pulse-external-deterministic-backstop/index.ts"]) {
  assert.match(src(w), /in\('source_type',\['youtube','bluesky'\]\)/, `${w} must look up the social sources`);
  assert.match(src(w), /\.not\('source_id','in',/, `${w} must exclude social items from the extraction`);
}
assert.match(src("pulse-external-deterministic-backstop/index.ts"), /conversationSignals\(/);
assert.match(src("pulse-external-source-worker/index.ts"), /SOCIAL_SOURCE_TYPES\.includes\(s\.source_type\)/);
console.log("social workers wiring: PASS");
