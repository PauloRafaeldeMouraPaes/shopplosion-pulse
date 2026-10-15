# Contrato de testes — histórico imutável de fontes

**Status:** H01–H15 não executados integralmente como suíte formal; o aceite completo continua pendente.

**Execução parcial mais recente:** [Pulse Regression #2328](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837538) e [Pulse Browser Smoke #1560](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837462) passaram no commit `6016791934b6f1c1a8b61ee6a39dd698fcb72471`; os outros três workflows também passaram nesse commit. O CI verificou a migration gerada pela Supabase CLI contra PostgreSQL 17 efêmero, executou `deno check`, testes unitários de retry HTTP, registro de falha e fingerprint canônico e casos SQL de falha injetada e persistência do vetor SHA-256 conhecido. Nenhum banco Supabase foi usado.

**Última execução confirmada no branch sincronizado (2026-10-15):** o commit `ed2efb84942d10b2a8082ea3a829786de5a51420` passou nos cinco workflows Pulse: [Regression](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083492/job/116233026720), [Browser Smoke](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083441/job/116233026580), [Evidence Contract](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083494/job/116233026767), [Private AI Audit](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083442/job/116233026612) e [Multi-Tenant Audit](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083472/job/116233026751). Validate também passou, assim como a segunda execução de Regression. Regression verificou a migration gerada pela Supabase CLI em PostgreSQL 17 efêmero e passou a nova regra R01 para não reativar itens `rejected` durante recaptura. Netlify redirect processing passou; header/pages checks foram neutros porque esse branch não altera esses arquivos. A cobertura é sintética e não demonstra execução em Supabase de produção nem aceite integral H01–H15.

**Regra complementar R01 (fora de H01–H15):** Recoletar um item que já recebeu `status='rejected'` pode registrar uma observação nova, mas não pode cancelar a decisão de moderação. O estado só pode ser revertido por uma ação de revisão explícita, nunca como efeito colateral do worker.

**Cobertura demonstrada em ambiente sintético:** primeira captura, repetição idêntica, alteração e reversão; IDs externos iguais em fontes diferentes; rejeição de referências cross-tenant por FKs compostas; RLS habilitado e ausência de privilégios diretos de cliente; triggers append-only; retry idempotente e proteção contra retry antigo que regrediria a projeção; publicação versus observação; metadados de parser sem duplicar versão; fingerprint malformado ou reutilizado para payload diferente; erro injetado na gravação da observação após a inserção da versão/projeção, confirmando rollback integral da chamada RPC; retry HTTP transitório e bloqueio de novas tentativas após 403; testes de registro do estado de falha e emissão de eventos quando a própria atualização de estado falha; migration e rollback; regra R01 de preservação do estado `rejected` durante recaptura, validada no PostgreSQL efêmero.

**Estado por requisito (sem inflar cobertura):** H07 está validado para a arquitetura atual de histórico exclusivamente interno: as tabelas não concedem SELECT direto a `anon` nem `authenticated`, e os testes PostgreSQL sintéticos confirmam a negação. H09 e H15 agora têm cobertura de integração real em uma stack Supabase local e efêmera, acessada pelo gateway PostgREST: a execução bem-sucedida persiste uma projeção, uma versão e uma observação; a falha SQL injetada dentro da RPC reverte as três gravações atomicamente, enquanto source e fetch_run persistem o estado de falha; HTTP 403 não gera item, versão ou observação; e triggers de teste que suprimem writes de falha comprovam que zero linhas retornadas são reportadas como `reconciliation_incomplete`, sem impedir a tentativa independente do outro write. O workflow `Source History PostgREST Integration` e os cinco workflows Pulse passaram no HEAD `a2bc5e6167c15c32b5ea1078a477220e986b809d`. Tudo isso foi executado na stack local efêmera, sem conexão com Supabase de produção.

H12 tem teste unitário, vetor SHA-256 conhecido e recomputação independente em SQL do fingerprint dos campos efetivamente persistidos. R01 preserva `rejected` durante recaptura. H13 continua aberto e fail-closed: o inventário atual tem páginas HTML de artigos e feeds RSS/Atom móveis, mas nenhum adaptador/fonte que prove catálogo finito e paginação exaurida. O worker registra `scope_fingerprint`, versão do parser e metadados de completude, porém mantém todos os snapshots como `incomplete` e `absence_inference_eligible=false`; não infere desaparecimento nem apaga histórico. As proteções atuais detectam truncamento conhecido, limites, indicadores explícitos de próxima página, JSON incompatível e documentos de feed malformados, mas isso não é prova positiva de completude.

O aceite formal integral H01–H15 ainda não foi assinado: os cenários individuais existentes cobrem grande parte do contrato, mas H13 não tem implementação positiva e a matriz integral continua exigindo revisão de cobertura e aceite. A PR permanece Draft; não aplicar a migration candidata em produção nem habilitar inferência de ausência até que uma fonte de escopo finito seja suportada e provada.

**Ambiente:** PostgreSQL isolado com dados sintéticos e testes unitários sem chamadas à fonte real. Nenhum banco Supabase foi conectado pelo CI. Nunca executar fixtures destrutivas na produção.

## Pré-condições

- Usar a migration com nome gerado pela Supabase CLI. O CI a valida em PostgreSQL 17 efêmero e com rollback; a suíte completa deve continuar em ambiente de banco isolado, nunca numa branch paga ou em produção.
- Confirmar FKs e restrições que vinculam indústria, fonte, execução, item e versão.
- Ativar RLS e revisar permissões efetivas de `anon`, `authenticated` e da role do worker.
- Usar duas indústrias de teste, duas fontes e conteúdo sintético.
- Nenhum teste depende de coleta real na internet.

## Matriz de aceitação

| Caso | Ação | Resultado esperado |
|---|---|---|
| H01 — primeira captura | Coletar um item com identidade e fingerprint inéditos | 1 versão + 1 observação; projeção atual criada |
| H02 — captura idêntica | Coletar o mesmo conteúdo em nova execução | 1 versão total + 2 observações; segunda observação aponta para a mesma versão |
| H03 — conteúdo alterado | Coletar conteúdo diferente para a mesma fonte/identidade | 2 versões + 2 observações; versão antiga permanece intacta |
| H04 — conteúdo revertido | Após H03, voltar ao fingerprint original | Reutilizar a versão original, criar observação nova; nenhuma versão histórica é apagada |
| H05 — colisão de identidade | Duas fontes usam o mesmo `external_id` | Versões independentes, porque a identidade inclui `source_id` |
| H06 — isolamento de tenant | Tentar associar observação da indústria A a fonte ou execução da indústria B | Operação rejeitada por integridade relacional; nunca aceitar associação cruzada |
| H07 — leitura do histórico | `anon` e `authenticated` tentam ler diretamente as tabelas de versões e observações | Acesso negado integralmente; histórico permanece worker-only. Se futuramente houver SELECT para clientes, adicionar teste de isolamento positivo entre duas indústrias |
| H08 — escrita do cliente | `anon` e `authenticated` tentam inserir, alterar ou apagar histórico | Negado; o worker autorizado continua funcional |
| H09 — falha de persistência | Simular falha ao gravar versão/observação | Execução não fica marcada como sucesso completo; erro é observável e reconciliável |
| H10 — reexecução idempotente | Reprocessar o mesmo lote/execução após retry | Restrições únicas impedem duplicatas; resultado pode ser reconciliado |
| H11 — ordem temporal | Publicação antiga coletada hoje | `published_at` preserva data da fonte; `observed_at` registra coleta atual |
| H12 — integridade de conteúdo | Recalcular fingerprint de versão salva | Hash corresponde à representação canônica documentada |
| H13 — snapshot ausente | Fonte não retorna um item previamente conhecido | Não apagar histórico; só considerar ausência após duas execuções completas consecutivas com o mesmo `scope_fingerprint`, parser válido, paginação esgotada e sem limite/filtro truncando o conjunto; RSS/Atom nunca prova ausência de catálogo |
| H14 — mudança de parser | Mesmo documento gera extração diferente após mudança de parser | Registrar versão do parser e não classificar automaticamente como mudança de comportamento |
| R01 — estado rejeitado | Recoletar um item que recebeu `status='rejected'` sem revisão explícita | Preservar `rejected`; nova observação pode ser registrada, mas a coleta nunca reativa o item |
| H15 — conteúdo proibido/inacessível | Fonte responde 403 ou erro de acesso | Não contornar o bloqueio; registrar falha da coleta sem forjar uma observação válida |

## Consultas de verificação pós-teste

A suíte deve demonstrar, usando os IDs sintéticos:

1. Contagem de versões por `source_id + external_id`.
2. Contagem e sequência de observações por `fetch_run_id`.
3. Ausência de FKs quebradas ou associações de tenant inconsistentes.
4. Imutabilidade das versões após uma alteração posterior.
5. Ausência de acesso cruzado entre tenants.
6. Concordância entre contagens persistidas e o resumo final do worker.

## Portão de liberação

A mudança não deve ser considerada pronta até que H01–H15 passem em ambiente isolado, a revisão de segurança não encontre falhas críticas e o CI do PR mostre resultados concluídos. Testes de documentação ou revisão estática não substituem execução do contrato.


Recent regression guard: RSS responses must contain a channel and closing RSS/channel tags; Atom responses must close the feed root. This prevents some malformed responses from being interpreted as empty successful captures. It is a structural sanity check only, not a complete XML parser or a positive completeness guarantee.


## H13 incremental implementation — scope metadata and conservative absence policy

The worker now computes a SHA-256 scope_fingerprint from the source ID, source type, URL scope, and parser version. The raw URL is not emitted by the helper. The observation metadata records this fingerprint, parser_version, completeness_status: incomplete, and absence_inference_eligible: false; a structured operational-completion log also states that collection succeeded operationally without proving source completeness.

A new pure helper and regression suite cover stable scope fingerprints, scope/parser changes, failures in response/parser/persistence validation, and the rule that absence evaluation requires two complete, eligible runs with the same scope. The helper now also requires explicit run IDs and a predecessor pointer from the current run to the immediately previous successful run; two complete snapshots separated by a failed or skipped run cannot authorize absence inference. The worker persists `previous_fetch_run_id` with a same-source/same-industry foreign key. A partial unique index also prevents two runs from branching from the same predecessor, so concurrent fetch attempts cannot silently create ambiguous adjacency. This policy is deliberately conservative: **the current adapters do not set finite-scope proof or pagination exhaustion to true**, so no current RSS/Atom, generic JSON, or single-page HTML adapter can authorize absence inference. An empty response is not evidence of absence.

The candidate schema and migration now add durable per-run fields for scope fingerprint, parser version, completeness status/reason, absence eligibility, pagination and finite-scope proof flags, response status/content type, reported total count, and returned item count. The isolated PostgreSQL contract test checks that these columns exist and that new runs default to incomplete and ineligible for absence inference. This remains candidate schema only: the migration is not applied to any Supabase project, and CI must pass before treating the change as validated. Do not change the operational completed status semantics until callers and constraints are reconciled; it currently means the worker finished its operational path, not that source absence is proven.

**H13 source-inventory check (read-only, 2026-10-15):** the production source table currently has 7 HTML sources (5 active) and 2 RSS sources (both active), with no JSON sources. HTML adapters fetch a single page, so they cannot establish catalogue scope. RSS/Atom adapters cap parsing at 50 entries and a feed's rolling window is not proof that an item disappeared from the underlying source. Therefore the current production inventory contains no adapter that can safely prove exhaustive scope plus pagination exhaustion; H13 remains intentionally fail-closed. To complete it, add source-specific adapters only for sources with a documented finite catalogue and reliable total/page/next semantics, then require two consecutive complete runs under the same scope fingerprint before absence can be inferred. No source rows or production data were modified.

## Failure reconciliation PostgreSQL tests — validated 2026-10-15

The ephemeral PostgreSQL-backed worker suite now covers four cases against isolated schemas:

- HTTP 403: no observations accepted; source and fetch run are marked failed, with absence inference disabled.
- Observation persistence RPC error: the worker records the failure and preserves the persistence error in the fetch-run row.
- Zero-row source failure update: a test trigger suppresses the source update; the worker reports `reconciliation_incomplete` while still attempting and persisting the fetch-run failure.
- Zero-row fetch-run failure update: a test trigger suppresses the run update; the worker reports `reconciliation_incomplete`, and the failed bookkeeping event is surfaced through the injected logger.

Pulse Regression passed on HEAD `da8159e48a01ee4f9a80393944e51ff6e2342eba`, including Deno type-check, handler tests and all four PostgreSQL-backed scenarios. This materially strengthens H09/H15 but does not establish the live PostgREST/Supabase RPC contract: the observation RPC failure remains injected at the adapter boundary, and its SQL atomicity is covered separately. H09/H15 remain open for an isolated test of the actual RPC plus rollback and failure-status write errors through the production client adapter.

## Follow-up verification note (2026-10-15)

The PostgreSQL 17 worker suite now includes two additional real-database cases: a `BEFORE UPDATE` trigger suppresses the source failure write, and another suppresses the fetch-run failure write. Both assert that the old database state remains unchanged, the other independent failure write is still attempted, and the worker returns `reconciliation_incomplete` with a structured persistence-failure report. This closes the previously noted gap for zero-row failure writes in the isolated PostgreSQL adapter test. It does **not** replace the remaining H09/H15 gate: the observation RPC error is still injected at the worker adapter boundary rather than through a running local Supabase/PostgREST stack, so the actual HTTP/RPC/transaction path still needs isolated end-to-end verification.

## Actual Supabase/PostgREST integration — passed 2026-10-15

The dedicated `Source History PostgREST Integration` workflow passed on commit `2292928a5ab0d325dcb8900b3df4c0cceb8181f1`. It starts an isolated local Supabase stack, applies the tenant-core migration, source-history baseline, candidate source-history migration and deterministic failure seed, then executes the actual worker through Supabase-js and the local `/rest/v1` gateway. The injected database trigger fails an observation insert inside the real RPC transaction; the test confirms the worker persists source/fetch-run failure state, disables absence inference, and leaves no current-item projection, immutable version or observation row behind. It also asserts that failure bookkeeping itself succeeded.

This closes the H09/H15 gap for the actual RPC/PostgREST atomic-failure and reconciliation path in an isolated local stack. It is not a production deployment or staging acceptance; the cron/Vault/Edge Function path and release ACL/migration changes remain gated. H13 remains open and fail-closed because no current production adapter proves exhaustive scope and pagination exhaustion. No production database, grants, data or deployed functions were changed.

## Successful and failed PostgREST RPC paths — latest verification (2026-10-15)

This note supersedes the earlier statement above that the RPC error was still injected at the adapter boundary. The expanded `Source History PostgREST Integration` workflow passed on HEAD `2cca8e84ce1319ee3ae3773b4fba5b6d449b029c` (run `38756905822`). In one isolated local Supabase/PostgREST stack, the real worker now processes two deterministic sources:

- **Failure path:** a temporary SQL trigger raises inside `pulse_record_source_item_observation`. PostgREST returns the real RPC error; the worker marks the source/run failed, disables absence inference, and the test verifies zero current-item, version, and observation rows survived the RPC transaction.
- **Success path:** the second source uses the same real RPC without the injected failure. The test verifies one current-item projection, one immutable version, one observation, and a completed fetch run. It still asserts `completeness_status=incomplete` and `absence_inference_eligible=false`, because this adapter cannot prove exhaustive scope/pagination.

The four PostgreSQL-backed handler cases also pass: HTTP 403, injected observation-persistence error, zero-row source failure update, and zero-row fetch-run failure update. All five standard Pulse workflows passed on this code HEAD as well. This closes the **isolated worker-to-PostgREST RPC and atomic rollback test gap** for H09 and strengthens H15 failure reconciliation; it does not qualify sources or authorize production rollout. H13 remains open/fail-closed. Cron → Vault → Edge Function and production ACL/migration changes still require a reviewed staging environment. No production database, grants, data, or deployed functions were changed.

## Current source-worker integrity follow-up — 15/10/2026

The current worker no longer silently slices oversized item fields before persistence. It now validates the stable external ID (limit 1,000 chars), title (500), URL (2,000), and content (12,000) first; an empty ID or any over-limit field raises a typed `source_snapshot_incomplete:source_item_...` error and the entire fetch run fails closed. The HTML collector also passes its unsliced extracted text to this guard, so long articles are not silently accepted as truncated evidence. New tests cover exact-limit acceptance, each over-limit field, missing identity, and classification as `known_incomplete_response`.

On runtime code commit `0ee05174149b53fba68dd0afa58cdf6bb8183a4f`, Pulse Regression and **Source History PostgREST Integration** passed. The integration workflow uses the actual local Supabase/PostgREST path for both the atomic observation-RPC failure and success cases, and additionally now exercises a seeded HTTP 403 source: one failed fetch run, no current-item/version/observation rows, persisted source/run failure, and absence inference disabled. No production database, grants, source rows, or deployed functions were changed.

H09's real RPC rollback/reconciliation contract is validated in isolated local PostgREST. H15's access-denial path is tested both at handler level and through local PostgREST. The broader H01–H15 suite is not declared complete: H13 remains the principal implementation blocker because none of the current production adapters proves exhaustive catalogue scope and exhausted pagination; zero-row write failures are covered by PostgreSQL tests but staging and production release gates remain separate.

## Latest PostgREST zero-row failure coverage — 2026-10-15

The isolated Supabase integration fixture now includes two more failure cases using temporary database triggers: one suppresses the source `last_error` update and one suppresses the fetch-run `status='failed'` update. The worker must detect the empty PostgREST `RETURNING` result, emit a structured failure event, report `reconciliation_incomplete`, and still attempt the independent status write. The integration run on HEAD `a2bc5e6167c15c32b5ea1078a477220e986b809d` passed all six workflows, including **Source History PostgREST Integration**. These triggers and records exist only in the ephemeral CI fixture; no production schema or data changed.

