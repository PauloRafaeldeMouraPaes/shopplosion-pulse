// The HTML source worker keeps the main text of a news page, not the first card of a sidebar.
// Found 2026-11-24 in the soft drink demo: a page with 14 short <article> cards and the story only in the
// JSON-LD articleBody was captured with 192 characters (the title and a sidebar headline).
import assert from "node:assert/strict";
import { htmlArticleContent } from "../supabase/functions/pulse-external-source-worker/extract.mjs";

const strip = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const story = "As bebidas sem açúcar ganham espaço no carrinho, mesmo com preço maior. ".repeat(8) + "A presença no varejo passou de 18,6% para 22,5% entre 2024 e 2026.";
const card = (n) => `<article class="card"><h3>Outra notícia ${n} do portal</h3><p>Resumo curto da notícia ${n}.</p></article>`;

// 1. Many sidebar cards and the story only in JSON-LD: the story is chosen.
const ld = `<script type="application/ld+json">{"@type":"NewsArticle","headline":"Bebidas sem açúcar","articleBody":${JSON.stringify(story)}}</script>`;
const page1 = `<html><head>${ld}</head><body><nav>Menu Início Notícias</nav>${Array.from({ length: 14 }, (_, i) => card(i)).join("")}<div class="entry-content"><p>${story}</p></div></body></html>`;
assert.ok(strip(htmlArticleContent(page1)).includes("passou de 18,6% para 22,5%"), "the story text is captured");
assert.ok(!strip(htmlArticleContent(page1)).startsWith("Outra notícia 0"), "a sidebar card is not the content");

// 2. The longest <article> wins over a short first one.
const page2 = `<body>${card(1)}<article class="post"><p>${story}</p></article>${card(2)}</body>`;
assert.ok(strip(htmlArticleContent(page2)).includes("passou de 18,6% para 22,5%"));

// 3. A page with one <article> and no JSON-LD keeps working as before.
const page3 = `<body><nav>Menu</nav><article><p>${story}</p></article><footer>Rodapé</footer></body>`;
assert.equal(strip(htmlArticleContent(page3)), strip(`<p>${story}</p>`));

// 4. <main> when there is no article; the whole page when there is neither.
assert.equal(strip(htmlArticleContent(`<body><nav>x</nav><main><p>${story}</p></main></body>`)), strip(story));
const bare = `<body><p>${story}</p></body>`;
assert.equal(htmlArticleContent(bare), bare);

// 5. A malformed articleBody does not break the capture.
assert.ok(strip(htmlArticleContent(`<script>{"articleBody":"quebrado \\x"}</script><article><p>${story}</p></article>`)).includes("22,5%"));

console.log("HTML article content: PASS");
