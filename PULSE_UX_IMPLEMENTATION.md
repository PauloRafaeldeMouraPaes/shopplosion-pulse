# Pulse — implementação da proposta de redesign

## Estrutura principal
- Hoje → Intelligence
- Universo → visão ampla do Pulse
- Base → documentos privados
- Investigação → Ask AI privado
- Análises → artefatos de inteligência

## Fluxo orientado
Base → Investigação → Análise.
O fluxo aparece no workspace e no Ask AI, com próximo passo contextual no shell.

## Evidência e proveniência
- Ask AI explicita o escopo privado.
- Evidências aparecem como parte da investigação.
- Respostas podem ser salvas como análises.
- O artefato preserva pergunta, resposta, citações, evidências, documento/chunk e relevância.
- O artefato pode ser aberto por deep-link.
- O artefato possui cópia de link interno e exportação textual.

## Estados e orientação
- Loading, vazio e erro preservados.
- Erros de contexto não encerram a sessão.
- Próximo passo contextual no shell.
- Fluxo mobile mantém os cinco destinos.

## Design system / interação
- Rail desktop.
- Navegação inferior mobile.
- Active state.
- Command menu.
- Foco de teclado.
- Reduced motion.
- Cache-busting dos assets do shell.

## Segurança preservada
- Sessão Supabase persistente.
- RLS permanece autoridade de isolamento.
- Análises exigem industry_id da indústria atual e created_by do usuário autenticado.
- Nenhum service-role exposto no cliente.

## Validação técnica
- Todos os cinco HTMLs principais tiveram seus scripts inline submetidos a parse sintático sem erros.
- Supabase permanece com funções de produção ativas.
- Políticas RLS de documents, document_chunks e analyses permanecem ativas.

## Limite de validação
A renderização visual do GitHub Pages não pôde ser aberta pelo ambiente de execução desta sessão. Portanto, a validação visual pixel-a-pixel de produção não é declarada como concluída.


## V3 — workspace efetivamente renderizado (2026-09-18)

A versão V3 deixou de depender da composição visual legada para a experiência visível. Foi adicionada uma camada de renderização de workspace que:
- substitui visualmente o main legado por um workspace único;
- mantém a rail com Hoje, Universo, Base, Investigação e Análises;
- cria cabeçalho contextual e próximo passo;
- reorganiza Universo, Hoje, Base, Análises, Investigação e Fontes;
- mantém os controles legados no DOM apenas como compatibilidade funcional, sem renderização concorrente;
- conecta ações da nova interface aos fluxos existentes de upload, busca, geração de resposta e salvamento de análise;
- aplica responsividade e reduced motion.

Arquivos:
- pulse-workspace-v3.css
- pulse-workspace-v3.js

Cache-busting:
- 20260918.20

## Auditoria do estado do repositório

- `gh-pages` e `main` estão divergentes; não foram forçados a uma mesma linha de histórico porque o compare atual indicou divergência relevante (80 commits à frente e 67 atrás em relação a main no ponto auditado).
- A implementação V3 foi aplicada diretamente em `gh-pages`, que é a referência de produção auditada nesta etapa.
- A estrutura legada de `index.html` continua presente como camada de compatibilidade, mas fica fora da experiência renderizada pela V3.
- A validação visual da URL do GitHub Pages foi tentada e o ambiente não conseguiu abrir a página.

## Segurança

A alteração V3 não modifica Supabase, RLS, Edge Functions ou autenticação.
A auditoria do banco confirmou RLS habilitado nas tabelas privadas principais e políticas por `private.current_industry_id()`/usuário autenticado em documents, document_chunks e analyses.
