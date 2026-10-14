# Pulse — Auditoria técnica de conectores e lacunas do piloto Chocolate

**Data da auditoria:** 15/10/2026.  
**Escopo:** leitura do código em `main` (SHA `64f9a31d3421e560ca91c53a4585011cba779980`) e consultas somente de leitura ao Supabase Production `ppfuygnpgywfpiqxsfys`.  
**Limite:** fotografia do momento; não altera dados nem comprova contratos comerciais ou representatividade estatística.

## 1. Conclusão executiva

O Pulse já possui uma infraestrutura inicial real de captura de fontes públicas, geração de sinais e registro de eventos. Isso é uma base útil para descoberta de mudanças, mas **a auditoria não encontrou uma solução integrada de inteligência industrial que combine sell-out, pesquisa de shopper e pesquisa de mercado**.

O worker de fontes implementado aceita HTML, RSS/Atom e JSON genérico. Não há, nesta trilha auditada, conector de sell-out transacional, ingestão de painel licenciado, pipeline de microdados de pesquisa ou conectores oficiais específicos de plataformas sociais/busca. A arquitetura precisa evoluir de captura de conteúdo público para um pipeline multi-evidência e multimétodo.

## 2. O que foi confirmado no código

### Captura externa
Arquivo: `supabase/functions/pulse-external-source-worker/index.ts`.

- Consulta fontes marcadas como ativas e respeita `poll_interval_minutes`.
- Implementa captura de conteúdo HTML, RSS/Atom e JSON genérico.
- Registra tentativas em `intelligence_source_fetch_runs` e itens em `intelligence_source_items`.
- A filtragem dos feeds de descoberta por termos de chocolate/cacau/Páscoa reduz ruído, mas não equivale a cobertura representativa de notícias, consumidores ou mercado.
- Não há adaptador específico para painel de sell-out, transações de varejista, painel de domicílios, APIs de redes sociais ou Google Trends no worker auditado.

### Geração de sinais
Arquivos: `supabase/functions/pulse-external-signal-worker/index.ts` e `pulse-external-deterministic-backstop/index.ts`.

- A geração analítica parte de itens capturados; o worker principal seleciona itens recentes, chama um modelo e valida evidências.
- O fallback determinístico também deriva candidatos dos itens disponíveis.
- A evidência anexada aos sinais pode registrar a fonte/item, mas o volume de eventos ou a repetição de captura não deve ser interpretado como corroboração independente.
- O pipeline atual não demonstra inferência populacional, calibração de dados on-line, teste de hipótese com sell-out ou validação fora da amostra.

### Evidência pública usada pelo Ask AI
Arquivo: `supabase/functions/pulse-ask-ai/public-evidence.ts`.

- A coleção inclui registros de contexto macro, mas os campos de natureza, universo observado, representatividade, fonte primária, verificação e alcance ainda aparecem como `[A DEFINIR]` em registros examinados.
- Isso é uma pendência de qualidade: a evidência não deve ser apresentada como completamente qualificada até os campos serem preenchidos ou o registro ser restringido/quarentenado.
- O arquivo é gerado a partir de `pulse-public-evidence.js`; qualquer correção deve atualizar a fonte de verdade e validar a sincronização, não editar apenas o artefato gerado.

## 3. Fotografia do Supabase Production

Consultas agregadas somente de leitura encontraram:

| Entidade | Quantidade | Interpretação |
|---|---:|---|
| Indústrias/tenants | 3 | Duas com slugs de teste e um tenant do piloto público Chocolate |
| Fontes registradas | 9 | Todas associadas ao tenant Chocolate; 7 ativas e 2 inativas no momento consultado |
| Itens de fonte | 26 | Conteúdo público capturado, não dados transacionais de venda |
| Execuções de captura | 106 | 104 concluídas e 2 falhas registradas |
| Sinais | 33 | Todos no tenant Chocolate; 14 ativos e 19 dispensados no momento consultado |
| Eventos de sinal | 2.103 | Eventos de histórico; não equivalem a 2.103 fontes ou observações independentes |
| `shopper_knowledge` | 0 | Nenhum registro nessa camada no momento consultado |
| `investigations` | 0 | Nenhuma investigação persistida nessa tabela no momento consultado |
| `analyses` | 0 | Nenhuma análise persistida nessa tabela no momento consultado |
| `documents` | 7 | Documentos cadastrados; a contagem não comprova pesquisa de shopper estruturada |

A maior parte dos 26 itens é proveniente de dois feeds RSS de descoberta. Os itens desses feeds aparecem como rejeitados na fotografia consultada, o que é preferível a incorporá-los automaticamente como sinais relevantes. Há poucos documentos HTML diretos ativos, incluindo Abicab, Agência Brasil, Kantar/Worldpanel, IPEAD/UFMG e Procon Joinville. Isso fornece contexto público setorial, mas não substitui acesso a bases transacionais ou painéis completos.

Uma fonte do IBGE para cacau está inativa após erros HTTP 403. O sistema não deve contornar o bloqueio; deve buscar uma API/arquivo oficial permitido, um canal de acesso autorizado ou manter a fonte suspensa.

**Nota sobre execução:** o status `completed` indica que a rotina terminou, não que a fonte forneceu novos dados. As execuções mais recentes dos feeds RSS registraram zero itens novos; os itens guardados desses feeds foram capturados anteriormente. `last_success_at` por si só não prova frescor ou cobertura suficiente.

## 4. Lacunas críticas para uma análise que atenda à indústria

### P0 — Qualificar evidências e sinais existentes
- Resolver ou quarentenar os campos `[A DEFINIR]` na evidência pública gerada.
- Auditar cada um dos 14 sinais ativos: fato literal, URL, data, fonte primária, período, universo, classificação (observação/hipótese/estimativa), atualidade e utilidade industrial.
- Identificar duplicatas, fontes que republicam o mesmo dado e afirmações sazonais apresentadas como mudança emergente.
- Distinguir eventos repetidos do worker de observações independentes.
- Preservar trilha de revisão e razão para manter, corrigir ou dispensar cada sinal.

### P1 — Ingestão de sell-out e varejo
- Definir um contrato versionado para dados licenciados: período, SKU/EAN, marca/categoria, unidades, valor, preço unitário, promoção, canal, geografia, cobertura/distribuição e disponibilidade, conforme direitos e campos fornecidos.
- Distinguir sell-out, sell-in, preço anunciado, preço de tabela e preço transacionado.
- Implementar importação validada para CSV/API autorizada com controles de tenant, idempotência, auditoria, tratamento de revisões e testes de qualidade.
- Não criar números de vendas a partir de notícias ou de páginas de preço.

### P1 — Pesquisa de shopper e mercado
- Criar um contrato de ingestão de estudos com população-alvo, método/amostragem, datas de campo, tamanho de base, ponderação, questionário/variáveis, limitações e licença.
- Estruturar resultados quantitativos separadamente de achados qualitativos e de declarações de intenção.
- Vincular cada claim a página/tabela/questão e ao denominador adequado; não extrapolar estudos de Páscoa para comportamento anual.
- Disponibilizar uma camada para segmentação, ocasiões, missão, frequência, escolha, barreiras e sensibilidade declarada, apenas quando o estudo realmente medir esses atributos.

### P1 — Dados on-line autorizados
- Avaliar adaptadores separados para APIs oficiais/licenciadas de busca, redes sociais, reviews, comunidades, notícias e varejo eletrônico.
- Registrar termos/licença, universo coberto, limitações de coleta, taxa de amostragem, paginação, retenção, timestamps e políticas de privacidade.
- Medir deduplicação, reposts, spam e mudanças na cobertura; sinal social continua exploratório até validação adequada.
- Não tratar contagem de posts como número de pessoas nem como estimativa de prevalência.

### P2 — Modelo de integração e validação
- Criar camada comum de categoria, marca, SKU/EAN, atributo, ocasião, canal, região e período, sem perder a granularidade original.
- Exigir ligações de evidência explícitas, independência das fontes, defasagens temporais, explicações alternativas e evidência contraditória.
- Implementar scorecards de qualidade e validação temporal fora da amostra; nenhum score opaco de “confiança” deve substituir métricas primárias.
- Gerar uma análise industrial que termine em decisão, hipótese testável, KPI, responsável e regra de decisão.

## 5. Ordem de implementação recomendada

1. **Auditoria de sinais ativos e evidência pública:** corrigir a proveniência incompleta e verificar todos os sinais que hoje aparecem como ativos.
2. **Contratos de dados:** especificar esquemas de sell-out, pesquisa de shopper, pesquisa de mercado e fontes on-line antes de codificar conectores específicos.
3. **Importação licenciada de sell-out e estudos:** começar com arquivo/API autorizado e um contrato versionado, para validar o modelo sem inventar acesso a fornecedor.
4. **Adaptadores on-line oficiais/licenciados:** adicionar fonte por fonte com teste de captura, cobertura, licenciamento e observabilidade.
5. **Triangulação e validação:** vincular os pilares e executar um primeiro estudo Chocolate com divergências, limitações e revisão especializada.
6. **Produto/automação:** só depois automatizar alertas e recomendações baseados em qualidade e histórico demonstrados.

## 6. Critério de pronto para o piloto industrial

O piloto só pode ser apresentado como análise integrada quando houver:
- pelo menos uma fonte de sell-out real ou claramente identificado como não disponível;
- pelo menos um estudo de shopper/consumidor com metodologia e universo documentados ou uma lacuna explicitamente declarada;
- pelo menos uma fonte de mercado/categoria com metodologia identificada;
- dados on-line autorizados, com cobertura e limitações descritas;
- rastreabilidade entre cada conclusão e suas evidências;
- validação de qualidade, revisão humana e hipótese comercial testável;
- nenhuma afirmação de representatividade ou desempenho sem suporte.

**Conclusão:** a captura pública e a infraestrutura de sinais são um começo, não o produto industrial completo. O próximo trabalho deve corrigir a qualidade dos sinais atuais e construir contratos de dados e ingestão para sell-out e estudos de shopper/mercado, preservando os controles de licença, privacidade, isolamento por cliente e honestidade estatística.
