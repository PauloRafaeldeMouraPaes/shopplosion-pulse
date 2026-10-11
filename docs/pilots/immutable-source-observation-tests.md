# Contrato de testes — histórico imutável de fontes

**Status:** H01–H15 não executados integralmente como suíte formal; o aceite completo continua pendente.

**Execução parcial mais recente:** [Pulse Regression #2328](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837538) e [Pulse Browser Smoke #1560](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38162837462) passaram no commit `6016791934b6f1c1a8b61ee6a39dd698fcb72471`; os outros três workflows também passaram nesse commit. O CI verificou a migration gerada pela Supabase CLI contra PostgreSQL 17 efêmero, executou `deno check`, testes unitários de retry HTTP, registro de falha e fingerprint canônico e casos SQL de falha injetada e persistência do vetor SHA-256 conhecido. Nenhum banco Supabase foi usado.

**Última execução confirmada:** no commit `f39586036440dbf9d86bc3e9c677fe620fdb9bc9`, os cinco workflows do PR passaram: [Regression #2341](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38163187088), [Browser Smoke #1566](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38163186937), [Evidence Contract #309](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38163186862), [Private AI Audit #664](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38163186913) e [Multi-Tenant Audit #694](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38163186919). Essa execução incluiu recomputação independente do fingerprint persistido e teste com `SET ROLE authenticated`; a cobertura segue sintética, sem Supabase de produção. Os commits posteriores devem ser validados separadamente.

**Cobertura demonstrada em ambiente sintético:** primeira captura, repetição idêntica, alteração e reversão; IDs externos iguais em fontes diferentes; rejeição de referências cross-tenant por FKs compostas; RLS habilitado e ausência de privilégios diretos de cliente; triggers append-only; retry idempotente e proteção contra retry antigo que regrediria a projeção; publicação versus observação; metadados de parser sem duplicar versão; fingerprint malformado ou reutilizado para payload diferente; erro injetado na gravação da observação após a inserção da versão/projeção, confirmando rollback integral da chamada RPC; retry HTTP transitório e bloqueio de novas tentativas após 403; testes de registro do estado de falha e emissão de eventos quando a própria atualização de estado falha; migration e rollback.

**Cobertura ainda incompleta:** H07 agora executa uma consulta com SET ROLE authenticated no PostgreSQL sintético e confirma que a role não consegue ler o histórico (acesso direto revogado, mais restritivo que filtrar por tenant); ainda não é um teste de políticas RLS de leitura por tenant, pois não há grant de SELECT para cliente; H09 já tem um teste sintético de atomicidade da RPC e testes unitários para o helper de bookkeeping, mas ainda precisa de um teste end-to-end que provoque falha real no worker e confirme a reconciliação da execução; H12 agora tem teste unitário do algoritmo, vetor SHA-256 conhecido e recomputação independente em SQL do SHA-256 do snapshot persistido usando os campos efetivamente gravados; a execução desta nova asserção ainda precisa passar no CI; H13 permanece deliberadamente não implementado até haver um contrato de completude por fonte, para evitar falsos desaparecimentos; H15 tem testes unitários do helper 403 e da persistência do estado de falha, mas falta exercitar a cadeia completa do worker com banco isolado. Portanto, H01–H15 **não** passaram integralmente e o aceite de produção continua bloqueado.

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
| H07 — RLS leitura | Usuário autenticado da indústria A consulta linhas da indústria B | Nenhuma linha de B fica visível |
| H08 — escrita do cliente | `anon` e `authenticated` tentam inserir, alterar ou apagar histórico | Negado; o worker autorizado continua funcional |
| H09 — falha de persistência | Simular falha ao gravar versão/observação | Execução não fica marcada como sucesso completo; erro é observável e reconciliável |
| H10 — reexecução idempotente | Reprocessar o mesmo lote/execução após retry | Restrições únicas impedem duplicatas; resultado pode ser reconciliado |
| H11 — ordem temporal | Publicação antiga coletada hoje | `published_at` preserva data da fonte; `observed_at` registra coleta atual |
| H12 — integridade de conteúdo | Recalcular fingerprint de versão salva | Hash corresponde à representação canônica documentada |
| H13 — snapshot ausente | Fonte não retorna um item previamente conhecido | Não apagar histórico; registrar ausência somente se o contrato da fonte permitir inferir que o item desapareceu |
| H14 — mudança de parser | Mesmo documento gera extração diferente após mudança de parser | Registrar versão do parser e não classificar automaticamente como mudança de comportamento |
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
