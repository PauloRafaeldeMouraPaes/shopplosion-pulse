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

## Quando o design system mudar

1. Peça ao Claude para reexportar o `tokens.json` do artifact "Pulse", ou
   copie os valores manualmente na página `project/tokens.json` do
   artifact.
2. Substitua o conteúdo de `design/tokens.json` por essa versão e dê push
   no `main`.
3. O workflow regenera e commita `pulse-tokens.css` automaticamente. Se
   preferir rodar local: `python3 scripts/build_design_tokens.py`.

## Ainda falta (fase 1 da proposta, "Casca e tokens")

`pulse-tokens.css` hoje é gerado, mas **as páginas ainda não o carregam** e
`pulse-shell.css` / `pulse-v2.css` / `pulse-workspace-v3.css` continuam com
seus próprios valores hardcoded (as três camadas `--pulse-*`, `--p-*`,
`--pv3-*` que o diagnóstico da proposta já aponta como redundantes). Para
fechar o ciclo:

1. Adicionar `<link rel="stylesheet" href="./pulse-tokens.css">` antes das
   três folhas de estilo atuais em cada página (`index.html`, `app.html`,
   `ask.html`, `intelligence.html`, `sources.html`, `auth.html`).
2. Trocar, uma folha de cada vez, os valores hardcoded de cor/raio/sombra
   por `var(--token)` correspondente, e remover as variáveis `--pulse-*`,
   `--p-*` e `--pv3-*` que hoje duplicam a mesma cor/raio em três lugares.
3. Carregar Inter e Source Serif 4 via Google Fonts (ver o README do
   design system, seção Tipografia) antes de aplicar `.reading` a
   respostas do Ask AI e texto de análise.

Isso é a fase 1 da proposta de reconstrução ("Casca e tokens... aplicados
sobre as telas atuais. Nada de backend novo"), e pode ser feito depois,
arquivo por arquivo.
