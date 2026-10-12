# Sincronização com o Design System Pulse

Fonte da verdade do design: o artifact "Pulse" em
https://claude.ai/artifact/HJpqAb7H3fQ9qu5bEcmpn3 (cor, tipografia,
espaço/raio/elevação, iconografia, movimento e os 9 componentes
documentados). O repositório consome esses tokens via `pulse-tokens.css`,
um arquivo **gerado** — nunca editado à mão.

## Como funciona

```
design/tokens.json  →  scripts/build_design_tokens.py  →  pulse-tokens.css
     (fonte)                    (produtor)                    (gerado)
```

1. `design/tokens.json` é uma cópia do `tokens.json` do design system.
2. `scripts/build_design_tokens.py` lê esse arquivo e escreve
   `pulse-tokens.css` na raiz do repo: variáveis CSS (`--surface-canvas`,
   `--brand-pulse`, `--space-16`, `--radius-card`, `--font-sans`, ...) e uma
   classe por estilo de tipografia (`.display`, `.title`, `.section`,
   `.reading`, `.interface`, `.label`).
3. `.github/workflows/design-tokens.yml` roda o script sozinho sempre que
   `design/tokens.json` muda no branch `main` e commita o
   `pulse-tokens.css` resultante — ninguém precisa rodar o script à mão
   depois de atualizar o token source.

## Token de contraste da rodada de acabamento

`brand-pulse-strong` (`#d3185f`) é o token de alto contraste para texto magenta e botões preenchidos com texto branco. O magenta original `brand-pulse` (`#e51b67`) permanece para usos sem texto, como marca decorativa. Não use o token original como foreground de texto em superfícies claras. Após mudar `design/tokens.json`, rode `python3 scripts/build_design_tokens.py` e inclua o CSS gerado no mesmo conjunto lógico de mudança. A cor forte tem contraste calculado de aproximadamente 5,17:1 sobre branco e 4,51:1 sobre `brand-soft`.

## Quando o design system mudar

1. Peça ao Claude para reexportar o `tokens.json` do artifact "Pulse", ou
   copie os valores manualmente na página `project/tokens.json` do
   artifact.
2. Substitua o conteúdo de `design/tokens.json` por essa versão e dê push
   no `main`.
3. O workflow regenera e commita `pulse-tokens.css` automaticamente. Se
   preferir rodar local: `python3 scripts/build_design_tokens.py`.

## Estado da fase 1 na rodada de acabamento (12/10/2026)

- O token `brand-pulse-strong` foi adicionado a `design/tokens.json` e o CSS foi regenerado em `pulse-tokens.css`. O contraste calculado é 5,17:1 com branco e 4,51:1 com `brand-soft`.
- `index.html`, `app.html`, `ask.html`, `intelligence.html`, `sources.html`, `base.html`, `documento.html` e `auth.html` carregam `pulse-tokens.css` antes das folhas de estilo. `documento.html` tem um único link de tokens. O acabamento dessas oito páginas e da casca compartilhada foi auditado: sem texto CSS abaixo de 11 px, sem travessão/meia-risca no texto visível, contraste AA validado no contrato de navegador em Hoje, app e Ask AI a 1440/390 px; foco, rótulos, autocomplete, movimento reduzido, alt, números tabulares, `theme-color` e `color-scheme` foram revisados. A auditoria detalhada, com arquivo:linha e pendências, está em `docs/pilots/pulse-visual-finish-audit-2026-10-12.md`.
- `pulse-shell.css`, `pulse-v2.css` e `pulse-workspace-v3.css` foram migrados para tokens semânticos para cores, raios e sombras. Aliases que ainda aparecem permanecem porque são referenciados pela cascata existente; não foram removidos às cegas. A contagem de `!important` aumentou em alguns pontos para preservar compatibilidade da casca legada e estados de acessibilidade.
- `pilot-chocolate.html` ainda não carrega o arquivo de tokens e contém valores locais fixos. O PR #79 altera esse mesmo arquivo e o documento público do piloto; o Browser Smoke #1771 falhou somente nos dois testes do piloto (1440/390), com 15 testes aprovados. Não editar os arquivos em conflito antes do merge do PR concorrente, conforme a regra desta rodada.
- A execução local do spec não foi possível porque o ambiente não resolve `github.com`; o contrato foi executado pelo Browser Smoke no CI. O workflow não foi alterado. Capturas de tela estão anexadas pelo Playwright ao relatório de teste, mas não ficam acessíveis como artifact porque o workflow não publica artifacts. Nenhuma auditoria manual de leitor de tela foi declarada concluída.

A rodada é incremental, arquivo por arquivo. Preservar rotas, IDs, âncoras e fluxos existentes.