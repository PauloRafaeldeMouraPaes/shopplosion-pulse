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
  o bloco `DO` com 21 asserções (`RAISE EXCEPTION`) (API roles negados no trigger e no scheduler, cron e worker preservados,
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
   (c) aplicação em staging com a matriz de aceitação; (d) rollback a preparar como migração inversa
   (recriar a função do trigger anterior e restaurar os grants observados no manifesto ACL de 15/10), nunca
   como edição manual; o corpo atual de `capture_intelligence_signal_event()` e o DDL do trigger não constam em
   nenhum dos 72 corpos do ledger nem em `supabase/migrations`, logo precisam ser capturados em staging com
   `pg_get_functiondef`/`pg_get_triggerdef` antes de qualquer aplicação; (e) janela sem execução do worker/cron durante a aplicação; (f) comparação do
   Security Advisor antes e depois.

## 4. Incidente de segredo em arquivo de auditoria (31/10, noite)

Revisão adversarial independente encontrou o valor em texto puro do segredo do Vault `pulse_index_worker_token` no corpo recuperado `20260907230216_harden_internal_worker_auth_vault.sql.txt` (commit de 15/10 neste branch; repositório público; nunca esteve em `main`). O `pulse-index-worker` autentica apenas por esse token (`verify_jwt=false`). Medidas no repositório: literal redigido, histórico do branch reescrito para removê-lo de todos os commits, manifesto com status `recovered_from_production_history_redacted` e validador que rejeita qualquer corpo com literal de segredo. Medida fora do repositório, obrigatória e pendente do operador: rotacionar o segredo no Vault e o hash em `private.pulse_internal_tokens`, tratando o token anterior como comprometido desde 15/10 (commits antigos podem permanecer acessíveis por SHA até a limpeza do GitHub).

## 5. Inconsistências e lacunas apontadas pela revisão independente de 31/10

- Objetos vivos fora do ledger: a função do trigger `capture_intelligence_signal_event()` e o trigger
  `intelligence_signal_event_capture`, o job cron das 06:45 (`pulse_intelligence_quality_check`, ausente das sete
  chamadas `cron.schedule` recuperadas) e, a confirmar, a coluna `latest_direction` que `intelligence.html` seleciona de
  `intelligence_signals` (no ledger ela só existe na view). "72/72 corpos recuperáveis" não significa que o esquema de
  produção seja inteiramente derivável do ledger.
- `capture_document_version()`: `migration-lineage-reconciliation.md` registra disposição `review_required`, o manifesto
  CSV e `test-security-definer-acl-manifest.py` impõem `internal_only`. O CSV validado em CI é a referência; o texto
  precisa ser alinhado.
- `pulse_intelligence_quality_check()`: o mesmo documento diz que não é SECURITY DEFINER; o CSV a lista como
  `security_definer=true`. Divergência só resolvível contra o catálogo de produção (`pg_proc.prosecdef`); até lá,
  considerar a disposição do CSV como hipótese, não como fato.
- O audit de 15/10 descreve o contrato da #89 como preservação de EXECUTE para `service_role`; o draft consolidado
  (`e802720`) preserva `service_role` só nas seis rotinas de worker e revoga nas funções de trigger, no scheduler e no
  self-test. Vale o draft e o contrato atuais.
- Nomes de colunas: o texto de reconciliação prescreve `mapping_type`/`review_status`; o CSV usa `mapping_status`
  (sem `review_status`). O CSV é a referência.
- Afirmações não verificáveis sem produção (2.156 eventos para 33 sinais, contagens do Security Advisor, estado do
  CI na data): registradas como leitura da época, não como prova reproduzível a partir do repositório.

## 6. Limpeza segura (PR #103)

`supabase/functions/pulse-ask-ai/pulse-ask-ai/index.ts` (divergente do deployado) e
`supabase/functions/pulse-rag-eval/pulse-rag-eval/index.ts` (idêntica) eram cópias aninhadas não referenciadas
pelo `DEPLOYMENT_MANIFEST.json` nem pelos workflows. A remoção está na PR Draft #103 (`fa70551`), separada
desta linhagem. O deploy de Edge Functions é manual (`workflow_dispatch` com confirmação), então o merge da
#103 não dispara deploy nem altera a função publicada.
