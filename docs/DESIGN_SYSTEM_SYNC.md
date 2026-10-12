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

- `pulse-tokens.css` é carregado antes das folhas de estilo em `index.html`, `app.html`, `ask.html`, `intelligence.html`, `sources.html`, `base.html`, `documento.html` e `auth.html`. Em `documento.html` há apenas um link para tokens.
- As folhas compartilhadas `pulse-shell.css`, `pulse-v2.css` e `pulse-workspace-v3.css` usam tokens semânticos para cores e raios. As definições duplicadas `--pulse-*`, `--p-*`, `--pv3-*` e `--pv4-*` foram removidas dessas folhas. Ainda há cores pontuais em estilos locais de `app.html` e `ask.html`, a tratar na auditoria por componente.
- As páginas existentes carregam Inter e Source Serif 4, ambas já definidas no design system; Source Serif 4 fica reservada ao texto de leitura.
- `pilot-chocolate.html` permanece pendente nesta branch porque o PR #79 altera o mesmo arquivo. Não editar antes da integração desse PR, conforme a regra de concorrência da rodada.

O acabamento é incremental, arquivo por arquivo. Nenhuma rota, ID, âncora ou fluxo é alterado.
