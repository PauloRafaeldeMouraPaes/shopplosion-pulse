# Pulse Design System

> Fonte da verdade: `design/tokens.json`. `pulse-tokens.css` é gerado por `scripts/build_design_tokens.py`; nunca edite o CSS gerado à mão. Use `docs/DESIGN_SYSTEM_SYNC.md` para a sincronização. Se este documento divergir de `design/tokens.json`, os tokens prevalecem.

## Tema e atmosfera

O Pulse é uma interface de inteligência de mercado focada em evidência, legibilidade e decisão. A atmosfera é editorial, precisa, sóbria e clara. Hierarquia deve vir de tipografia, alinhamento, espaço, contraste e qualidade da evidência, não de decoração. A interface existente é HTML/CSS/JS sem framework: acabamento visual preserva rotas, IDs, âncoras, conteúdo funcional e fluxos já existentes.

## Paleta e papel das cores

| Token | Valor inicial | Uso |
|---|---|---|
| `surface-canvas` | `#ffffff` | Fundo de documentos, respostas e análise |
| `surface-app` | `#f7f6f4` | Fundo das listas e inspetor |
| `surface-sunken` | `#f2f0ec` | Campos, chips e superfícies neutras |
| `surface-rail` | `#14141a` | Rail de contexto e modo apresentação |
| `ink-1` | `#16151a` | Títulos, números e ação secundária sólida |
| `ink-2` | `#4a4852` | Corpo de apoio e texto de interface |
| `ink-3` | `#6e6b76` | Rótulos e metadados; nunca abaixo de 11 px |
| `brand-pulse` | `#e51b67` | Ação, seleção e citação; decorativo somente sem texto |
| `brand-pulse-strong` | `#d3185f` | Texto magenta e botão preenchido com texto branco após inclusão no tokens.json |
| `brand-soft` | `#fdebf1` | Fundo de trechos citados e destaque sutil |
| `on-brand` | `#ffffff` | Texto/ícones de botão de marca. A cor de botão preenchido passa a `brand-pulse-strong` |
| `on-rail` | `#ffffff` | Texto e ícones primários no rail |
| `on-rail-muted` | `#b9b7c0` | Navegação inativa no rail |
| `state-processing` | `#0e8e96` | Coleta ou indexação em andamento |
| `state-ok` | `#2f7d57` | Estado disponível ou confirmado |
| `state-attention` | `#b8862b` | Evidência parcial ou conflito |
| `state-error` | `#c0362c` | Falha, sempre com causa e ação de recuperação |
| `line-1` | `#e5e1db` | Bordas e divisórias, sem duplicar os dois no mesmo agrupamento |

Não atribua significado semântico apenas pela cor. Combine cor e rótulo textual. Magenta é reservado à ação, seleção e citação. Rótulos em caixa alta são `ink-3`; números e métricas são `ink-1`. Para texto visível, contraste mínimo WCAG AA: 4,5:1 para texto normal e 3:1 para texto grande (24 px regular ou 18,66 px negrito). Verifique o par real de primeiro plano/fundo, inclusive hover, disabled e superfícies brand-soft.

## Tipografia

| Classe | Família | Tamanho/linha | Uso |
|---|---|---|---|
| `.display` | Inter | 32/34 px, peso 800 | Título principal |
| `.title` | Inter | 24/28 px, peso 750 | Título de seção dentro de objeto |
| `.section` | Inter | 18/24 px, peso 700 | Título de painel/cartão |
| `.reading` | Source Serif 4 | 16/26 px, peso 400 | Só respostas do Ask AI, corpo de análise e leitura longa |
| `.interface` | Inter | 14/20 px, peso 400 | Interface, campos, botões, linhas de lista |
| `.label` | mono do tokens.json | 11/14 px, peso 600, tracking 0,1em | Metadados, período, escopo, timestamp, breadcrumb e selo |

Títulos são sempre Inter. Source Serif 4 não deve aparecer em título, botão, navegação ou metadado. Texto visível abaixo de 11 px não é permitido. Campos de formulário no mobile devem usar fonte de pelo menos 16 px para impedir zoom automático do Safari; isso não reduz o piso geral de 11 px. Para comparações numéricas, use `font-variant-numeric: tabular-nums`.

## Layout e espaçamento

Usar a grade de 4 px e os tokens:
- `space-4`: 4 px, ajuste fino.
- `space-8`: 8 px, ícone e rótulo, gaps pequenos.
- `space-12`: 12 px, controles e chips.
- `space-16`: 16 px, cartão e gap de grid.
- `space-24`: 24 px, painel e separação de blocos.
- `space-32`: 32 px, margem de seção e canvas amplo.
- `space-48`: 48 px, respiro de topo.
- `space-64`: 64 px, margem inferior e rail recolhido.

O rail padrão é 240 px e o inspetor 360 px. Os breakpoints definidos são 640 px para a transição de mobile e 1024 px para a composição desktop. Reutilize flex, grid, fluxo natural e wrapping; evite posicionamentos absolutos para texto variável. Preserve a hierarquia e densidade atuais. Não introduza páginas, rotas ou navegação novas nesta rodada.

## Raios, bordas e profundidade

Raios permitidos: 6 px (`radius-control`), 10 px (`radius-card`), 14 px (`radius-panel`) e 999 px (`radius-chip`). Não invente valores intermediários. Cartões de listas usam borda `line-1`, não sombra. Use `shadow-panel` para painéis/dropdowns/inspetor e `shadow-overlay` apenas para overlays e menu de comando. Uma borda ou divisória por agrupamento. Raios aninhados devem ser concêntricos e o raio da superfície interna não ultrapassa o da externa.

## Componentes e estados

- **Botões**: interface 14 px, alvo de toque mobile pelo menos 44 × 44 px. Um botão primário por bloco. Primário com fundo `brand-pulse-strong` e texto `on-brand`; secundário nunca é visualmente maior que o primário. Não usar seta em botão. Link externo conserva `↗`.
- **Campos**: sempre rótulo acessível ligado ao campo, placeholder não substitui label, estados default/focus/erro/disabled distinguíveis. No mobile, input de texto 16 px ou maior.
- **Chips, selos e badges**: raio 999 px; sem texto menor que 11 px. Selo de confiança, alcance, período, escopo e breadcrumb usa `.label`, com cor `ink-3` salvo o que comunica ação/seleção.
- **Cartões e listas**: um único contorno visual por agrupamento. Categoria dentro do cartão pode permanecer como metadado em `ink-3`.
- **Foco**: toda ação por teclado tem foco visível e não encoberto, preferencialmente `:focus-visible`; controles relacionados também usam `:focus-within`.
- **Estados**: loading, erro, vazio, parcial, disabled e sucesso têm indicação explícita; estado não depende apenas da cor. Mensagem de erro deve explicar a causa quando conhecida e indicar como recuperar.
- **Links e ícones**: navegação é link semântico; botões são ações. Ícone sozinho tem nome acessível; decoração recebe `aria-hidden="true"`.

## Hierarquia, linguagem e evidência

- No máximo um rótulo acima do título principal por tela. Evite repetir a mesma intenção no breadcrumb e no eyebrow.
- Rótulos em caixa alta são `ink-3` e usam a classe `.label`. Numeração só onde é referência funcional (navegação lateral, hipóteses), não em cabeçalhos de seção.
- Metadados devem ser campos nomeados como **Fonte**, **Período** e **Alcance**, não uma sequência de valores divididos por ponto médio.
- Uma única ação primária por bloco. A ação que abre investigação se chama **Investigar**. Sem setas em botões.
- Números são `ink-1`, nunca magenta. Evidência indireta ou de contexto nunca domina numericamente um cartão nem é apresentada como prova direta.
- No piloto, apresentar o que a fonte verifica e o alcance que tem para a pergunta. Não inferir um escore de confiança ausente da base.
- Trocar a expressão genérica “Atualizado a partir da base disponível” por “Atualizado em” seguido da data real da base.
- Texto de interface em português claro, com grafia revisada, sem travessão U+2014 ou meia-risca U+2013. Em intervalos usar hífen. Preferir aspas tipográficas e o caractere de reticências `…`.
- Corrigir “COMEÇE” para “COMECE”. Deduplicar categorias repetidas em rodapés/resumos. Não inventar copy de proposta de valor.

## Responsivo e movimento

Validar pelo menos 1440 px e 390 px de viewport. Em mobile, evitar overflow horizontal, manter as ações com alvo de 44 px, preservar zoom do browser e respeitar áreas seguras com `env(safe-area-inset-*)` quando aplicável. Testar navegação por teclado e fluxos sem ponteiro. Toda animação respeita `prefers-reduced-motion: reduce`; transições listam somente propriedades necessárias e não usam `transition: all`.

Usar `<meta name="theme-color">` coerente com o fundo e declarar `color-scheme: light` no documento claro. Imagens informativas têm texto alternativo; imagens decorativas têm texto alternativo vazio ou ficam ocultas de tecnologias assistivas. Formulários têm `label`, `autocomplete` pertinente e tipos de input adequados.

## Pode e não pode

**Pode**
- Corrigir contraste, escala tipográfica, espaçamento, alinhamento, nomes de metadados e estados visuais.
- Centralizar cores, raios, tipografia, sombras e espaço nos tokens existentes.
- Melhorar foco, rótulos acessíveis, autocomplete, responsividade e redução de movimento.
- Deduplicar repetição visual/textual sem alterar o significado.

**Não pode**
- Criar tela, rota, fluxo ou navegação novos.
- Mudar IDs, âncoras, contratos, dados ou a proposta de valor.
- Adicionar framework, biblioteca, fonte ou conjunto de ícones.
- Usar magenta para decoração ou dar mais destaque numérico à evidência indireta.
- Editar `pulse-tokens.css` manualmente ou desconsiderar `design/tokens.json`.
- Alterar backend, CI/CD, RAG, RLS, schema ou Edge Functions, exceto espelhos de evidência pública explicitamente pedidos.
- Adicionar modo escuro, imagens geradas ou dependências de React/Next/Tailwind/Motion/GSAP.

## Guia de prompt para agentes

“Antes de editar, leia `DESIGN.md`, `design/tokens.json` e `docs/DESIGN_SYSTEM_SYNC.md`. Preserve HTML, rotas, IDs, âncoras, dados e fluxo existentes. Use os tokens do Pulse; se houver divergência, `design/tokens.json` vence. Nenhum texto visível abaixo de 11 px; valide contraste WCAG AA em todos os estados e fundos. Um rótulo acima do título no máximo, labels em `ink-3`, títulos Inter, Source Serif 4 só em leitura. Magenta apenas para ação/seleção/citação; números em `ink-1`. Um primário por bloco, botões 14 px, sem setas em botões. Revise português e elimine U+2014/U+2013 da interface. Não introduza telas, rotas ou dependências. Rode os testes visuais e existentes; reporte arquivo:linha e separe corrigido de pendente. Não alegue validação que não executou.”

## Histórico da rodada de acabamento

Esta rodada usa os itens 3 a 6 do pedido de acabamento como regras permanentes: legibilidade AA, hierarquia de cor, copy revisada, e peso visual proporcional à evidência. O arquivo de tokens é a autoridade técnica; este documento converte essa autoridade em orientações de uso.
