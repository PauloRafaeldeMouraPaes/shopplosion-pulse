# Reconciliação do artefato publicado (issue #19)

Data da verificação: 2026-10-31. Fonte da verdade: `main` no GitHub. Superfície de produção: GitHub Pages
(`https://paulorafaeldemourapaes.github.io/shopplosion-pulse/`), conforme `pulse-production-proof.json`.

## 1. Identidade do artefato publicado

`scripts/verify_published_artifact.py --ref origin/main --out docs/releases/artifact-identity-2026-10-31.json`
baixou cada arquivo publicado com `Cache-Control: no-cache`, calculou o SHA-256 e comparou com o blob
correspondente em `main` (`4a591add462e6d73aaf227e38bde37fb848a90e0`).

Resultado: **22 de 22 arquivos idênticos** (HTML das sete páginas, piloto, runtime `pulse-workspace-v3.js`,
`pulse-config.js`, `pulse-public-evidence.js`, as quatro folhas de estilo, scripts de aprofundamento, logo e
`_redirects`). Os hashes completos estão no registro JSON. O último deployment do ambiente `github-pages`
aponta para o mesmo commit (`4a591add`, 2026-10-28).

Netlify: o site `jade-phoenix-1a4ccc.netlify.app` ainda recebe checks de deploy preview nas PRs, mas responde
HTTP 401 (Edge Access) e não é a superfície de produção. Não foi possível comparar seus bytes; nada foi
assumido sobre ele. `netlify.toml` e `_redirects` continuam no repositório e são publicados no Pages sem efeito.

O script falha (exit 1) quando qualquer arquivo difere ou não pode ser baixado, e registra `not_verified`
em vez de declarar identidade quando a rede não alcança o Pages.

## 2. Dependências externas

| Página | Dependência externa | Estado |
|---|---|---|
| auth, app | `@supabase/supabase-js@2.116.0` (jsDelivr) | já fixada |
| index, intelligence, ask, sources, documento | eram `@supabase/supabase-js@2` (flutuante; resolvia para 2.118.0 em 2026-10-31) | **fixadas em 2.116.0** nesta reconciliação, a mesma versão que cria a sessão em `auth.html` |
| app | `pdf.js 3.11.174` (cdnjs) para extração de PDF | mantida |
| pulse-config | `pdfjs-dist@4.10.38` (jsDelivr, import dinâmico) | mantida |
| todas | Google Fonts (Inter, Source Serif 4) | mantida |

O SDK do Supabase não foi removido: autenticação (`auth.html`), broker de indústria, consultas privadas e
persistência de investigações dependem dele. Removê-lo exige empacotar uma cópia local verificada e
repetir o fluxo de login real. Próximo passo possível, fora desta rodada: adicionar `integrity` (SRI) às
tags fixadas e testar o login manualmente antes do merge.

Duplicações eliminadas: `ask.html` carregava `pulse-public-evidence.js` três vezes (head, meio e fim);
ficou uma carga, no head, antes de qualquer consumidor.

Cópias aninhadas em `supabase/functions/pulse-ask-ai/pulse-ask-ai/index.ts` (divergente do deployado) e
`supabase/functions/pulse-rag-eval/pulse-rag-eval/index.ts` (idêntica) não são referenciadas pelo manifesto
nem pelos workflows. Ficaram intocadas nesta rodada para não misturar limpeza de Edge Functions com a
reconciliação do front; `scripts/audit_pulse_text_integrity.py` reporta a divergência a cada execução.

## 3. Listeners duplicados

`scripts/browser-tests/pulse-listener-integrity.spec.js` instrumenta `addEventListener` antes de qualquer
script da página e conta handlers por elemento. Resultado em `main`:

- Nenhum elemento com mais de um listener de clique em index, ask, app, base e sources. Os dez listeners de
  âncora são dez links distintos (rail e navegação mobile), um handler cada.
- Sugestões de pergunta (`.questionExample[data-question]`) recebem exatamente um handler, e só depois do
  portão de sessão do Ask AI.
- **Defeito real encontrado e corrigido**: `ask.html` registrava duas vezes o `keydown` de Enter em `#query`,
  disparando `generateAnswer()` duas vezes por tecla. O segundo registro foi removido. O teste reproduz o
  caminho autenticado com um cliente Supabase simulado (sem rede, sem dados) para cobrir essa regressão.

## 4. Integridade textual

`scripts/audit_pulse_text_integrity.py` varre todos os arquivos de texto rastreados: BOM, caracteres de
largura zero, controles bidirecionais, outros caracteres de formato (Cf), caracteres de controle (Cc) e NBSP
dentro de sintaxe de tag ou em arquivos de código. Resultado em `main`: 182 arquivos, nenhuma anomalia.
A verificação roda no workflow Pulse Regression.

## 5. O que esta reconciliação não cobre

- Comparação com o artefato Netlify (inacessível, 401).
- Remoção do SDK do Supabase ou do pdf.js.
- Verificação da identidade de versões futuras: rodar o script de novo após cada deploy e guardar o JSON em
  `docs/releases/`.
