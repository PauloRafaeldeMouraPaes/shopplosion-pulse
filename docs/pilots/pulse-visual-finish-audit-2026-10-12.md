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
- Não foi possível executar o novo spec Playwright neste ambiente: não há checkout local e a tentativa de clonar o repositório falhou porque o ambiente não resolve `github.com`. O workflow de Browser Smoke não inclui esse novo spec e não foi alterado, conforme solicitado.
- Por isso, os valores de contraste computados no navegador e as capturas a 1440 px e 390 px continuam **não verificados**. O spec `scripts/browser-tests/pulse-acabamento-contract.spec.js` anexa screenshots e falha para texto abaixo de 11 px, contraste AA insuficiente, U+2013/U+2014 no texto visível e mais de um rótulo acima do título, quando executado.
- O skip link global não foi adicionado: nas páginas não existe um destino comum estável e criar/alterar IDs ou âncoras contrariaria a restrição explícita desta rodada. Deve ser decidido em rodada de acessibilidade que permita esse contrato.
- O cleanup de travessões nos dados públicos e nos espelhos, assim como a substituição do nome da marca do piloto por “marca do piloto”, pertence ao commit de dados separado do item 8. Os arquivos concorrentes do PR #79 continuam bloqueados.

## Métricas estáticas

Duas leituras são separadas para não misturar valores de token com declarações por arquivo.

| Métrica | Antes | Após esta rodada |
|---|---:|---:|
| Cores hex distintas na folha de tokens | 15 | 16 |
| Soma de cores hex distintas por arquivo nas 11 páginas/folhas comparáveis, excluindo tokens gerados e arquivos bloqueados | 329 | 4 |
| Declarações `!important` nas 11 páginas/folhas comparáveis | 191 | 244 |
| Declarações CSS de tamanho abaixo de 11 px | 66 | 0 |
| U+2013/U+2014 em texto de interface/evidência auditado | 126 | 0 |
| Falhas de contraste computadas em navegador | Não medido | Não medido |

As quatro cores hex restantes nas páginas comparáveis são valores de `theme-color` coerentes com a superfície do app. Há três ocorrências de U+2013/U+2014 em comentários CSS que não são renderizados. O número de `!important` aumentou para preservar cascata e garantir movimento reduzido e tipografia móvel; o CSS legado de `pulse-v2.css` não foi reescrito por inteiro nesta rodada.

A contagem de contraste “não medido” é deliberada: não declarar zero sem execução real do navegador. Duas falhas de foreground identificadas estaticamente em `intelligence.html` foram corrigidas. O token `brand-pulse-strong` (`#d3185f`) tem contraste calculado de 5,17:1 sobre branco e 4,51:1 sobre `brand-soft`.

## Próxima ação

Após merge do PR #79, concluir `pilot-chocolate.html` e o documento público do piloto. Em seguida executar localmente `npx playwright test scripts/browser-tests/pulse-acabamento-contract.spec.js`, anexar a saída e as capturas, corrigir os achados de runtime e atualizar este relatório antes de marcar o PR como pronto.
