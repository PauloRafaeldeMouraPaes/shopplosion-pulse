# Signal events: release notes for the trigger + ACL draft (atualizado em 31/10/2026)

Draft: `docs/database/signal-event-trigger-draft.sql`. Contrato: `scripts/test-signal-event-trigger.sql`
(workflow Signal Event Trigger Contract, PostgreSQL 17; reexecutado em PostgreSQL 16 local). Nada aqui foi
aplicado a produção.

## Escopo de uma única release revisada

1. Migração forward: trigger `intelligence_signal_event_capture` reescrito (dedupe) + disposições de ACL para
   as rotinas SECURITY DEFINER. O bloco `DO $precondition$` falha de imediato, listando as rotinas ausentes, em
   vez de abortar no meio dos REVOKEs; num banco criado só com `supabase/migrations/001-010` ele falha por
   construção, porque essas rotinas vivem fora do ledger.
2. Redeploy dos três Edge Functions que escreviam eventos diretamente: `pulse-external-signal-worker`,
   `pulse-external-deterministic-backstop` e `pulse-intelligence-worker`. Os três passaram a confiar no trigger
   como único escritor; `scripts/validate-external-signal-quality.mjs` varre todas as funções e rejeita qualquer
   `insert`/`upsert` direto em `intelligence_signal_events`. `pulse-intelligence-worker` também passou a
   preservar `status = 'resolved'` e `'dismissed'` no upsert (antes reativava esses sinais).
3. `DEPLOYMENT_MANIFEST.json` deve ser atualizado com o commit de registro do deploy, como a convenção do
   repositório; até lá os hashes do manifesto descrevem bundles anteriores a esta mudança.

## Semântica decidida

- Evento em: INSERT; transição para `resolved`; mudança de fingerprint; variação de confiança >= 0,05 medida na
  precisão armazenada `numeric(5,4)`. Mudança de status que não seja resolução não gera evento por si só.
  `resolved` é terminal: um sinal resolvido não emite mais eventos, mesmo com fingerprint ou confiança novos,
  e a linha continua sendo atualizada (summary, evidence, confidence, observed_at). Reaparecimento com a
  mesma `signal_key` é absorvido; se isso não for desejado, a regra precisa de revisão de produto.
- NULL em `confidence` conta como 0 nos dois lados: 0,5 -> NULL emite `down` com confiança 0; NULL -> 0,03
  não emite. Coberto pelo contrato.
- A comparação é contra a confiança armazenada, não contra a do último evento: deriva lenta em passos
  < 0,05 nunca emite. Limitação documentada, não corrigida.
- `observed_at` do evento: no INSERT, o `observed_at` do sinal (se esse valor vier no futuro, os eventos
  seguintes podem ficar com carimbo anterior a ele; os workers gravam `now()`, então o caso só ocorre com
  escrita manual); no UPDATE, nunca anterior ao evento anterior
  nem ao `observed_at` do sinal (`GREATEST(..., clock_timestamp())`), para que `intelligence_signal_timeline`
  e `intelligence_change_digest` ordenem de forma determinística mesmo quando o worker ou o resolvedor de
  sinais antigos não tocam em `observed_at`. Coberto pelo contrato.
- `events_created` nas respostas dos workers é uma previsão feita com a mesma regra do trigger
  (`shouldRecordSignalEvent` nos workers externos; predicado espelhado no worker privado), não uma contagem
  lida de volta.

## O que o contrato prova e o que ainda depende de staging

Provado em banco sintético: a matriz de eventos; REVOKE/GRANT resultantes; o trigger dispara para DML
executado como `service_role` e `authenticated` depois do REVOKE (bloco `SET ROLE`), e `service_role` não
consegue chamar a função do trigger diretamente (`insufficient_privilege`); `status` restrito ao CHECK de
produção (`active`, `dismissed`, `resolved`).

Ainda a provar em staging, no esquema real: trigger disparando via PostgREST como `service_role` sob RLS;
caminho cron -> Vault -> Edge Function com o token real (rotacionado; ver incidente registrado na PR #93);
contagem de eventos duplicados antes e depois; delta do Security Advisor; e o rollback, que exige capturar
antes `pg_get_functiondef('public.capture_intelligence_signal_event'::regproc)` e
`pg_get_triggerdef` do trigger atual, porque nenhum dos dois consta no repositório nem no ledger de
migrations.
