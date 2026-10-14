# Pulse — Catálogo de fontes institucionais e dados on-line

**Status:** requisitos de cobertura e plano de qualificação; fontes não são consideradas ativas até passar pelo processo de onboarding.  
**Aplicação inicial:** piloto Chocolate no Brasil; arquitetura extensível por categoria, país e cliente.

## 1. Objetivo obrigatório

O Pulse deve combinar duas famílias complementares e explícitas:
1. **Institutos, painéis e fontes institucionais relevantes**, para referências de população, comportamento de compra, consumo, categoria e contexto econômico.
2. **Dados on-line**, para descoberta de mudanças emergentes em conversas públicas, buscas, avaliações, receitas, notícias, varejo e comércio eletrônico.

Nenhuma das famílias substitui a outra. Um sinal exploratório on-line não vira estimativa representativa sem calibração e validação; um indicador de instituto não deve ser extrapolado além de sua população, período, universo e metodologia.

## 2. Portfólio de fontes a avaliar

A lista é um backlog de qualificação, não uma declaração de acesso, licença, contratação ou integração existente.

### A. Institutos, pesquisas e painéis
Avaliar conforme o indicador e a disponibilidade comercial:
- **IBGE** — estatísticas oficiais de população, domicílios, consumo/produção e contexto econômico, conforme a pesquisa aplicável.
- **Kantar** — painéis e estudos de consumo/compra, quando o escopo contratado permitir.
- **NielsenIQ** — painel de varejo, vendas, categoria e comportamento de compra, conforme cobertura e licença.
- **Worldpanel by Numerator / painéis equivalentes** — comportamento de domicílios e compradores, sujeito à disponibilidade, metodologia e licença no mercado.
- **Ipsos** — pesquisas com consumidores e estudos ad hoc, conforme desenho e escopo.
- **Nielsen, Kantar, Ipsos ou outros institutos citados por estudos setoriais** — nunca tratar uma citação secundária como acesso ao dado subjacente.
- **Abicab** — indicadores setoriais e lançamentos de chocolate; contexto de indústria, não substituto de painel representativo de shoppers.
- **ComexStat/MDIC** — comércio exterior; contexto de fluxo comercial, não medição direta de preferência.
- **Fontes públicas oficiais adicionais** — selecionar conforme categoria, geografia e pergunta de pesquisa.

Para cada instituto, confirmar: produto/dataset exato, universo e desenho, amostragem, ponderação, frequência, granularidade, período histórico, erro/limitações publicados, direitos de uso, exportação, armazenamento e possibilidade de citar resultados no Pulse. Não presumir que uma marca institucional signifique que qualquer dado seja representativo.

### B. Dados on-line e digitais
Avaliar por meio permitido e tecnicamente sustentável:
- **Buscas:** Google Trends e alternativas licenciadas; índices relativos, termos e sazonalidade.
- **Redes sociais:** APIs oficiais ou fornecedores licenciados para publicações/comentários públicos permitidos, conforme plataforma e cobertura.
- **Vídeo e comunidades:** comentários públicos e discussões de plataformas com API ou autorização apropriada.
- **Avaliações e receitas:** reviews, comentários, receitas e fóruns públicos, respeitando termos e privacidade.
- **Notícias e comunicados:** RSS/feeds, páginas de fontes primárias e APIs de notícias licenciadas.
- **Varejo/e-commerce:** catálogos públicos permitidos ou APIs/fornecedores autorizados para preço, pack size, promoção, sortimento e disponibilidade.
- **Busca interna/marketplaces:** apenas quando acesso, termos, escopo e retenção forem autorizados.
- **Dados de tendências de consumo/marketing:** fornecedores especializados, desde que a metodologia e os direitos de uso sejam auditáveis.

Não contornar paywalls, autenticação, robots, bloqueios técnicos ou limites de API. Não coletar dados pessoais desnecessários. Registrar restrições de licença e uso.

## 3. Matriz obrigatória fonte × pergunta

Antes de ativar uma fonte, registrar:
- pergunta de negócio e estimando;
- tipo de unidade: pessoa, domicílio, compra/transação, SKU, publicação ou evento;
- população/universo efetivamente coberto;
- método de seleção/recrutamento ou mecanismo de observação;
- geografia, período, granularidade e atualização;
- vieses de cobertura e limitações;
- metodologia de ponderação e incerteza, se houver;
- independência em relação às outras fontes;
- custo, licença, direitos de armazenamento, exibição e derivação;
- método de captura, autenticação, rate limits e plano para falhas;
- status: candidato, validando, aprovado, ativo, suspenso ou rejeitado.

## 4. Contrato de cobertura do Pulse

O catálogo deve manter as duas famílias em paralelo:
- **Institucional/painel:** referências de população e comportamento medido; adequada para estimativas somente no escopo metodológico autorizado.
- **On-line exploratório:** cobertura de conversas, buscas, avaliações, notícias e sinais de oferta; adequado para detectar mudanças nos próprios dados observados.
- **Transacional/comercial:** sell-out ou dados de compra reais, quando licenciados; restritos ao universo e período disponíveis.
- **Contexto setorial/econômico:** indicadores de indústria, produção, preços de insumos e comércio exterior.

Cada categoria/piloto deve mostrar lacunas de cobertura. Se não houver instituto/painel acessível, o Pulse deve marcar a representatividade como não demonstrada e apresentar alternativas: contratação/licença, pesquisa própria com desenho adequado ou limitação explícita do resultado.

## 5. Ordem de trabalho para Chocolate Brasil

1. Auditar conectores, workers, registros, execuções e fontes ativas no tenant; não confundir código existente com coleta operacional.
2. Definir perguntas e indicadores prioritários: ocasiões, formatos, preço/gramatura, compra, premiumização/trade-down e lançamentos.
3. Montar shortlist de institutos/painéis para cada indicador e documentar cobertura, método, custo/licença e periodicidade. Solicitar proposta ou credenciais somente por canal autorizado.
4. Selecionar no mínimo uma fonte institucional/painel adequada ao indicador de comportamento e uma fonte de varejo/sell-out quando a pergunta exigir comportamento de compra.
5. Selecionar fontes on-line de buscas, conversas e notícias com acesso permitido e histórico recuperável.
6. Fazer uma captura de prova e validar proveniência, timestamps, deduplicação, falhas e citação literal.
7. Construir baseline prospectivo; não inventar histórico que a fonte não disponibilize.
8. Comparar sinais on-line com referências institucionais/painéis independentes e registrar falsos positivos.
9. Ativar apenas após revisão estatística, de licença, segurança e produto.

## 6. Critérios de aceite

- Existe um catálogo com responsáveis, status, método, cobertura e licença para cada fonte.
- O sistema demonstra ao menos uma fonte institucional/painel qualificada e uma fonte on-line realmente executada para o piloto; dados de varejo são adicionados quando necessários ao estimando.
- Cada fonte tem prova de captura real, não apenas código ou documentação.
- Cada sinal cita origem e período, declara universo e classe de inferência.
- Nenhum acesso, contrato, credencial ou integração é presumido.
- Fontes que repetem a mesma origem não contam como corroboração independente.
- Dados de instituto não são exibidos fora do universo contratado; dados on-line não são chamados de representativos sem validação.
- A ausência de fonte ou de acesso é uma lacuna visível, não dado sintético.

## 7. Princípio de produto

O Pulse deve tornar visíveis as respostas a três perguntas: **o que observamos on-line, o que os institutos/painéis indicam e em que medida as duas evidências convergem ou divergem?** A divergência também pode ser um sinal relevante e não deve ser apagada por uma média ou narrativa única.
