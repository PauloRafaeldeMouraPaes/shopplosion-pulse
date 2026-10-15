# Contrato de testes — histórico imutável de fontes

**Status:** H01–H15 não executados integralmente como suíte formal; o aceite completo continua pendente.

**Execução parcial mais recente:** [Pulse Regression #2328](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837538) e [Pulse Browser Smoke #1560](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837462) passaram no commit `6016791934b6f1c1a8b61ee6a39dd698fcb72471`; os outros três workflows também passaram nesse commit. O CI verificou a migration gerada pela Supabase CLI contra PostgreSQL 17 efêmero, executou `deno check`, testes unitários de retry HTTP, registro de falha e fingerprint canônico e casos SQL de falha injetada e persistência do vetor SHA-256 conhecido. Nenhum banco Supabase foi usado.

**Última execução confirmada no branch sincronizado (2026-10-15):** o commit `ed2efb84942d10b2a8082ea3a829786de5a51420` passou nos cinco workflows Pulse: [Regression](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083492/job/116233026720), [Browser Smoke](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083441/job/116233026580), [Evidence Contract](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083494/job/116233026767), [Private AI Audit](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083442/job/116233026612) e [Multi-Tenant Audit](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38677083472/job/116233026751). Validate também passou, assim como a segunda execução de Regression. Regression verificou a migration gerada pela Supabase CLI em PostgreSQL 17 efêmero e passou a nova regra R01 para não reativar itens `rejected` durante recaptura. Netlify redirect processing passou; header/pages checks foram neutros porque esse branch não altera esses arquivos. A cobertura é sintética e não demonstra execução em Supabase de produção nem aceite integral H01–H15.

**Regra complementar R01 (fora de H01–H15):** Recoletar um item que já recebeu `status='rejected'` pode registrar uma observação nova, mas não pode cancelar a decisão de moderação. O estado só pode ser revertido por uma ação de revisão explícita, nunca como efeito colateral do worker.

**Cobertura demonstrada em ambiente sintético:** primeira captura, repetição idêntica, alteração e reversão; IDs externos iguais em fontes diferentes; rejeição de referências cross-tenant por FKs compostas; RLS habilitado e ausência de privilégios diretos de cliente; triggers append-only; retry idempotente e proteção contra retry antigo que regrediria a projeção; publicação versus observação; metadados de parser sem duplicar versão; fingerprint malformado ou reutilizado para payload diferente; erro injetado na gravação da observação após a inserção da versão/projeção, confirmando rollback integral da chamada RPC; retry HTTP transitório e bloqueio de novas tentativas após 403; testes de registro do estado de falha e emissão de eventos quando a própria atualização de estado falha; migration e rollback; regra R01 de preservação do estado `rejected` durante recaptura, validada no PostgreSQL efêmero.

**Estado por requisito (sem inflar cobertura):** H07 está validado para a arquitetura atual de histórico exclusivamente interno; H09, H13 e H15 continuam bloqueadores end-to-end. H07 usa deliberadamente o modelo de histórico interno: as tabelas não concedem SELECT direto a `anon` nem `authenticated`, e os testes PostgreSQL sintéticos com `SET ROLE anon` e `SET ROLE authenticated` confirmam que a leitura de ambas as tabelas é negada. Para a arquitetura atual, esse é o critério de aceite mais restritivo e evita expor snapshots por uma API de cliente; políticas RLS de leitura por tenant só serão necessárias se uma interface cliente vier a receber acesso direto, caso em que o contrato deverá exigir teste positivo de isolamento entre duas indústrias; H09 já tem um teste sintético de atomicidade da RPC e testes unitários para o helper de bookkeeping, mas ainda precisa de um teste end-to-end que provoque falha real no worker e confirme a reconciliação da execução; H12 agora tem teste unitário do algoritmo, vetor SHA-256 conhecido e recomputação independente em SQL do SHA-256 do snapshot persistido usando os campos efetivamente gravados; a asserção SQL está presente em `scripts/test-immutable-source-observation-sql.py` e passou na execução Regression do HEAD `158eb99fa59d3b06980988ac39d33e7e224ca6c8` (CI sintético, sem conexão ao Supabase); H13 permanece não implementado como capacidade positiva: o worker atual não registra itens ausentes nem declara um snapshot completo, portanto não há inferência automática de desaparecimento. Foi adicionada uma proteção parcial: RSS/Atom e JSON agora falham explicitamente antes de persistir itens quando a resposta contém mais de 50 entradas; também falham diante de links/indicadores explícitos de próxima página, documentos que não parecem RSS/Atom e formatos JSON fora dos três formatos suportados (`array`, `items`, `data`). Isso evita truncamento conhecido, paginação declaradamente incompleta e respostas JSON incompatíveis sendo tratadas como captura vazia válida. Os testes cobrem RSS, Atom, os formatos JSON suportados, indicadores `next`/`has_more`, total declarado (`total_count`/`totalCount`) maior que o array retornado, formato desconhecido e resposta que não é feed. Isso não prova completude: ainda faltam `scope_fingerprint`, validade do parser, paginação esgotada, indicadores de truncamento/limite fornecidos pela fonte, persistência de estado de completude e duas execuções completas consecutivas antes de qualquer conclusão de ausência; H15 tem testes unitários do helper 403 e da persistência do estado de falha, mas falta exercitar a cadeia completa do worker com banco isolado. Portanto, H01–H15 **não** passaram integralmente e o aceite de produção continua bloqueado.

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
