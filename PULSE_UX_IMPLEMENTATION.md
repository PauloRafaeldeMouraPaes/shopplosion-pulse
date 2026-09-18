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
