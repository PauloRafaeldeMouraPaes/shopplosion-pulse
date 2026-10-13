# Auditoria de acabamento visual do Pulse

Data: 12/10/2026  
Branch: `style/pulse-acabamento-2026-10-12`

## Referência

Auditoria baseada em `vercel-labs/web-interface-guidelines`, commit `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05). Regras consideradas: acessibilidade semântica, foco visível, formulários, movimento reduzido, tipografia, imagens, performance, navegação, toque, safe areas, theme-color e color-scheme. Regras de React/Next/build foram ignoradas.

## Achados corrigidos

- `index.html:14-17,22,31-32`: títulos e labels alinhados à escala do Pulse, números tabulares, breadcrumb em `ink-3`, foco visível preservado.
- `pulse-workspace-v3.css:9-14,20,23-27,41,59,66-67`: hierarquia tipográfica e metadados ajustados; campos com fonte legível; labels de breadcrumb; contraste dos controles secundários; movimento reduzido e foco visível preservados.
- `pulse-workspace-v3.js:32-39`: logo com `alt`, dimensões explícitas, botões de comando nomeados e um único rótulo acima do título.
- `pulse-workspace-v3.js:63,79`: metadados de evidência rotulados como Fonte e Período; alcance e fato verificado mantidos como campos separados; ação de investigação padronizada como “Investigar”.
- `pulse-workspace-v3.js:103`: campo de pergunta com label associado, `name`, `type`, `inputmode`, `autocomplete` e placeholder com reticências tipográficas.
- `pulse-shell.css:11,18-19,68`: campo de comando com tipografia válida, foco de teclado visível e campo de escopo com tamanho legível.
- `ask.html:58`: placeholder alterado para reticências tipográficas; o campo mantém nome, tipo, rótulo acessível e autocomplete.
- `app.html:25`, `ask.html:40`: botões de prompt agora usam tipografia de interface de 14 px, alvo de 44 px e foco visível sem cancelar o indicador.
- `scripts/pulse-local-evidence.js:81`: removido o travessão da mensagem visível do painel de evidência local.
- `intelligence.html:5`: título e eyebrow corrigidos; prioridade alta e selo novo deixaram de usar cores de texto com contraste insuficiente, preservando o estado com borda de acento.
- `app.html:6-7`, `ask.html:6-7`, `intelligence.html:2-3`, `sources.html:2-3`, `base.html:2-3`, `documento.html:6-7`, `auth.html:2-3`, `index.html:6-7`: theme-color e color-scheme presentes e coerentes com o tema claro.
- As páginas acima carregam `pulse-tokens.css` antes das outras folhas de estilo. `documento.html` contém um único link para tokens.
- Nenhum `img` está sem `alt` nas páginas HTML estáticas auditadas. O logo da casca gerada recebeu `alt`, largura e altura explícitas.

## Achados não corrigidos ou não verificados

- `pilot-chocolate.html:6-8`: título ainda contém U+2014; falta carregar `pulse-tokens.css` e declarar `theme-color`/`color-scheme`. **Bloqueado intencionalmente**: o PR #79 está aberto e altera `pilot-chocolate.html` e o documento do piloto. A regra de concorrência desta rodada exige aguardar a integração antes de editar esses arquivos.
- `pilot-chocolate.html:8`: estilos locais ainda usam uma paleta hardcoded. Será migrada para tokens quando o conflito com o PR #79 for resolvido.
- Todas as páginas ainda não receberam teste de teclado manual, leitor de tela e verificação visual de foco encoberto por rail/sticky header.
- A execução local não foi possível: não há checkout local e a tentativa de clonar o repositório falhou porque o ambiente não resolve `github.com`. O workflow de Browser Smoke alcança o novo spec indiretamente: `scripts/browser-tests/pulse-route-consistency.spec.js` o importa via `require('./pulse-acabamento-contract.spec.js')`, sem alteração de workflow.
- O spec canônico `scripts/browser-tests/pulse-acabamento-contract.spec.js` é importado pelo teste de rotas já existente. O ponto de entrada local `scripts/browser-tests/pulse-visual-finish.spec.js` executa o mesmo contrato, sem alterar workflow. No Browser Smoke #1773, no HEAD `19ef3a1bee8e0c36e340e1f590b0de38d2245f14`, `index.html`, `app.html` e `ask.html` registraram zero textos abaixo de 11 px, zero falhas de contraste, zero travessões/meias-riscas e zero rótulos acima do título nas duas larguras. O run terminou com 15 testes aprovados e 2 falhas, ambas limitadas ao piloto bloqueado. O teste de app/Ask não registrou erros de runtime.
- Nas duas larguras de `pilot-chocolate.html`, o Browser Smoke #1773 (execução https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38293529966) voltou a registrar as mesmas falhas bloqueantes: 8 textos abaixo de 11 px, 11 falhas de contraste, 2 ocorrências de U+2013/U+2014 e 1 rótulo acima do título. O detalhe inclui texto branco sobre `#e51b67` com 4,48:1, labels de 10 px com 4,14:1 e rodapé com 3,52:1. Esses achados continuam bloqueados pelo PR #79, conforme a regra de concorrência.
- O workflow terminou sem artifacts de screenshot. O spec chama `testInfo.attach`, mas o workflow atual não publica o relatório Playwright; portanto as capturas de 1440 px e 390 px ainda não estão acessíveis no PR.
- O skip link global não foi adicionado: nas páginas não existe um destino comum estável e criar/alterar IDs ou âncoras contrariaria a restrição explícita desta rodada. Deve ser decidido em rodada de acessibilidade que permita esse contrato.
- Os três níveis da base pública estão higienizados nesta branch: registro embutido em `index.html`, `pulse-public-evidence.js` e o espelho `supabase/functions/pulse-ask-ai/public-evidence.ts` não contêm U+2013/U+2014 nem o nome da marca do piloto. O contrato em `scripts/test-pulse-ask-ai.js` também compara os três arrays JSON normalizados, em ordem, e verifica os 34 registros. O passo Pulse Regression #2774 passou com essa guarda. O documento público do piloto ainda tem 4 ocorrências do nome e 24 travessões/meias-riscas; `pilot-chocolate.html` ainda tem 2 ocorrências de travessão/meia-risca. Ambos permanecem bloqueados pelo PR #79, conforme a regra de concorrência. A edição final do documento público do piloto ficará pendente da integração do PR #79.

## Métricas estáticas

Duas leituras são separadas para não misturar valores de token com declarações por arquivo.

| Métrica | Antes | Após esta rodada |
|---|---:|---:|
| Cores hex distintas na folha de tokens | 15 | 16 |
| Soma de cores hex distintas por arquivo nas 11 páginas/folhas comparáveis, excluindo tokens gerados e arquivos bloqueados | 329 | 4 |
| Declarações `!important` nas 11 páginas/folhas comparáveis | 191 | 244 |
| Declarações CSS de tamanho abaixo de 11 px | 66 | 0 |
| U+2013/U+2014 em texto de interface/evidência auditado | 126 | 0 |
| Falhas de contraste computadas em navegador, escopo não bloqueado | 1 placeholder no Ask AI | 0 |
| Falhas de contraste computadas em navegador, piloto bloqueado | 11 por viewport | 11 por viewport, pendente |

As quatro cores hex restantes nas páginas comparáveis são valores de `theme-color` coerentes com a superfície do app. Há três ocorrências de U+2013/U+2014 em comentários CSS que não são renderizados. O número de `!important` aumentou para preservar cascata e garantir movimento reduzido e tipografia móvel; o CSS legado de `pulse-v2.css` não foi reescrito por inteiro nesta rodada.

A execução real confirmou que o placeholder do Ask AI passou após a correção de contraste; duas falhas de foreground identificadas estaticamente em `intelligence.html` também foram corrigidas. A Regression #2774 passou pelo contrato de higiene e paridade da evidência pública em três camadas (34 objetos equivalentes). O token `brand-pulse-strong` (`#d3185f`) tem contraste calculado de 5,17:1 sobre branco e 4,51:1 sobre `brand-soft`. O piloto segue com falhas reais e não foi editado por estar no PR #79.

## Próxima ação

Após merge do PR #79, corrigir os 8 textos abaixo de 11 px, as 11 falhas de contraste, as duas ocorrências de U+2013/U+2014 e o rótulo duplicado em `pilot-chocolate.html`; trocar “Confiança inicial” pelos campos de fato verificado e alcance. Corrigir também o documento público do piloto e tornar as capturas acessíveis no PR sem alterar workflow, se houver forma suportada. Atualizar este relatório antes de marcar o PR como pronto.


## Revalidação complementar em 13/10/2026

- A branch `style/pulse-acabamento-2026-10-12` continua presente. O PR #81 permanece aberto; os PRs #79 e #80 também aparecem abertos na busca do repositório. Nenhum PR foi integrado.
- Revalidação da geração de tokens por reprodução independente do algoritmo de `scripts/build_design_tokens.py` sobre o conteúdo atual de `design/tokens.json`: saída reproduzida com 5.117 bytes, idêntica byte a byte a `pulse-tokens.css` (blob SHA `737b02d4e3b34da2d493eed7f79c5e3e28205ee1`). Fonte JSON: blob SHA `d4796925bfa3cb3c153de877af261d1e89682841`. **Limite:** o script Python oficial não foi executado nesta sessão; esta verificação independente confirma equivalência do algoritmo reproduzido, não substitui uma execução local do script.
- No arquivo `pulse-workspace-v3.js` da branch, a grafia literal `COMEÇE` não foi encontrada.
- CI consultado para o commit `7f5c287c91aa4756cabed8ec48d93e0798f0ffda`: Regression #2802, Evidence Contract #517, Multi-Tenant Audit #902 e Private AI Audit #872 passaram; Browser Smoke #1774 falhou. Não houve nova execução de CI nesta revalidação.
- Bloqueio mantido: o PR #79 modifica `pilot-chocolate.html` e `docs/pilots/chocolate-emerging-shopper-signals.md`. O conteúdo desses arquivos na base `main` ainda contém a paleta local, a referência de confiança fixa e a menção a Lindt no documento. Não foram editados nesta rodada para respeitar a regra de não trabalhar sobre base concorrente.
- As capturas reais de 1440 px e 390 px continuam sem artifacts acessíveis no PR. Não foram criadas capturas artificiais.


## Resultado final do Browser Smoke no HEAD 698c620 (13/10/2026)

Execução real: [Pulse Browser Smoke #1782](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38343963910), commit `698c620302a797c477e983693eba5aaef2815530`. O workflow terminou em **failure**; não declarar o PR pronto.

- Passaram: Pulse Regression #2818, Evidence Contract #525, Multi-Tenant Audit #910 e Private AI Audit #880.
- Browser Smoke falhou em duas etapas:
  1. **Condução:** 2 testes passaram e 1 falhou por timeout de 15 s em `page.goto('/app.html', { waitUntil: 'domcontentloaded' })`; a falha ocorreu na navegação, antes das asserções do módulo. Não há evidência suficiente para atribuir a causa ao módulo de condução.
  2. **Casca/contrato visual:** 12 testes passaram e 5 falharam. Dois testes de navegação para `app.html?v=20260921.15#analyses` expiraram em `page.goto` após 15 s. O contrato visual reportou 8 textos abaixo de 11 px, 11 falhas de contraste, 2 travessões/meias-riscas e 1 rótulo acima do título em `pilot-chocolate.html`, tanto em 1440 quanto em 390 px. Também houve timeout de navegação em `app.html` a 390 px.
- Exemplo de contraste observado no piloto: texto `#e51b67` sobre branco, razão calculada de 4,48:1, abaixo do mínimo AA de 4,5:1.
- Ask AI interaction (7 testes) e busca de evidência de chocolate (1 teste) passaram; demais smoke steps observados também passaram.
- Os erros de timeout devem ser investigados separadamente das falhas de acessibilidade. Não aumentei timeouts nem alterei as asserções para esconder falhas.
- O PR #79 segue aberto e com conflitos (`mergeable: false`), alterando os dois arquivos do piloto. Por regra explícita, nenhum deles foi editado. Os screenshots continuam sem artifacts publicados pelo workflow existente.

Nenhum workflow, merge ou deploy foi alterado/iniciado nesta investigação.


## Revalidação adicional: Browser Smoke #1783 e espera de navegação (13/10/2026)

- Run [Pulse Browser Smoke #1783](https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38344191278): **falhou por 2 testes visuais do piloto**, com 15 testes passando. A navegação pelas páginas principais e os contratos visuais de `index.html`, `app.html` e `ask.html` passaram nas larguras 1440/390; todos registraram zero erros de runtime, zero textos abaixo de 11 px, zero falhas de contraste, zero travessões/meias-riscas e no máximo um rótulo acima do título.
- `pilot-chocolate.html` permanece com as mesmas métricas nas duas larguras: 8 textos abaixo de 11 px, 11 falhas de contraste, 2 travessões/meias-riscas e 1 rótulo acima do título. As duas falhas continuam sendo o bloqueio conhecido do PR #79, sem alterações no arquivo.
- Ajustei somente os testes `pulse-route-consistency.spec.js` e `pulse-acabamento-contract.spec.js` para iniciar a navegação em `waitUntil: 'commit'` e deixar que as asserções existentes aguardem a casca/elementos necessários. Isso separa a conclusão da navegação da prontidão da UI sem elevar timeouts nem remover asserções. No run #1783, os timeouts de navegação anteriores não se reproduziram.
- Os dois arquivos de teste foram atualizados nos commits `9c93a06525cc357b129f6591b36f579e4696c462` e `9fbc88323bfbb1cf5a25528693a6cb3d578b3d33`. A API de status de commit não expõe os novos workflows de CI para esses commits neste momento; não afirmo que a alteração já passou em uma execução própria.
- O run #1783 também confirmou os testes de interação Ask AI (7/7) e recuperação de evidência de chocolate (1/1). Não houve mudança de workflow, merge ou deploy.


## Fechamento da revalidação CI (13/10/2026, 04:02 UTC)

- No commit `dd4b9d477a6a3625e2ce8208e5578710fb0e8ed1`, os workflows **Pulse QA #2415, Regression #2828, Evidence Contract #530, Multi-Tenant Audit #915 e Private AI Audit #885 passaram**.
- **Browser Smoke #1787 falhou somente em duas asserções** do contrato de acabamento de `pilot-chocolate.html`, nas larguras 1440 px e 390 px. As duas execuções emitiram as mesmas métricas: 8 textos abaixo de 11 px, 11 falhas de contraste, 2 travessões/meias-riscas e 1 rótulo acima do título. Não houve erros de runtime.
- No mesmo run, os contratos de `index.html`, `app.html` e `ask.html` passaram em desktop e mobile; os testes de navegação/rotas, proposta, mobile, Ask AI (7/7) e recuperação de evidência de chocolate (1/1) passaram. O ajuste de `waitUntil: 'commit'` eliminou os timeouts de navegação observados nos runs anteriores, sem enfraquecer as asserções.
- O QA adversarial falhava antes por tratar `./pulse-tokens.css` como dependência local não autorizada. A allowlist agora documenta a exceção para a folha de tokens gerada de `design/tokens.json`; o QA passou no run #2415.
- **Bloqueio externo ao PR #81:** o PR #79 continua aberto e a API do GitHub retorna `mergeable: false`. A rota principal `main` está em `19dff1033ecfca2af627ed47f72761e1b9f13512`, enquanto a cabeça do PR #79 está em `424bc5ac70a2778c8f21e0ab1fe81335a356cd04`. Não há, pela interface consultada, uma lista confiável dos caminhos em conflito; por isso não foi feita resolução especulativa nem alterado `pilot-chocolate.html`/documento do piloto.
- PR #81 permanece aberto e em draft; nenhum PR foi mesclado, nenhum deploy foi iniciado e nenhum workflow foi modificado.


## Correção do contrato visual do piloto (13/10/2026)

- No commit `3c327373f2b46c41d6cd1b0e98911885d4874d69`, alinhei os rótulos ao token tipográfico de 11 px e à cor `ink-3` (`#6e6b76`), que mantém contraste AA sobre superfícies claras.
- Corrigi o uso de magenta em texto para `brand-pulse-strong` (`#d3185f`), conforme `design/tokens.json`; `brand-pulse` (`#e51b67`) fica reservado a indicadores não textuais.
- Substituí travessões/meias-riscas visíveis por hífens simples, inclusive no título HTML, e alinhei a redação do limite central aos 13 sinais ativos.
- A alteração é restrita ao acabamento e à consistência factual do piloto: nenhuma rota, ID, âncora, fluxo, conteúdo probatório ou workflow foi alterado. A aprovação final depende da nova execução do Browser Smoke neste commit.
