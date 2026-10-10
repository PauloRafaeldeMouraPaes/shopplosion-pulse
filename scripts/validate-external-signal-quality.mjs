import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { deterministicCandidate, deterministicCandidates, isGoodEvidenceQuote, isGenericSummary } from "../supabase/functions/pulse-external-signal-worker/quality.mjs";

const abicab = {
  id: "abicab-item",
  content: "Cabeçalho. A produção de chocolates avançou de 806 mil toneladas em 2024 para 814 mil toneladas em 2025. Já o volume de ovos de Páscoa passou de 45 milhões no ano passado para 46 milhões neste ano. Outro destaque foi a geração de empregos temporários, que cresceu no período: de 9.946 vagas na Páscoa anterior para 14.558 em 2026. A diversidade de produtos também se ampliou. Neste ano, estão sendo lançados 134 lançamentos (contra 94 em 2025).",
};
const production = deterministicCandidate(abicab);
assert.ok(production, "quantified production change should be detected");
assert.match(production.title, /806 mil toneladas em 2024 para 814 mil toneladas em 2025/);
assert.equal(production.evidence[0].quote, "A produção de chocolates avançou de 806 mil toneladas em 2024 para 814 mil toneladas em 2025.");
assert.match(production.summary, /não comprova mudança de compra/);
assert.ok(isGoodEvidenceQuote(production.evidence[0].quote, abicab.content));

const abicabSignals = deterministicCandidates(abicab);
assert.ok(abicabSignals.length >= 3, "one source page should yield multiple distinct quantified facts");
assert.ok(abicabSignals.some((s) => /ovos de Páscoa/.test(s.title)), "Easter volume change should be extracted");
assert.ok(abicabSignals.some((s) => /empregos temporários/.test(s.title)), "temporary jobs change should be extracted");
assert.ok(abicabSignals.some((s) => /134 lançamentos/.test(s.title)), "product launch change should be extracted");


const agency = {
  id: "agency-item",
  content: "Em 2024, foram produzidas 805 mil toneladas de chocolates no país. O número subiu para 814 mil toneladas no ano passado.",
};
const agencySignal = deterministicCandidate(agency);
assert.ok(agencySignal, "change with a pronoun should retain its prior context");
assert.match(agencySignal.evidence[0].quote, /805 mil toneladas de chocolates no país\. O número subiu para 814 mil toneladas/);


const launches = deterministicCandidate({ id: "launches", content: "Neste ano, estão sendo lançados 134 lançamentos (contra 94 em 2025)." });
assert.ok(launches, "launch count change should be detected");
assert.match(launches.title, /134 lançamentos/);

assert.equal(deterministicCandidate({ id: "nav", content: "Menu. Últimas notícias. Feed RSS. Início." }), null);

assert.equal(deterministicCandidate({ id: "static-export", content: "No primeiro trimestre de 2026, o total exportado de chocolates atingiu 7,7 mil toneladas, o que correspondeu a US$ 47 milhões." }), null, "a standalone total is context, not a detected change");
assert.equal(deterministicCandidate({ id: "static-import", content: "A importação somou US$ 57 milhões, correspondendo a 4,7 mil toneladas." }), null, "a standalone import total is not a change");
assert.equal(deterministicCandidate({ id: "static-market-gap", content: "Quando comparado com outros mercados, o consumo per capita é de 9 kg a 10 kg por ano." }), null, "a static cross-market benchmark is context, not an emerging change");

assert.equal(deterministicCandidate({ id: "employment-context", content: "A Páscoa funciona sempre como porta de entrada dos trabalhadores para o setor, com taxa de empregabilidade de 30%, informou o presidente da entidade." }), null, "a numeric fact plus unrelated 'de ... para' wording is not a change");
assert.equal(deterministicCandidate({ id: "program-duration", content: "O programa existe há mais de 20 anos com a finalidade de abrir mercado para pequenos fabricantes." }), null, "program duration is not a change");

const retailPrice = deterministicCandidate({ id: "procon-retail", content: "Entre os ovos de Páscoa, a variação de preço de um mesmo produto entre os estabelecimentos chegou a 31,91%." });
assert.ok(retailPrice, "retail price dispersion should be detected as a quantified change");
assert.match(retailPrice.evidence[0].quote, /variação de preço.*31,91%/);
assert.equal(deterministicCandidate({ id: "retail-incomplete", content: "A maior variação percentual de preço, contudo, foi encontrada no valor de uma barra de chocolate de 80 gramas." }), null, "product weight alone must not be mistaken for a quantified price change");
assert.equal(isGoodEvidenceQuote("O levantamento indicou que 22% dos brasileiros pretendem produzir ou vender chocolates na data. Entre jovens de 18 a 29 anos, esse percentual sobe para 29%, e nas classes DE chega a 33%.", "O levantamento indicou que 22% dos brasileiros pretendem produzir ou vender chocolates na data. Entre jovens de 18 a 29 anos, esse percentual sobe para 29%, e nas classes DE chega a 33%."), false, "cross-sectional segment shares without a temporal comparison are not emerging changes");

const shopperSurvey = deterministicCandidate({ id: "shopper-survey", content: "Pesquisa aponta que 90% dos consumidores comprarão chocolate na Páscoa. Índice é 4 pontos percentuais maior do que o declarado em 2025." });
assert.ok(shopperSurvey, "a year-over-year shopper-intent shift in percentage points should be detected");
assert.match(shopperSurvey.evidence[0].quote, /90% dos consumidores.*4 pontos percentuais maior/);


assert.equal(isGoodEvidenceQuote("Pular para o conteúdo principal Menu Últimas Notícias 2026", "Pular para o conteúdo principal Menu Últimas Notícias 2026"), false);
assert.equal(isGenericSummary("A captured external source reports a quantified change that may be relevant to the industry."), true);
assert.equal(isGenericSummary(production.summary), false);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const signalWorker = readFileSync(resolve(root, "supabase/functions/pulse-external-signal-worker/index.ts"), "utf8");
const backstopWorker = readFileSync(resolve(root, "supabase/functions/pulse-external-deterministic-backstop/index.ts"), "utf8");
assert.doesNotMatch(signalWorker, /\.upsert\(payload,\{onConflict:'industry_id,signal_key'\}\)/, "partial unique index must not be targeted by an invalid PostgREST upsert");
assert.match(signalWorker, /isGoodEvidenceQuote/);
assert.match(signalWorker, /const duplicate=candidates\.some/, "deterministic evidence must supplement, not be suppressed by, another valid LLM quote");
assert.doesNotMatch(signalWorker, /validatedItemIds/, "one valid quote must not suppress distinct deterministic evidence from the same source item");
assert.match(signalWorker, /duplicateIndex.*existing\.includes\(quoteNorm\).*quoteNorm\.includes\(existing\)/, "overlapping evidence quotes should collapse to the longest supported quote");
assert.match(backstopWorker, /isGoodEvidenceQuote/);
assert.match(backstopWorker, /deterministicCandidate/);
assert.match(backstopWorker, /normalize\("NFD"\).*replace\(\/\[\\u0300-\\u036f\]\/g/);
assert.match(backstopWorker, /norm\(String\(candidate\.title\)\)/, "both workers must normalize signal identity consistently");
const primaryQuality = readFileSync(resolve(root, "supabase/functions/pulse-external-signal-worker/quality.mjs"), "utf8");
const backstopQuality = readFileSync(resolve(root, "supabase/functions/pulse-external-deterministic-backstop/quality.mjs"), "utf8");
assert.equal(backstopQuality, primaryQuality, "signal worker and deterministic backstop must share identical evidence quality rules");
const sourceWorker = readFileSync(resolve(root, "supabase/functions/pulse-external-source-worker/index.ts"), "utf8");
assert.match(sourceWorker, /const decodeEntities=/, "HTML capture must decode numeric and named entities");
assert.match(sourceWorker, /const htmlPublishedAt=/, "HTML capture must preserve publication dates when available");
assert.match(sourceWorker, /article:published_time/, "HTML capture must parse standard publication metadata");
assert.match(sourceWorker, /const htmlArticleContent=/, "HTML capture should prioritize article/main content over navigation");
assert.match(sourceWorker, /published_at=htmlPublishedAt\(body\)/, "HTML source records must carry parsed publication timestamps");
assert.match(sourceWorker, /replace\(\/&#\(\\d\+\);\/g[\s\S]*replace\(\/&#\(\\d\+\);\/g/, "HTML capture must decode numeric entities even when double-encoded");
assert.match(sourceWorker, /publicada|publicado/, "HTML capture should recover a date from localized publication text when metadata is absent");
const localizedDateIndex = sourceWorker.indexOf("const localized=bodyText.match(");
const metadataDateIndex = sourceWorker.indexOf("const meta=metaValue(html,");
assert.ok(localizedDateIndex >= 0 && metadataDateIndex > localizedDateIndex, "visible publication dates should win over conflicting metadata timestamps");
assert.match(sourceWorker, /const namedDate=bodyText\.match/ , "HTML capture should parse dates written with Portuguese month names");
assert.match(sourceWorker, /\(\?:de\\s\+\)\?\(janeiro/, "Portuguese dates with the preposition de should be parsed");
assert.match(sourceWorker, /janeiro.*fevereiro.*março.*julho/, "Portuguese month-name date parsing must cover the calendar");
assert.match(sourceWorker, /descoberta.*items=items\.filter/, "discovery feeds must filter out articles unrelated to the pilot category");
assert.match(sourceWorker, /chocolate\|cacau\|p\[aá\]scoa\|doces\|confeitaria\|achocolatado/, "discovery feeds should retain category-relevant articles only");

console.log("External signal evidence quality: PASS");
