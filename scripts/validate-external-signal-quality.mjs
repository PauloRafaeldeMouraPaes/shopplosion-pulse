import assert from "node:assert/strict";
import { deterministicCandidate, isGoodEvidenceQuote, isGenericSummary } from "../supabase/functions/pulse-external-signal-worker/quality.mjs";

const abicab = {
  id: "abicab-item",
  content: "Cabeçalho. A produção de chocolates avançou de 806 mil toneladas em 2024 para 814 mil toneladas em 2025. A diversidade de produtos também se ampliou. Neste ano, estão sendo lançados 134 lançamentos (contra 94 em 2025).",
};
const production = deterministicCandidate(abicab);
assert.ok(production, "quantified production change should be detected");
assert.match(production.title, /806 mil toneladas em 2024 para 814 mil toneladas em 2025/);
assert.equal(production.evidence[0].quote, "A produção de chocolates avançou de 806 mil toneladas em 2024 para 814 mil toneladas em 2025.");
assert.match(production.summary, /não comprova mudança de compra/);
assert.ok(isGoodEvidenceQuote(production.evidence[0].quote, abicab.content));

const agency = {
  id: "agency-item",
  content: "Em 2024, foram produzidas 805 mil toneladas de chocolates no país. O número subiu para 814 mil toneladas no ano passado.",
};
const agencySignal = deterministicCandidate(agency);
assert.ok(agencySignal, "change with a pronoun should retain its prior context");
assert.match(agencySignal.evidence[0].quote, /805 mil toneladas de chocolates no país\\. O número subiu para 814 mil toneladas/);


const launches = deterministicCandidate({ id: "launches", content: "Neste ano, estão sendo lançados 134 lançamentos (contra 94 em 2025)." });
assert.ok(launches, "launch count change should be detected");
assert.match(launches.title, /134 lançamentos/);

assert.equal(deterministicCandidate({ id: "nav", content: "Menu. Últimas notícias. Feed RSS. Início." }), null);
assert.equal(isGoodEvidenceQuote("Pular para o conteúdo principal Menu Últimas Notícias 2026", "Pular para o conteúdo principal Menu Últimas Notícias 2026"), false);
assert.equal(isGenericSummary("A captured external source reports a quantified change that may be relevant to the industry."), true);
assert.equal(isGenericSummary(production.summary), false);
console.log("External signal evidence quality: PASS");
