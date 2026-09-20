#!/usr/bin/env node
// Fase 4 (Análises como artefato): reimplementa em Node, de forma pura, a
// mesma regra que a constraint `analyses_published_requires_limits` impõe
// no banco (supabase/migrations/006_analysis_artifact_state.sql) e que o
// botão "Publicar análise" em app.html também aplica no cliente antes de
// chamar a API. Não depende de rede/Supabase — é o mesmo padrão usado por
// validate-conducao-contract.js e validate-study-evidence.js: testar a
// regra de negócio como lógica pura, já que o guardrail real (a constraint
// SQL) não pode ser exercitado sem credenciais de banco neste ambiente.
//
// Regra 5 da proposta: "Analysis é o único artefato publicável, com
// limites declarados obrigatórios." Uma análise nunca deve poder ficar
// com status='published' e limites vazios/ausentes — nem pela UI, nem por
// qualquer outro caminho que grave na tabela.

function canPersist(status, limits) {
  if (status !== 'draft' && status !== 'published') return false;
  if (status !== 'published') return true;
  return typeof limits === 'string' && limits.trim().length > 0;
}

const cases = [
  { status: 'draft', limits: null, expected: true, label: 'rascunho sem limites é sempre permitido' },
  { status: 'draft', limits: '', expected: true, label: 'rascunho com limites vazios é permitido' },
  { status: 'draft', limits: '   ', expected: true, label: 'rascunho com limites só de espaço é permitido' },
  { status: 'published', limits: null, expected: false, label: 'publicada sem limites (null) é rejeitada' },
  { status: 'published', limits: undefined, expected: false, label: 'publicada sem limites (undefined) é rejeitada' },
  { status: 'published', limits: '', expected: false, label: 'publicada com limites vazios é rejeitada' },
  { status: 'published', limits: '   \n  ', expected: false, label: 'publicada com limites só de espaço/quebra de linha é rejeitada' },
  { status: 'published', limits: 'Baseado em 3 documentos de um trimestre; não cobre e-commerce.', expected: true, label: 'publicada com limites declarados de verdade é permitida' },
  { status: 'archived', limits: 'qualquer coisa', expected: false, label: 'status fora do domínio (draft/published) é rejeitado' },
];

let failed = 0;
for (const c of cases) {
  const got = canPersist(c.status, c.limits);
  const ok = got === c.expected;
  if (!ok) failed++;
  console.log((ok ? 'PASS' : 'FAIL') + ' — ' + c.label + ' (esperado ' + c.expected + ', obtido ' + got + ')');
}

if (failed) {
  console.error('\nAnalysis publish contract: FAIL (' + failed + ' de ' + cases.length + ' casos)');
  process.exit(1);
}
console.log('\nAnalysis publish contract: PASS');
