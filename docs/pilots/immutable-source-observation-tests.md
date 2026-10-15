# Contrato de testes — histórico imutável de fontes

**Status:** H01–H15 não executados integralmente como suíte formal; o aceite completo continua pendente.

**Execução parcial mais recente:** [Pulse Regression #2328](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837538) e [Pulse Browser Smoke #1560](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837462) passaram no commit `6016791934b6f1c1a8b61ee6a39dd698fcb72471`; os outros três workflows também passaram nesse commit. O CI verificou a migration gerada pela Supabase CLI contra PostgreSQL 17 efêmero, executou `deno check`, testes unitários de retry HTTP, registro de falha e fingerprint canônico e casos SQL de falha injetada e persistência do vetor SHA-256 conhecido. Nenhum banco Supabase foi usado.

**Última execução confirmada no branch sincronizado (2026-10-15):** o commit `ed2efb84942d10b2a8082ea3a829786de5a51420` passou nos cinco workflows Pulse: [Regression](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083492/job/116233026720), [Browser Smoke](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083441/job/116233026580), [Evidence Contract](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083494/job/116233026767), [Private AI Audit](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083442/job/116233026612) e [Multi-Tenant Audit](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083472/job/116233026751). Validate também passou, assim como a segunda execução de Regression. Regression verificou a migration gerada pela Supabase CLI em PostgreSQL 17 efêmero e passou a nova regra R01 para não reativar itens `rejected` durante recaptura. Netlify redirect processing passou; header/pages checks foram neutros porque esse branch não altera esses arquivos. A cobertura é sintética e não demonstra execução em Supabase de produção nem aceite integral H01–H15.

**Regra complementar R01 (fora de H01–H15):** Recoletar um item que já recebeu `status='rejected'` pode registrar uma observação nova, mas não pode cancelar a decisão de moderação. O estado só pode ser revertido por uma ação de revisão explícita, nunca como efeito colateral do worker.

**Cobertura demonstrada em ambiente sintético:** primeira captura, repetição idêntica, alteração e reversão; IDs externos iguais em fontes diferentes; rejeição de referências cross-tenant por FKs compostas; RLS habilitado e ausência de privilégios diretos de cliente; triggers append-only; retry idempotente e proteção contra retry antigo que regrediria a projeção; publicação versus observação; metadados de parser sem duplicar versão; fingerprint malformado ou reutilizado para payload diferente; erro injetado na gravação da observação após a inserção da versão/projeção, confirmando rollback integral da chamada RPC; retry HTTP transitório e bloqueio de novas tentativas após 403; testes de registro do estado de falha e emissão de eventos quando a própria atualização de estado falha; migration e rollback; regra R01 de preservação do estado `rejected` durante recaptura, validada no PostgreSQL efêmero.

**Estado por requisito (sem inflar cobertura):** H07 está validado para a arquitetura atual de histórico exclusivamente interno; H13 continua bloqueador de capacidade positiva; H09 e H15 receberam novos testes do handler e PostgreSQL isolado, mas seguem com gate aberto para a integração real Supabase/PostgREST. H07 usa deliberadamente o modelo de histórico interno: as tabelas não concedem SELECT direto a `anon` nem `authenticated`, e os testes PostgreSQL sintéticos com `SET ROLE anon` e `SET ROLE authenticated` confirmam que a leitura de ambas as tabelas é negada. Para a arquitetura atual, esse é o critério de aceite mais restritivo e evita expor snapshots por uma API de cliente; políticas RLS de leitura por tenant só serão necessárias se uma interface cliente vier a receber acesso direto, caso em que o contrato deverá exigir teste positivo de isolamento entre duas indústrias; H09/H15 agora têm testes do handler real do worker: 403 sem observação válida e erro de persistência da RPC, com estado de source/fetch_run verificado em PostgreSQL 17 isolado. A falha da RPC é injetada na fronteira do adapter; a suite SQL separada verifica rollback atômico. Foram acrescentados testes do handler para respostas sem erro mas sem linha retornada nos writes de falha de source e fetch_run, confirmando `reconciliation_incomplete` e a tentativa do outro write. Os novos testes PostgreSQL também instalam triggers temporárias `BEFORE UPDATE` que suprimem a atualização de falha de source ou fetch_run, confirmando no banco que o worker detecta zero linhas retornadas, registra `reconciliation_incomplete`, tenta o write independente e não trata o estado antigo como reconciliado. Ainda falta executar a RPC real através de PostgREST, em vez de injetar seu erro na fronteira do adapter; H12 agora tem teste unitário do algoritmo, vetor SHA-256 conhecido e recomputação independente em SQL do SHA-256 do snapshot persistido usando os campos efetivamente gravados; a asserção SQL está presente em `scripts/test-immutable-source-observation-sql.py` e passou na execução Regression do HEAD `158eb99fa59d3b06980988ac39d33e7e224ca6c8` (CI sintético, sem conexão ao Supabase); H13 permanece não implementado como capacidade positiva: o worker atual não registra itens ausentes nem declara um snapshot completo, portanto não há inferência automática de desaparecimento. Foi adicionada uma proteção parcial: RSS/Atom e JSON agora falham explicitamente antes de persistir itens quando a resposta contém mais de 50 entradas; também falham diante de links/indicadores explícitos de próxima página, documentos que não parecem RSS/Atom e formatos JSON fora dos três formatos suportados (`array`, `items`, `data`). Isso evita truncamento conhecido, paginação declaradamente incompleta e respostas JSON incompatíveis sendo tratadas como captura vazia válida. Os testes cobrem RSS, Atom, os formatos JSON suportados, indicadores `next`/`has_more`, total declarado (`total_count`/`totalCount`) maior que o array retornado, formato desconhecido e resposta que não é feed. Isso não prova completude: ainda faltam `scope_fingerprint`, validade do parser, paginação esgotada, indicadores de truncamento/limite fornecidos pela fonte, persistência de estado de completude e duas execuções completas consecutivas antes de qualquer conclusão de ausência; H15 tem testes unitários do helper 403 e da persistência do estado de falha, mas falta exercitar a cadeia completa do worker com banco isolado. Portanto, H01–H15 **não** passaram integralmente e o aceite de produção continua bloqueado.

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
