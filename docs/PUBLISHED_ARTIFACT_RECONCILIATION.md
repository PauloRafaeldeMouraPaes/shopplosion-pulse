# Reconciliação do artefato publicado (issue #19)

Data da verificação: 2026-10-31. Fonte da verdade: `main` no GitHub. Superfície de produção: GitHub Pages
(`https://paulorafaeldemourapaes.github.io/shopplosion-pulse/`), conforme `pulse-production-proof.json`.
Revisado no mesmo dia por auditoria independente; as correções que ela motivou estão incorporadas abaixo.

## 1. Identidade do artefato publicado

O deploy (`pulse-production-release.yml`) envia o checkout inteiro para o Pages (`upload-pages-artifact` com
`path: .`), e o Pages serve tudo exceto caminhos com segmento iniciado por ponto (`.github/`, `.gitignore`...),
que respondem 404. Portanto "o artefato publicado" é a árvore rastreada inteira, não uma lista escolhida à mão.

`scripts/verify_published_artifact.py --ref origin/main --require-release --out docs/releases/artifact-identity-2026-10-31.json`
faz o seguinte, nesta ordem:

1. Lê `pulse-release.json` ao vivo (escrito pelo deploy com o commit publicado) e, com `--require-release`,
   recusa comparar (exit 2, veredito `release_mismatch`) enquanto ele não nomear o commit da ref. Isso
   distingue "ainda propagando" de "diferente".
2. Baixa cada blob rastreado na ref (sem caminhos com ponto) com uma query string por ref
   (`?identity=<sha>`): o CDN do Pages ignora `Cache-Control` de requisição e guarda respostas por 10 min, mas
   trata a query como chave nova de cache, então a leitura chega à origem.
3. Compara o SHA-256 de cada resposta com o blob da ref. Exit 1 se qualquer arquivo diferir ou não puder ser
   baixado; o registro JSON diz `not_verified` quando a rede não alcança o Pages, nunca "idêntico" por omissão.

Resultado em 31/10/2026 contra `main` (`4a591add462e6d73aaf227e38bde37fb848a90e0`): release ao vivo igual ao
commit, **165 de 165 arquivos rastreados idênticos** (as sete páginas, piloto, runtime, estilos, scripts, docs,
código das Edge Functions, dados, logo e `_redirects`). Hashes completos no registro JSON.

Netlify: o site `jade-phoenix-1a4ccc.netlify.app` ainda recebe checks de deploy preview nas PRs, mas responde
HTTP 401 (Edge Access) e não é a superfície de produção. Não foi possível comparar seus bytes; nada foi
assumido sobre ele.

## 2. Dependências externas

| Página | Dependência externa | Estado |
|---|---|---|
| auth, app | `@supabase/supabase-js@2.116.0` (jsDelivr) | já fixada |
| index, intelligence, ask, sources, documento | eram `@supabase/supabase-js@2` (flutuante; resolvia para 2.118.0 em 2026-10-31) | **fixadas em 2.116.0**, a mesma versão que cria a sessão em `auth.html` |
| todas as sete | tag apontando para `@2.116.0/dist/umd/supabase.js`, o arquivo que existe dentro do tarball npm (já minificado; SHA-256 `84ee9bf4…`; os mesmos bytes que o jsDelivr serve nesse caminho), com `integrity="sha384-iLddHTLo…"` e `crossorigin="anonymous"` | **SRI aplicado**; `pulse-sdk-integrity.spec.js` prova com rede real que o cliente carrega em cada página e fixa o hash esperado |
| app | `pdf.js 3.11.174` (cdnjs), tag estática com SRI (`sha384-/1qUCSGw…`, conferido byte a byte contra `pdfjs-dist@3.11.174/build/pdf.min.js` do npm) | mantida com mitigação (ver abaixo) |
| pulse-config | `pdfjs-dist@4.10.38` (jsDelivr, `import()` dinâmico; não aceita SRI) | usada nas páginas sem a tag estática |
| todas | Google Fonts (Inter, Source Serif 4) | mantida |

Por que `dist/umd/supabase.js` e não `supabase.min.js`: o pacote npm não contém `supabase.min.js`; o jsDelivr o
gera sob demanda, com um cabeçalho que diz literalmente para não usar SRI em arquivos gerados dinamicamente
(em failover o minificador pode mudar os bytes). A primeira versão desta reconciliação cometeu exatamente esse
erro; o alvo do SRI tem de ser um arquivo que exista no pacote publicado.

O SDK do Supabase não foi removido: autenticação (`auth.html`), broker de indústria, consultas privadas e
persistência de investigações dependem dele. Com o SRI, o navegador bloqueia o script se o CDN servir bytes
diferentes dos registrados; `auth.html` agora detecta a ausência do SDK e mostra uma mensagem em vez de falhar
em silêncio, e `app.html` já fazia isso. A correção, nesse caso, é recalcular o hash do arquivo do pacote,
nunca remover o atributo. Recomendado: um login manual no deploy de homologação antes do merge, já que o
teste de navegador não autentica.

pdf.js: a versão 3.11.174 é anterior à correção de CVE-2024-4367 (execução de JavaScript a partir de um PDF
malicioso pela via de fontes com `eval`; corrigida em 4.2.67). Em `app.html` a tag estática define
`window.pdfjsLib`, então `pulse-config.js` usa essa versão para extrair texto de uploads e de PDFs do storage
da indústria, não a 4.10.38. Mitigação aplicada nesta reconciliação: todas as chamadas `getDocument` do
repositório passam `isEvalSupported: false`, que é o contorno indicado no aviso da vulnerabilidade e não
afeta a extração de texto. A atualização da tag para uma versão corrigida (ou a remoção da tag estática,
deixando o import dinâmico 4.10.38 atuar) fica para PR própria, porque muda o caminho de ingestão de PDF e
precisa de teste com login real.

Duplicações eliminadas: `ask.html` carregava `pulse-public-evidence.js` três vezes (head, meio e fim);
ficou uma carga, no head, antes de qualquer consumidor.

Cópias aninhadas em `supabase/functions/pulse-ask-ai/pulse-ask-ai/index.ts` e
`supabase/functions/pulse-rag-eval/pulse-rag-eval/index.ts` são removidas na PR #103.

## 3. Listeners duplicados

`scripts/browser-tests/pulse-listener-integrity.spec.js` instrumenta `addEventListener` antes de qualquer
script da página e conta handlers por elemento. Resultado em `main`:

- Nenhum elemento com mais de um listener de clique em index, ask, app, base e sources. Os dez listeners de
  âncora são dez links distintos (rail e navegação mobile), um handler cada.
- Sugestões de pergunta (`.questionExample[data-question]`) recebem exatamente um handler, e só depois do
  portão de sessão do Ask AI.
- Registro duplicado removido: `ask.html` registrava duas vezes o `keydown` de Enter em `#query`. Na shell
  canônica (`pulse-workspace-v3.js`) esse campo fica oculto e a pergunta é feita pelo campo visível do
  workspace, então o duplicado só seria alcançado se o runtime falhasse; não há impacto para o usuário na
  interface entregue. O teste autenticado (cliente Supabase simulado, sem rede, sem dados) falha contra o
  `ask.html` de `main` e passa com a correção, logo protege contra regressão.

## 4. Integridade textual

`scripts/audit_pulse_text_integrity.py` varre todos os arquivos de texto rastreados (binários detectados por
extensão ou byte nulo são pulados, não reprovados): BOM, caracteres de largura zero, controles bidirecionais,
outros caracteres de formato (Cf) e de controle (Cc). O joiner de largura zero é aceito dentro de sequências
de emoji; NBSP e hífen suave são aceitos em prosa (`.md`, `.txt`) e dentro de literais de string em código, e
rejeitados em sintaxe de tag HTML e em código fora de strings. `--self-test` exercita 11 casos sintéticos
(rejeições e tolerâncias) e roda no CI antes da varredura real. Resultado em `main`: nenhuma anomalia.

## 5. Specs obsoletos

Quatro specs fora do CI (`pulse-attachment`, `pulse-filters`, `pulse-ux`, `pulse-study-intelligence`) testavam
a interface single-file antiga (`#pulse-files`, `#pulse-category-select`, `aside .nav[href="#signals"]`), que não
existe em nenhuma página canônica; falhavam em `main` e foram removidos. `pulse-auth.spec.js` (verificação
pós-deploy contra o Pages) passou a apontar para `input#password`, porque `auth.html` tem três campos de senha
(login, nova senha e confirmação) e o seletor genérico violava o modo estrito do Playwright.

## 6. Verificação contínua e limites

- O workflow `Pulse Published Artifact Identity` roda após cada deployment bem-sucedido do ambiente
  `github-pages` (evento `deployment_status`) e repete o script acima com `--require-release` em até 15
  tentativas de 60 s (cobre o TTL de 10 min do CDN), falhando se algum arquivo diferir do commit deployado. O
  JSON fica como artefato do run; nada é commitado. O GitHub só registra workflows novos a partir de `main`,
  então a primeira execução real acontece no deploy que seguir o merge desta PR; até lá a evidência é a
  execução local do mesmo script registrada em `docs/releases/`.
- Não cobertos: comparação com o artefato Netlify (401); remoção do SDK do Supabase ou do pdf.js;
  atualização do pdf.js para versão com a CVE corrigida (PR própria).
