#!/usr/bin/env node
/* Ask AI provider comparison: Gemini (current) vs Claude, on the same public-scope prompt.

   It rebuilds, for each question in docs/eval/ask-ai-questions.json, exactly what the pulse-ask-ai Edge
   Function sends in public ("universe") scope: the same lexical retrieval over PULSE_PUBLIC_EVIDENCE, the
   same system prompt and the same user prompt template. Both are extracted from
   supabase/functions/pulse-ask-ai/index.ts at run time, so the comparison cannot drift from production.

   Usage
     node scripts/eval-ask-ai-providers.mjs --out <dir> [--gemini-model gemini-3.5-flash-lite] [--claude-model claude-haiku-5-5]
          [--price-gemini-in USD/MTok --price-gemini-out USD/MTok --price-claude-in USD/MTok --price-claude-out USD/MTok]
          [--monthly-questions N] [--usd-brl RATE] [--budget-brl 100] [--limit N]
     node scripts/eval-ask-ai-providers.mjs --self-test     (no network; checks retrieval, prompt extraction and scoring)

   Keys come only from the environment (GEMINI_API_KEY, ANTHROPIC_API_KEY) and are never printed or written.
   Prices are inputs on purpose: they must be copied from the providers' official pricing pages on the day of
   the run. Without prices, token counts are reported and the cost section says "not computed".

   Automatic scoring (per answer) is deliberately conservative and only measures what can be checked:
   - format: the five required blocks (LEITURA, HIPÓTESE, RECOMENDAÇÃO, DESCONHECIDOS, ATUALIZAÇÃO);
   - citations: at least one [Ex] and every cited ref exists among the retrieved evidence;
   - unsupported numbers: numbers in the answer that do not appear in the retrieved evidence or the question
     (years and refs are ignored); each one is a possible invention;
   - unsupported questions: the answer must say the evidence does not support it and carry no unsupported number.
   Quality of reasoning is judged by a human on the blind review sheet (answers shuffled as A/B). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomInt } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_TS = join(ROOT, "supabase/functions/pulse-ask-ai/index.ts");
const EVIDENCE_TS = join(ROOT, "supabase/functions/pulse-ask-ai/public-evidence.ts");
const QUESTIONS = join(ROOT, "docs/eval/ask-ai-questions.json");
const MAX_OUTPUT_TOKENS = 700;
const BLOCKS = ["LEITURA", "HIPÓTESE", "RECOMENDAÇÃO", "DESCONHECIDOS", "ATUALIZAÇÃO"];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  return out;
}

/* ---------- mirror of the Edge Function ---------- */

export function loadPublicEvidence() {
  const s = readFileSync(EVIDENCE_TS, "utf8");
  const start = s.indexOf("[", s.indexOf("export const PULSE_PUBLIC_EVIDENCE ="));
  const end = s.lastIndexOf("] as const");
  return JSON.parse(s.slice(start, end + 1));
}

export function extractPrompts() {
  const s = readFileSync(INDEX_TS, "utf8");
  const sys = /const system = '((?:[^'\\]|\\.)*)'/.exec(s);
  const tpl = /const prompt = `((?:[^`\\]|\\.)*)`/.exec(s);
  if (!sys || !tpl) throw new Error("could not extract the system prompt or the prompt template from pulse-ask-ai/index.ts");
  const system = sys[1].replace(/\\'/g, "'");
  // The template only references these names; evaluate it with the public-scope values.
  const render = new Function("query", "scope", "industry", "originatingEvidenceId", "clientRetrievedEvidence", "evidenceText", "priorKnowledgeText", "return `" + tpl[1] + "`;");
  return { system, render };
}

let rankPublic = null;
function productionRanker() {
  // The ranking block is read from the Edge Function itself (type annotations stripped), so the eval always
  // retrieves exactly what production retrieves.
  if (rankPublic) return rankPublic;
  const s = readFileSync(INDEX_TS, "utf8");
  const a = s.indexOf("/* PULSE_PUBLIC_RANK_START */"), b = s.indexOf("/* PULSE_PUBLIC_RANK_END */");
  if (a < 0 || b < 0) throw new Error("ranking block not found in pulse-ask-ai/index.ts");
  const js = s.slice(a, b).replace(/\(idf as any\)/g, "idf").replace(/Object\.fromEntries<number>/g, "Object.fromEntries").replace(/: (any|string|number)\b/g, "");
  rankPublic = new Function(js + "\nreturn pulseRankPublic;")();
  return rankPublic;
}

export function retrieve(query, evidenceItems) {
  return productionRanker()(query, evidenceItems).slice(0, 8).map((r, i) => {
    const item = r.item;
    const content = [item.fato, item.contexto, item.interpretacao, item.hipotese, item.acao, ...(Array.isArray(item.keywords) ? item.keywords : [])].filter(Boolean).join(" ");
    return { ref: `E${i + 1}`, id: item.id, document: item.fonte || "Mercado publicado", content: String(content).slice(0, 5000) };
  });
}

export function buildPrompt(query, retrieved, prompts) {
  const evidenceText = retrieved.map((e) => `<evidence ref="${e.ref}" document="${e.document}" chunk="1" source="public">${e.content}</evidence>`).join("\n");
  const user = prompts.render(query, "universe", { name: "" }, "", [], evidenceText, "Nenhum conhecimento anterior vinculado.");
  return { system: prompts.system, user };
}

/* ---------- providers ---------- */
async function callGemini(model, system, user, key) {
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS } }),
  });
  const ms = Date.now() - t0; const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, ms, error: String(j?.error?.message || r.statusText).slice(0, 300) };
  const text = (j?.candidates?.[0]?.content?.parts || []).filter((p) => typeof p?.text === "string").map((p) => p.text).join("").trim();
  return { ok: !!text, status: r.status, ms, text, inTok: j?.usageMetadata?.promptTokenCount ?? null, outTok: (j?.usageMetadata?.candidatesTokenCount ?? 0) + (j?.usageMetadata?.thoughtsTokenCount ?? 0) };
}
async function callClaude(model, system, user, key) {
  const t0 = Date.now();
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, system, messages: [{ role: "user", content: user }] }),
  });
  const ms = Date.now() - t0; const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, ms, error: String(j?.error?.message || r.statusText).slice(0, 300) };
  const text = (j?.content || []).filter((c) => c?.type === "text").map((c) => c.text).join("").trim();
  return { ok: !!text, status: r.status, ms, text, inTok: j?.usage?.input_tokens ?? null, outTok: j?.usage?.output_tokens ?? null, stop: j?.stop_reason };
}

/* ---------- scoring ---------- */
const numbersIn = (s) => (String(s).match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
export function scoreAnswer(answer, retrieved, question) {
  const text = String(answer || "");
  const blocks = BLOCKS.filter((b) => new RegExp(`(^|\\n)\\s*\\**${b}\\**\\s*:`, "i").test(text));
  const refs = Array.from(new Set((text.match(/\[E(\d+)\]/g) || []).map((x) => x.slice(1, -1))));
  const valid = new Set(retrieved.map((e) => e.ref));
  const badRefs = refs.filter((r) => !valid.has(r));
  const pool = new Set(numbersIn(retrieved.map((e) => e.content).join(" ") + " " + question.q).map(Number).map(String));
  const answerNumbers = numbersIn(text.replace(/\[E\d+\]/g, "")).filter((n) => !/^(19|20)\d{2}$/.test(n));
  const unsupported = Array.from(new Set(answerNumbers.filter((n) => !pool.has(String(Number(n))))));
  const declines = /n[aã]o (h[aá]|encontr|permit|sustent|cont[eé]m|traz|apresent|consta)|insuficien|sem evid[eê]ncia|não (é|e) poss[ií]vel/i.test(text);
  const formatOk = blocks.length === BLOCKS.length;
  const citationOk = question.kind === "unsupported" ? badRefs.length === 0 : refs.length > 0 && badRefs.length === 0;
  const groundingOk = unsupported.length === 0;
  const declineOk = question.kind === "unsupported" ? declines && unsupported.length === 0 : true;
  return { blocks: blocks.length, refs, badRefs, unsupported, declines, formatOk, citationOk, groundingOk, declineOk, pass: formatOk && citationOk && groundingOk && declineOk };
}

/* ---------- report ---------- */
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + "%";
function summarize(rows, provider) {
  const r = rows.map((x) => x[provider]).filter(Boolean);
  const ok = r.filter((x) => x.ok);
  const sc = ok.map((x) => x.score);
  const avg = (f) => (ok.length ? ok.reduce((t, x) => t + (f(x) || 0), 0) / ok.length : 0);
  return {
    calls: r.length, ok: ok.length, errors: r.length - ok.length,
    pass: sc.filter((s) => s.pass).length, format: sc.filter((s) => s.formatOk).length, citations: sc.filter((s) => s.citationOk).length,
    grounded: sc.filter((s) => s.groundingOk).length, unsupportedNumbers: sc.reduce((t, s) => t + s.unsupported.length, 0),
    declineOk: rows.filter((x) => x.kind === "unsupported" && x[provider]?.ok && x[provider].score.declineOk).length,
    unsupportedQuestions: rows.filter((x) => x.kind === "unsupported").length,
    avgIn: Math.round(avg((x) => x.inTok)), avgOut: Math.round(avg((x) => x.outTok)), avgMs: Math.round(avg((x) => x.ms)),
  };
}
function monthlyCost(s, priceIn, priceOut, monthly, fx) {
  if (!(priceIn > 0) || !(priceOut > 0)) return null;
  const perAnswerUsd = (s.avgIn * priceIn + s.avgOut * priceOut) / 1e6;
  const monthUsd = perAnswerUsd * monthly;
  return { perAnswerUsd, monthUsd, monthBrl: fx > 0 ? monthUsd * fx : null, answersPerBudget: null };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a["self-test"]) return selfTest();
  const out = resolve(a.out || "ask-ai-eval");
  mkdirSync(out, { recursive: true });
  const gm = a["gemini-model"] || "gemini-3.5-flash-lite";
  const cm = a["claude-model"] || "claude-haiku-5-5";
  const gk = process.env.GEMINI_API_KEY || ""; const ck = process.env.ANTHROPIC_API_KEY || "";
  if (!gk || !ck) { console.error("GEMINI_API_KEY and ANTHROPIC_API_KEY must both be set (as secrets); nothing was called."); process.exit(2); }
  const prompts = extractPrompts(); const evidence = loadPublicEvidence();
  const set = JSON.parse(readFileSync(QUESTIONS, "utf8"));
  const qs = set.questions.slice(0, Number(a.limit) || set.questions.length);
  const rows = [];
  for (const q of qs) {
    const retrieved = retrieve(q.q, evidence);
    const missingExpected = q.expect_ids.filter((id) => !retrieved.some((e) => e.id === id));
    const row = { id: q.id, kind: q.kind, question: q.q, retrieved: retrieved.map((e) => e.id), missingExpected };
    if (!retrieved.length) { row.note = "no evidence retrieved: production answers deterministically without calling a model"; rows.push(row); console.log(`${q.id} skipped (no evidence retrieved)`); continue; }
    const { system, user } = buildPrompt(q.q, retrieved, prompts);
    for (const [name, call, model, key] of [["gemini", callGemini, gm, gk], ["claude", callClaude, cm, ck]]) {
      let res; try { res = await call(model, system, user, key); } catch (e) { res = { ok: false, status: 0, error: String(e).slice(0, 200) }; }
      if (res.ok) res.score = scoreAnswer(res.text, retrieved, q);
      row[name] = res;
    }
    rows.push(row);
    console.log(`${q.id} gemini=${row.gemini.ok ? (row.gemini.score.pass ? "pass" : "fail") : "error " + row.gemini.status} claude=${row.claude.ok ? (row.claude.score.pass ? "pass" : "fail") : "error " + row.claude.status}`);
  }
  const g = summarize(rows, "gemini"), c = summarize(rows, "claude");
  const monthly = Number(a["monthly-questions"]) || 0, fx = Number(a["usd-brl"]) || 0, budget = Number(a["budget-brl"]) || 100;
  const gc = monthlyCost(g, Number(a["price-gemini-in"]), Number(a["price-gemini-out"]), monthly, fx);
  const cc = monthlyCost(c, Number(a["price-claude-in"]), Number(a["price-claude-out"]), monthly, fx);
  const record = { generated_at_utc: new Date().toISOString(), models: { gemini: gm, claude: cm }, prompt_sha256: createHash("sha256").update(prompts.system).digest("hex"), questions: qs.length, summary: { gemini: g, claude: c }, cost: { monthly_questions: monthly, usd_brl: fx, budget_brl: budget, gemini: gc, claude: cc, prices_source: "inputs of this run (copy from the official pricing pages)" }, rows };
  writeFileSync(join(out, "results.json"), JSON.stringify(record, null, 2));
  // Blind review sheet: per question, answers shuffled as A/B; the key is written separately.
  const sheet = [], key = [];
  for (const r of rows.filter((x) => x.gemini?.ok && x.claude?.ok)) {
    const flip = randomInt(2) === 1; const A = flip ? r.claude : r.gemini, B = flip ? r.gemini : r.claude;
    sheet.push(`## ${r.id} (${r.kind}) ${r.question}\n\nEvidências recuperadas: ${r.retrieved.join(", ")}\n\n### Resposta A\n\n${A.text}\n\n### Resposta B\n\n${B.text}\n\nMelhor: [ ] A  [ ] B  [ ] empate. Erro factual em A? [ ]  em B? [ ]\n`);
    key.push({ id: r.id, A: flip ? "claude" : "gemini", B: flip ? "gemini" : "claude" });
  }
  writeFileSync(join(out, "blind-review.md"), `# Revisão cega Ask AI (${sheet.length} perguntas)\n\nNão abra blind-review-key.json antes de marcar.\n\n` + sheet.join("\n---\n\n"));
  writeFileSync(join(out, "blind-review-key.json"), JSON.stringify(key, null, 2));
  const line = (n, s, cost) => `| ${n} | ${s.ok}/${s.calls} | ${s.pass} | ${s.format} | ${s.citations} | ${s.grounded} (${s.unsupportedNumbers} números sem suporte) | ${s.declineOk}/${s.unsupportedQuestions} | ${s.avgIn} / ${s.avgOut} | ${s.avgMs} ms | ${cost ? "US$ " + cost.perAnswerUsd.toFixed(5) + (monthly ? "; mês US$ " + cost.monthUsd.toFixed(2) + (cost.monthBrl != null ? " (R$ " + cost.monthBrl.toFixed(2) + ")" : "") : "") : "não calculado"} |`;
  const fits = cc && cc.monthBrl != null ? (cc.monthBrl <= budget ? `cabe no orçamento de R$ ${budget} com ${monthly} perguntas/mês` : `NÃO cabe no orçamento de R$ ${budget} com ${monthly} perguntas/mês`) : "custo mensal não calculado (faltam preços, volume ou câmbio)";
  const md = `# Ask AI: ${gm} vs ${cm}\n\nGerado em ${record.generated_at_utc}. ${qs.length} perguntas (${rows.filter((r) => !r.gemini).length} sem evidência recuperada, respondidas deterministicamente em produção e não enviadas aos modelos).\n\n| Modelo | Respostas | Aprovadas (todos os critérios) | Formato | Citações válidas | Sem número sem suporte | Recusa correta em perguntas sem evidência | Tokens entrada/saída médios | Latência média | Custo |\n|---|---|---|---|---|---|---|---|---|---|\n${line(gm, g, gc)}\n${line(cm, c, cc)}\n\nClaude: ${fits}.\n\nCritério combinado para trocar: Claude melhor na revisão cega e nos critérios automáticos, e custo mensal dentro do orçamento. Pontuação automática mede formato, citações e números inventados; qualidade do raciocínio vem da revisão cega (blind-review.md).\n\nRecuperação: ${rows.filter((r) => r.missingExpected?.length).length} perguntas não recuperaram alguma evidência esperada (ver results.json, campo missingExpected); isso é limitação da busca lexical atual, igual para os dois modelos.\n`;
  writeFileSync(join(out, "report.md"), md);
  console.log("\n" + md);
}

function selfTest() {
  const assert = (c, m) => { if (!c) { console.error("SELF-TEST FAILED: " + m); process.exit(1); } };
  const prompts = extractPrompts(); const evidence = loadPublicEvidence();
  assert(prompts.system.includes("Use SOMENTE as evidências fornecidas"), "system prompt extracted from index.ts");
  const ret = retrieve("Qual a produção brasileira de chocolate em 2024 e 2025?", evidence);
  assert(ret.some((e) => e.id === "abicab-chocolate-producao-brasil-2025-pascoa-2026"), "retrieval finds the Abicab item");
  const { user } = buildPrompt("pergunta", ret, prompts);
  assert(user.includes("Escopo selecionado: universe") && user.includes('<evidence ref="E1"') && user.includes("LEITURA:"), "user prompt rendered from the production template");
  const q = { q: "Qual a produção?", kind: "grounded" };
  const good = "LEITURA: A produção passou de 806 mil toneladas para 814 mil toneladas [E1].\nHIPÓTESE: x\nRECOMENDAÇÃO: y [E1]\nDESCONHECIDOS: z\nATUALIZAÇÃO: INSUFFICIENT porque não há conhecimento anterior.";
  const s1 = scoreAnswer(good, ret, q);
  assert(s1.pass, "a grounded, cited, well-formed answer passes: " + JSON.stringify(s1));
  const s2 = scoreAnswer(good.replace("814 mil", "999 mil"), ret, q);
  assert(!s2.groundingOk && s2.unsupported.includes("999"), "an invented number is flagged");
  const s3 = scoreAnswer(good.replace("[E1].", "[E9]."), ret, q);
  assert(!s3.citationOk, "a citation to a non-retrieved ref fails");
  const s4 = scoreAnswer("LEITURA: x\nHIPÓTESE: y", ret, q);
  assert(!s4.formatOk, "missing blocks fail the format check");
  const uq = { q: "Qual o market share da Nestlé?", kind: "unsupported" };
  const s5 = scoreAnswer("LEITURA: As evidências não sustentam essa resposta.\nHIPÓTESE: nenhuma\nRECOMENDAÇÃO: buscar dados de painel\nDESCONHECIDOS: market share\nATUALIZAÇÃO: INSUFFICIENT", ret, uq);
  assert(s5.pass, "declining an unsupported question passes: " + JSON.stringify(s5));
  const s6 = scoreAnswer("LEITURA: A Nestlé tem 37% de share [E1].\nHIPÓTESE: x\nRECOMENDAÇÃO: y\nDESCONHECIDOS: z\nATUALIZAÇÃO: INSUFFICIENT", ret, uq);
  assert(!s6.pass, "an invented share on an unsupported question fails");
  const set = JSON.parse(readFileSync(QUESTIONS, "utf8"));
  const ids = new Set(evidence.map((e) => e.id));
  for (const qq of set.questions) for (const id of qq.expect_ids) assert(ids.has(id), `${qq.id} expects unknown evidence id ${id}`);
  console.log(`Ask AI provider eval self-test: PASS (prompt extracted from index.ts, ${set.questions.length} questions, scoring checks)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(String(e)); process.exit(1); });
