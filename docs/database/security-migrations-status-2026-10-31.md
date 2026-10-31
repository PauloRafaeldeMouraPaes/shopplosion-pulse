# Segurança, banco e migrations: estado verificado em 31/10/2026

Sessão sem acesso ao banco de produção. Nenhum `db push`, DDL, grant, trigger ou função de produção foi
alterado. O que segue foi verificado pelo estado atual das PRs no GitHub e por reexecução local dos
contratos em PostgreSQL 16 (o CI usa PostgreSQL 17).

## 1. Estado das PRs e issues

| Item | Estado em 31/10 | Checks no HEAD | Base |
|---|---|---|---|
| PR #86 quarentena de evidência pública não qualificada | Draft, `clean`, 13 commits à frente de `main`, 1 atrás | 5 workflows PASS | main |
| PR #88 independência de fontes na leitura de evidência | Draft, `clean`, empilhada sobre #86 | 5 workflows PASS | #86 |
| PR #89 deduplicação de eventos de sinal (trigger draft + ACL consolidada da #99, HEAD `e802720`) | Draft, `clean` | 5 workflows + Signal Event Trigger Contract PASS | main |
| PR #93 linhagem de migrations (manifesto, 68 corpos recuperados) | Draft, `clean` | 5 workflows PASS | main |
| PR #99 contrato de ACL mínimo para SECURITY DEFINER | Draft, `clean`; disposições absorvidas pela #89 (ver item 5) | 5 workflows + ACL Contract PASS | main |
| PR #103 remoção das cópias aninhadas de Edge Functions | Draft, `clean` | 5 workflows PASS | main |
| Issues #90, #91 | Abertas; comentários de 31/10 apontam para a consolidação na #89 | | |
| Issue #92 | Aberta; linhagem inalterada desde 16/10 (72 versões, 4 mapeadas, 68 recuperadas) | | |

## 2. Reexecução local (31/10)

- `scripts/test-signal-event-trigger.sql` (PR #89): aplicado em PostgreSQL 16 local com `ON_ERROR_STOP`;
  o bloco `DO` com as oito asserções (API roles negados no trigger e no scheduler, cron e worker preservados,
  contexto autenticado mantido, diagnósticos não executáveis pela API) concluiu sem exceção e a transação
  terminou em `ROLLBACK`. Exit 0.
- `scripts/test-security-definer-acl-contract.py` (PR #99): `PASS: ACL draft denies client execution,
  preserves the authenticated context/internal contracts, and trigger invocation.` em banco limpo.
- Observação de isolamento: os dois contratos criam os papéis `anon`, `authenticated` e `service_role` no
  cluster. Executados em sequência no mesmo cluster, o segundo falha com `role "anon" already exists`. No CI
  cada contrato roda em um container próprio; localmente é preciso derrubar os papéis entre as execuções.
  Isso é limitação do harness, não do draft.
- PRs #86 e #88: `test-pulse-ask-ai.js`, `test-pulse-data-integrity.js`, `validate-study-evidence.js`,
  `validate-external-signal-quality.mjs` e `validate_pulse_regression.js` passam em ambas as branches.

## 3. Objetivos da revisão

1. **Contratos de evidência pública**: íntegros. O espelho `supabase/functions/pulse-ask-ai/public-evidence.ts`
   é igual ao canônico `pulse-public-evidence.js` e ao JSON embutido em `index.html` (paridade de três camadas
   verificada por `test-pulse-ask-ai.js`). A quarentena da PR #86 passa nos mesmos testes.
2. **Classificação de fontes**: a PR #88 fixa em teste que `Numerator` é classificado antes de
   `Kantar/Worldpanel` e que `Worldpanel` sem operador confirmado fica como `Worldpanel (operador não
   confirmado)`, em vez de inferir propriedade. Não há confusão de operadores na regra atual.
3. **Deduplicação de eventos**: o trigger draft da PR #89 compara `OLD`/`NEW`; só emite evento em INSERT,
   transição para `resolved`, variação de confiança ≥ 0,05 ou mudança de fingerprint; `observed_at` sozinho não
   gera evento; sinal já resolvido não gera novo evento. A matriz de aceitação está em
   `migration-lineage-reconciliation.md`. O contrato cobre a matriz em banco sintético.
4. **Migrations históricas vs arquivos arquivados**: 72 versões em produção; 4 mapeadas por hash a arquivos
   ativos; 68 corpos recuperados byte a byte como `.sql.txt` em `recovered-production-migrations/`. Os 68
   arquivos são **arquivo de auditoria**, não migrations verificadas: a proveniência Git original continua
   indemonstrada, e `supabase db push` continua inseguro até a reconciliação formal.
5. **ACL mínimo para SECURITY DEFINER**: os drafts de #99 e #89 são coerentes com o grafo de chamadas do
   repositório: o front não chama `rpc()`; o broker chama `auth_industry_context()` com o JWT do usuário
   (papel `authenticated`), que permanece concedido; os workers chamam `pulse_capture_document_version` e
   `pulse_external_intelligence_fallback_candidate` com chave de serviço, cujo `GRANT ... TO service_role`
   é mantido; `pulse_external_backstop_schedule_tick()` fica só com o owner/cron. **Risco identificado e
   tratado no mesmo dia**: #99 e #89 revogavam os mesmos objetos com diferenças (por exemplo, #99 também
   revogava `capture_intelligence_signal_event()` de `service_role`; #89 não). O draft da #89 (`e802720`)
   passou a conter as disposições da #99 como uma única migração forward: funções de trigger, scheduler e
   self-test sem EXECUTE para nenhum papel de API (inclusive `service_role`); seis rotinas internas de worker
   com REVOKE dos papéis de API e `GRANT ... TO service_role` explícito; `auth_industry_context()` mantém
   `authenticated`. `scripts/test-signal-event-trigger.sql` foi ajustado para exigir essas negações e passou
   em PostgreSQL 16 local e no CI (Signal Event Trigger Contract). A #99 fica como referência do contrato de
   ACL; a aplicação, quando houver, deve partir da #89.
6. **Testes que ainda dependem de produção/staging**: caminho cron → Vault → Edge Function com o token real;
   negação via PostgREST para `anon`/`authenticated` nos endpoints reais; Security Advisor após a migração;
   contagem de eventos duplicados antes e depois (2.156 eventos para 33 sinais no levantamento de 15/10 são
   diagnóstico, não prova). Nenhum teste sintético substitui esses gates.
7. **Pré-condições, riscos e rollback de qualquer migração futura**: ver `staging-signal-event-acl-acceptance.md`.
   Resumo: (a) linhagem reconciliada e revisada; (b) uma única migração forward combinando trigger + ACL;
   (c) aplicação em staging com a matriz de aceitação; (d) rollback preparado como migração inversa
   (recriar a função do trigger anterior e restaurar os grants observados no manifesto ACL de 15/10), nunca
   como edição manual; (e) janela sem execução do worker/cron durante a aplicação; (f) comparação do
   Security Advisor antes e depois.

## 4. Limpeza segura (PR #103)

`supabase/functions/pulse-ask-ai/pulse-ask-ai/index.ts` (divergente do deployado) e
`supabase/functions/pulse-rag-eval/pulse-rag-eval/index.ts` (idêntica) eram cópias aninhadas não referenciadas
pelo `DEPLOYMENT_MANIFEST.json` nem pelos workflows. A remoção está na PR Draft #103 (`fa70551`), separada
desta linhagem. O deploy de Edge Functions é manual (`workflow_dispatch` com confirmação), então o merge da
#103 não dispara deploy nem altera a função publicada.
