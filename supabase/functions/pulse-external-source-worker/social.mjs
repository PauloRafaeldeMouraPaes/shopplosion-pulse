/* Public online conversation about the topic of an industry (industries.signal_topic_terms), read through the
   official APIs of each platform, within their free tiers and terms of use:
   - YouTube Data API v3: comments of recent videos found by the topic terms (key in YOUTUBE_API_KEY).
   - Bluesky: public posts found by the topic terms (account in BLUESKY_HANDLE and BLUESKY_APP_PASSWORD; the public
     search answers 403 without login).
   No platform is scraped. Items keep the text and a link to the public post or comment; author names are not kept. */
/* intelligence_sources.source_type only accepts rss, json and html (check constraint), so a social source is a json
   source whose url is the official endpoint of the platform. */
export const SOCIAL_SOURCE_URLS = {
  youtube: "https://www.googleapis.com/youtube/v3/search",
  bluesky: "https://bsky.social/xrpc/app.bsky.feed.searchPosts",
};
export function socialPlatform(sourceType, url) {
  if (sourceType !== "json") return null;
  return Object.keys(SOCIAL_SOURCE_URLS).find((k) => SOCIAL_SOURCE_URLS[k] === String(url || "").trim()) || null;
}

const DAY = 86400000;
const plain = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tidy = (v) => String(v || "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Search terms: the topic terms of the industry, at least 3 letters, without the stems used only for matching.
export function searchTerms(terms, max = 6) {
  const seen = new Set();
  return (Array.isArray(terms) ? terms : [])
    .map((t) => String(t || "").trim())
    .filter((t) => t.length >= 3 && !/-/.test(t) && !seen.has(plain(t)) && seen.add(plain(t)))
    .slice(0, max);
}

async function getJson(fetchFn, url, init) {
  const r = await fetchFn(url, init);
  if (!r.ok) {
    const e = new Error(`http_${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export async function youtubeItems({ terms, apiKey, fetchFn = fetch, now = Date.now(), days = 7, videos = 15, commentsPerVideo = 20 }) {
  if (!apiKey) throw new Error("secret_missing:YOUTUBE_API_KEY");
  const words = searchTerms(terms);
  if (!words.length) return [];
  const q = words.map((t) => (t.includes(" ") ? `"${t}"` : t)).join("|");
  const after = new Date(now - days * DAY).toISOString();
  const search = await getJson(fetchFn, "https://www.googleapis.com/youtube/v3/search?" + new URLSearchParams({
    part: "snippet", type: "video", maxResults: String(videos), order: "date", regionCode: "BR", relevanceLanguage: "pt",
    publishedAfter: after, q, key: apiKey,
  }));
  const items = [];
  for (const v of search.items || []) {
    const id = v?.id?.videoId;
    if (!id) continue;
    const videoTitle = tidy(v.snippet?.title);
    let threads;
    try {
      threads = await getJson(fetchFn, "https://www.googleapis.com/youtube/v3/commentThreads?" + new URLSearchParams({
        part: "snippet", videoId: id, maxResults: String(commentsPerVideo), order: "relevance", textFormat: "plainText", key: apiKey,
      }));
    } catch (e) {
      if (e.status === 403 || e.status === 404) continue; // comments disabled or video gone
      throw e;
    }
    for (const t of threads.items || []) {
      const c = t?.snippet?.topLevelComment;
      const text = tidy(c?.snippet?.textOriginal || c?.snippet?.textDisplay);
      if (!c?.id || text.length < 15) continue;
      items.push({
        external_id: `ytc:${c.id}`,
        title: `Comentário no YouTube: ${videoTitle}`.slice(0, 500),
        url: `https://www.youtube.com/watch?v=${id}&lc=${c.id}`,
        published_at: c.snippet?.publishedAt || v.snippet?.publishedAt || "",
        content: text.slice(0, 2000),
      });
    }
  }
  return items;
}

export async function blueskyItems({ terms, handle, appPassword, fetchFn = fetch, now = Date.now(), days = 7, perTerm = 50 }) {
  if (!handle || !appPassword) throw new Error("secret_missing:BLUESKY_HANDLE/BLUESKY_APP_PASSWORD");
  const words = searchTerms(terms);
  if (!words.length) return [];
  const session = await getJson(fetchFn, "https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  const auth = { headers: { authorization: `Bearer ${session.accessJwt}` } };
  const since = new Date(now - days * DAY).toISOString();
  const byUri = new Map();
  for (const term of words) {
    const res = await getJson(fetchFn, "https://bsky.social/xrpc/app.bsky.feed.searchPosts?" + new URLSearchParams({
      q: term, lang: "pt", sort: "latest", limit: String(perTerm), since,
    }), auth);
    for (const p of res.posts || []) {
      const text = tidy(p?.record?.text);
      const m = String(p?.uri || "").match(/^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/);
      if (!m || text.length < 15 || byUri.has(p.uri)) continue;
      byUri.set(p.uri, {
        external_id: p.uri,
        title: "Post no Bluesky",
        url: `https://bsky.app/profile/${m[1]}/post/${m[2]}`,
        published_at: p.record?.createdAt || p.indexedAt || "",
        content: text.slice(0, 2000),
      });
    }
  }
  return [...byUri.values()];
}

export async function socialItems(platform, { terms, env, fetchFn = fetch, now = Date.now() }) {
  if (platform === "youtube") return youtubeItems({ terms, apiKey: env("YOUTUBE_API_KEY"), fetchFn, now });
  if (platform === "bluesky") return blueskyItems({ terms, handle: env("BLUESKY_HANDLE"), appPassword: env("BLUESKY_APP_PASSWORD"), fetchFn, now });
  throw new Error(`unknown_social_source:${platform}`);
}
