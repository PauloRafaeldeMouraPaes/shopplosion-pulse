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
- O spec `scripts/browser-tests/pulse-acabamento-contract.spec.js`, importado pelo teste de rotas já presente, foi executado no Browser Smoke #1764. Nas duas larguras, `index.html`, `app.html` e `ask.html` registraram zero textos abaixo de 11 px, zero falhas de contraste, zero travessões/meias-riscas e zero rótulos acima do título. O run terminou com 15 testes aprovados e 2 falhas, ambas limitadas ao piloto bloqueado. O teste de app/Ask também não registrou erros de runtime após a correção das strings.
- Nas duas larguras de `pilot-chocolate.html`, o Browser Smoke #1766 (execução https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/actions/runs/38263030014) registrou 8 textos abaixo de 11 px, 11 falhas de contraste, 2 ocorrências de U+2013/U+2014 e 1 rótulo acima do título. O detalhe inclui texto branco sobre `#e51b67` com 4,48:1, labels de 10 px com 4,14:1 e rodapé com 3,52:1. Esses achados continuam bloqueados pelo PR #79, conforme a regra de concorrência.
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
