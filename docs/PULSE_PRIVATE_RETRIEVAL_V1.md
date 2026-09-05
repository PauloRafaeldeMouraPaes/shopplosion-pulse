# Pulse — Recuperação Privada v1

## Objetivo
Adicionar uma camada determinística de recuperação sobre `document_chunks` antes de conectar qualquer LLM.

## Comportamento
- `ask.html` exige sessão autenticada.
- A indústria é resolvida pelo perfil autenticado.
- A consulta lê apenas `document_chunks` via cliente Supabase.
- RLS continua sendo a autoridade de isolamento.
- Resultados mostram documento, bloco, tipo de fonte e trecho recuperado.
- A busca é lexical (`ILIKE`) e faz ranking simples por ocorrência dos termos.

## Não escopo
- Nenhum LLM.
- Nenhuma chave de provedor de IA no navegador.
- Nenhuma resposta generativa apresentada como fato.
- Nenhuma cópia de chunks para o Universo Pulse público.

## Critério de aceitação
1. Usuário autenticado A consulta apenas chunks permitidos por RLS.
2. Usuário autenticado B consulta apenas chunks permitidos por RLS.
3. A tentativa de consulta não recebe chunks de B.
4. A página declara explicitamente que ainda não existe geração por LLM.

## Próximo estágio
Substituir/encapsular a recuperação lexical por um endpoint server-side de geração com segredo de provedor mantido fora do navegador, preservando os mesmos filtros tenant-scoped e retornando citações dos chunks usados.
