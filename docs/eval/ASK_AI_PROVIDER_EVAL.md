# Comparação de modelos do Ask AI (Gemini atual vs Claude)

Objetivo: decidir se o Ask AI passa do Gemini para o Claude. Critério definido pelo Paulo em 01/11/2026: trocar só se o Claude for melhor **e** o custo mensal estimado couber em R$ 100, sem recarga. Se a troca acontecer, ela vem com limite de gasto no console da Anthropic e fallback automático para o Gemini quando o orçamento do mês acabar.

## Como rodar

1. Em Settings > Secrets and variables > Actions do repositório, criar `GEMINI_API_KEY` (a mesma chave configurada no Supabase) e `ANTHROPIC_API_KEY` (criada em platform.claude.com, de preferência numa workspace com limite de gasto). As chaves nunca passam por conversa nem por arquivo.
2. Em Actions > Ask AI Provider Eval > Run workflow, preencher os preços por milhão de tokens copiados das páginas oficiais de preço no dia, o volume esperado de perguntas por mês e o câmbio.
3. O run publica `report.md` no resumo e guarda como artefato `results.json`, `blind-review.md` (respostas embaralhadas como A/B) e `blind-review-key.json`.
4. Marcar a revisão cega antes de abrir a chave; depois cruzar com a pontuação automática e o custo.

## O que é medido

- Mesmo prompt de produção: sistema e template são extraídos de `supabase/functions/pulse-ask-ai/index.ts` em tempo de execução, e a recuperação reproduz a busca lexical do escopo público.
- Pontuação automática: formato (os cinco blocos), citações válidas, números sem suporte nas evidências (possível invenção), recusa correta em perguntas sem evidência.
- Tokens, latência e custo por resposta; custo mensal = custo médio por resposta × volume informado.
- 26 perguntas (`docs/eval/ask-ai-questions.json`): 18 com evidência, 4 parciais e 4 sem evidência.

## Achado da preparação, independente do modelo

A busca lexical atual não recupera a evidência certa em 5 das 18 perguntas com resposta na base (q01, q05, q07, q12, q13): termos curtos e comuns ("de", "em", "no") contam como termos e deslocam o ranking. Isso limita o Ask AI com qualquer modelo; o relatório lista essas perguntas em `missingExpected`. Corrigir a busca (remover stopwords, pesar termos raros) é uma melhoria separada e provavelmente de maior impacto que a troca de modelo.
