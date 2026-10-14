# Pulse — Blueprint de inteligência integrada para a indústria

**Status:** especificação de produto e método para revisão. Não afirma que fontes, contratos ou conectores estejam ativos.  
**Piloto inicial:** Chocolate no Brasil.  
**Objetivo:** transformar sell-out, pesquisa de shopper, pesquisa de mercado, sinais on-line e contexto competitivo em análises robustas, rastreáveis e úteis à decisão industrial.

## 1. A pergunta industrial vem antes da fonte

Cada análise começa com uma decisão real a apoiar:
- crescimento, penetração, frequência, volume e valor;
- participação, distribuição, disponibilidade e execução no canal;
- arquitetura de preço, elasticidade, promoções, pack-price e gramatura;
- segmentação, ocasiões, necessidades e jornadas de shopper;
- inovação, lançamentos, atributos, claims e gestão de portfólio;
- marca, consideração, preferência, imagem e concorrência;
- previsão de demanda, sazonalidade, riscos e oportunidades;
- priorização de canais, regiões, públicos e experimentos comerciais.

Registrar para cada pergunta: decisão, categoria/marca/SKU, população ou universo, geografia, canal, horizonte temporal, métrica de sucesso e responsável pela validação. Não produzir um índice genérico de “tendência” sem uma decisão associada.

## 2. Pilares de evidência

### A. Sell-out e dados transacionais
**O que podem responder:** o que foi vendido, onde, quando, a que preço observado/pago (conforme campo disponível), volume, valor, promoção, distribuição, disponibilidade e composição do mix.

**Fontes candidatas:** painéis de varejo e dados licenciados de institutos como NielsenIQ, Kantar/Worldpanel ou equivalentes; dados transacionais fornecidos pelo varejista ou fabricante; e-commerce e dados de execução no ponto de venda quando autorizados.

**Campos desejáveis:** período, região, canal, varejista, loja quando autorizado, SKU/EAN, unidade/gramatura, unidades, valor, preço unitário, promoção, distribuição ponderada/numérica, estoque/disponibilidade e metodologia de cobertura.

**Guardrails:** separar sell-out real, sell-in, preço de tabela, preço anunciado e estimativas modeladas. Documentar cobertura de lojas/canais, rupturas, revisões e mudanças metodológicas. Nunca inferir venda de um preço visto em página pública. Restringir dados comerciais confidenciais por tenant e licença.

### B. Pesquisa de shopper e consumidor
**O que pode responder:** quem compra/consome, ocasiões, necessidades, missão, critérios de escolha, barreiras, substituição, frequência, cesta, sensibilidade declarada, jornada e resposta a propostas de produto.

**Fontes candidatas:** painéis de domicílios/compradores, estudos ad hoc, pesquisas quantitativas com desenho amostral documentado, pesquisas qualitativas e diários/estudos de ocasião, quando licenciados ou contratados.

**Metadados obrigatórios:** população-alvo, método de recrutamento/amostragem, questionário, datas de campo, base bruta/efetiva, ponderação, taxa de resposta quando disponível, quotas, margem/intervalos conforme desenho, limites e direitos de uso.

**Guardrails:** intenção declarada não é compra observada. Pesquisa qualitativa gera compreensão, não estimativa de prevalência. Não tratar painel não probabilístico como representativo sem método e validação explícitos.

### C. Pesquisa de mercado e categoria
**O que pode responder:** tamanho e evolução de categoria, participação, penetração, segmentos, preço, distribuição, tendências estruturais e concorrência.

**Fontes candidatas:** institutos de pesquisa, painéis de varejo/consumo, estatísticas oficiais, estudos setoriais e dados licenciados.

**Guardrails:** verificar definição da categoria, canais cobertos, períodos comparáveis, moeda/inflação, unidade de medida, estimativas versus observações e metodologia entre fornecedores. Participação e tamanho de mercado devem incluir universo e data.

### D. Sinais on-line e cultura
**O que podem responder:** novos temas, linguagem, interesses, receitas, ocasiões emergentes, perguntas, reclamações, atributos discutidos, avaliações e sinais precoces de mudança.

**Fontes candidatas:** buscas (ex.: Google Trends), APIs oficiais e fornecedores licenciados de redes sociais, comentários públicos permitidos, comunidades, reviews, receitas, notícias, lançamentos e catálogos de varejo/e-commerce.

**Guardrails:** esses dados representam apenas a cobertura observada até calibração e validação. Não confundir volume de posts com pessoas únicas, sentimento automático com preferência, engajamento com compra ou preço anunciado com transação. Deduplicar republicações e detectar bots/spam quando tecnicamente possível e legal.

### E. Contexto macro, setorial e competitivo
Indicadores de inflação, renda, população, custos de insumos, comércio exterior, regulação, capacidade produtiva e lançamentos explicam contexto e restrições; não são prova direta de mudança do shopper.

## 3. Camada de integração: não fazer média de fontes incompatíveis

O modelo analítico deve manter observações separadas e conectá-las por hipóteses explícitas. As entidades comuns podem incluir categoria, marca, SKU/EAN, atributo, ocasião, canal, região, segmento e período, respeitando granularidade e direitos de uso.

Cada relação entre duas fontes registra:
- hipótese e mecanismo possível;
- compatibilidade de conceitos, unidades, geografia e período;
- independência real das fontes e origem comum;
- direção/defasagem temporal esperada;
- variáveis de confusão e explicações alternativas;
- método de teste e evidência contrária;
- nível de suporte e limites da conclusão.

Exemplo: maior conversa sobre embalagens menores + redução observada de gramatura + alteração em unidades/valor no sell-out pode sugerir uma hipótese de ajuste de desembolso. Não prova trade-down sem verificar preço por unidade comparável, inflação, mix, promoção, disponibilidade, composição de compradores e explicações alternativas.

## 4. Motor analítico

1. **Ingestão e qualidade:** autorização, esquema, timestamps, cobertura, proveniência, validação de campos, deduplicação e observabilidade de falhas.
2. **Harmonização:** taxonomias, SKU/EAN, marcas, categorias, unidades, moeda, calendário comercial, regiões e canais.
3. **Baseline:** histórico real com janela e lacunas explícitas; nunca fabricar série ausente.
4. **Detecção:** variação, aceleração, ruptura, novidade, persistência, sazonalidade, anomalia e divergência entre fontes.
5. **Inferência:** desenho amostral, ponderação, incerteza e validação quando o objetivo é estimar população; modelos preditivos com validação temporal quando o objetivo é prever.
6. **Triangulação:** confirmar ou contradizer sinais com fontes independentes, mantendo a trilha da evidência.
7. **Revisão especializada:** revisão humana e estatística de sinais materiais, fontes, hipótese e recomendação.
8. **Decisão e teste:** recomendação com público/canal, indicador, experimento, risco, custo de não agir e condição de revisão.
9. **Monitoramento:** acompanhar se o sinal persistiu, se a hipótese foi apoiada ou rejeitada e registrar aprendizado.

Não criar um score único opaco. Se houver score composto, expor componentes, pesos, calibração, cobertura e sensibilidade; publicar também as medidas primárias.

## 5. Produto de análise industrial

Cada relatório/sinal deve conter:
- **Decisão em foco:** qual decisão industrial está em jogo.
- **O que mudou:** métrica, tamanho da variação, janela e baseline.
- **Onde e para quem:** categoria, canal, região, segmento e limites da cobertura.
- **Evidências por pilar:** sell-out, shopper, mercado, on-line e contexto, indicando ausências.
- **Triangulação:** convergências, divergências, defasagens e possíveis causas.
- **Fato versus interpretação:** observações, hipóteses e inferências claramente separadas.
- **Qualidade estatística:** universo, desenho, tamanho efetivo, incerteza e limitações, quando aplicáveis.
- **Implicação de negócio:** oportunidade/risco e racional explícito.
- **Ação recomendada:** teste reversível, responsável, KPI, prazo e regra de decisão.
- **Fontes e auditoria:** links/IDs, datas, citação, versão de método e histórico de revisão.

Quando faltar um pilar, apresentar a lacuna e o impacto sobre a conclusão; não preencher com texto sintético nem simular evidência.

## 6. Scorecard de qualidade

Avaliar separadamente:
- validade e proveniência da fonte;
- cobertura e representatividade;
- atualidade e estabilidade temporal;
- independência/corroborabilidade;
- comparabilidade entre universos e métricas;
- magnitude e persistência da mudança;
- robustez a especificações alternativas;
- validação fora da amostra;
- relevância para uma decisão industrial.

A confiança não é a probabilidade de a hipótese ser verdadeira, a menos que exista modelo calibrado que sustente essa interpretação. Não somar fontes correlacionadas como se fossem evidências independentes.

## 7. Plano de implementação para Chocolate Brasil

### Etapa 1 — Definir perguntas e dados necessários
Escolher de 3 a 5 decisões prioritárias, métricas, universo, janela, categoria/canais e limites de confidencialidade.

### Etapa 2 — Inventário e qualificação de fontes
Auditar workers e capturas existentes; criar catálogo de instituto/painel, sell-out, pesquisa de shopper, pesquisa de mercado, dados on-line e contexto. Para cada fonte, verificar método, cobertura, custo/licença, frequência, histórico e exportação.

### Etapa 3 — Viabilidade e acessos
Distinguir fontes públicas, APIs gratuitas, fornecedores licenciados e dados que exigem contratação ou autorização do varejista/fabricante. Registrar dependências e não afirmar que acesso está disponível antes de comprová-lo.

### Etapa 4 — Prova de captura e harmonização
Executar amostra permitida de cada fonte disponível; validar dados, citações, timestamps, cobertura, deduplicação e erros. Construir mapeamentos de categoria/SKU/unidades.

### Etapa 5 — Baseline e validação
Construir baseline prospectivo ou importar histórico licenciado com origem conhecida. Definir testes, comparadores, janelas e métricas antes de olhar os resultados. Validar fora da amostra e registrar falsos positivos.

### Etapa 6 — Primeiro estudo integrado
Produzir um relatório com evidência disponível de cada pilar, incluindo divergências e lacunas. Se sell-out ou painel não estiver disponível, restringir explicitamente as conclusões em vez de substituir por proxies sem validação.

### Etapa 7 — Revisão e decisão de produto
Revisão por especialistas de categoria, pesquisa e estatística; só então ativar visualização/alertas e frequência operacional.

## 8. Critérios de aceite

- Cada análise parte de uma decisão industrial e de métricas predefinidas.
- Catálogo distingue candidato, acesso confirmado, captura testada, ativo, suspenso e rejeitado.
- Sell-out, sell-in, preço anunciado, preço transacionado e estimativas permanecem separados.
- Pesquisa de shopper explicita universo, método e incerteza; pesquisa qualitativa não é usada para estimar prevalência.
- Dados on-line são exploratórios até validação adequada.
- Fontes e universos incompatíveis não são agregados sem método justificado.
- Sinais importantes apresentam triangulação, contradições, limitações e ação mensurável.
- Dados proprietários ficam sob autorização, licença, isolamento por tenant e controles de acesso apropriados.
- Ausência de dados é declarada como lacuna.
- Nenhum resultado, contrato, série histórica ou validação é fabricado.

## 9. Princípio de saída

O Pulse deve funcionar como sistema de inteligência para decisão industrial: **medir o mercado, entender o shopper, observar o que emerge on-line, cruzar as evidências e recomendar como agir**. A robustez vem da qualidade, independência e compatibilidade das evidências — não da quantidade de fontes nem da eloquência da síntese.
