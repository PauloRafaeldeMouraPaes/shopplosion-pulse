# Auditoria operacional de fontes — Piloto Chocolate

**Data da auditoria:** 11/10/2026  
**Ambiente consultado:** Supabase Production, projeto `ppfuygnpgywfpiqxsfys`  
**Objetivo:** separar o que está configurado e capturando do que ainda falta para testar cruzamento entre comportamento humano e mercado.  
**Importante:** esta auditoria é um snapshot do ambiente e não altera fontes nem workers de produção.

## 1. Resultado executivo

O piloto já possui um pequeno conjunto de fontes públicas setoriais e de contexto. A ingestão está ativa, mas **a composição atual ainda não demonstra o caso central do produto**: não há, no inventário verificado, uma fonte dedicada de comportamento humano em série nem uma série longitudinal de preços/gramaturas/sortimento de varejo.

A existência de uma página de instituto ou de um artigo sobre consumidores não equivale a uma série de comportamento. Da mesma forma, capturar repetidamente a mesma página HTML não cria novas observações temporais.

## 2. Estado verificado no banco

Consulta de leitura às tabelas `intelligence_sources`, `intelligence_source_items` e `intelligence_source_fetch_runs`:

- 9 fontes cadastradas no tenant `Pulse Pilot — Chocolate (public research)`.
- 7 fontes com `active=true`; 2 inativas.
- 26 itens armazenados no total, contando 10 itens em cada um dos dois RSS de descoberta e um item em cada fonte HTML com captura bem-sucedida.
- As páginas HTML ativas de Abicab, Agência Brasil/estudo de intenção, IPEAD/UFMG, Kantar e Procon Joinville têm uma única observação armazenada por URL; recapturas da mesma página atualizam o item por `source_id + external_id`, em vez de criar snapshots históricos separados.
- Os dois RSS da Agência Brasil tiveram execução concluída, mas a captura mais recente observada não passou nenhum item pelo filtro de relevância para chocolate.
- A fonte do IBGE permanece inativa após erro HTTP 403. Não contornar o bloqueio.
- A fonte da Agência Brasil sobre consumo setorial está inativa por decisão anterior de qualidade/linhagem.
- A tabela `intelligence_signals` contém 33 sinais: 13 com status `active` e 20 com status `dismissed`. São registros de sinal, não 33 tendências independentes nem 33 observações de comportamento.

### Fontes cadastradas

| Fonte | Status no banco | O que fornece no estado atual | Limitação para o piloto |
|---|---|---|---|
| Abicab — inovação na Páscoa 2026 | Ativa | Publicação setorial estática | Contexto de indústria/lançamentos; não mede shopper diretamente |
| Agência Brasil — intenção e critérios de compra na Páscoa 2026 | Ativa | Artigo de pesquisa de intenção | Estudo pontual e sazonal; não é série contínua |
| Agência Brasil — RSS Economia (descoberta) | Ativa | Feed de descoberta | Última execução sem itens relevantes para chocolate após filtro |
| Agência Brasil — RSS Últimas Notícias (descoberta) | Ativa | Feed de descoberta | Última execução sem itens relevantes para chocolate após filtro |
| IPEAD/UFMG — preços de Páscoa 2026 | Ativa | Pesquisa pontual de preços | Recorte regional e sazonal; não é série contínua de SKU |
| Kantar Worldpanel — consumo/gramatura 2025 | Ativa | Publicação estática baseada em estudo | Evidência secundária/pontual; não é acesso ao painel proprietário |
| Procon Joinville — preços de chocolate na Páscoa 2026 | Ativa | Comparação de preços entre lojas | Dispersão transversal de preços, não evolução temporal por si só |
| Agência Brasil — consumo setorial | Inativa | Artigo histórico | Não reativar sem resolver a questão de dependência de fonte/linhagem |
| IBGE — página de safra de cacau | Inativa | Nenhum item capturado | HTTP 403; manter inativa, sem contorno de bloqueio |

## 3. Gap crítico

O aceite da fase 2 da issue #67 exige:
1. uma fonte de comportamento humano executada com sucesso;
2. uma fonte de varejo com preço por 100 g, gramatura, promoção e disponibilidade ao longo do tempo;
3. baseline de quatro semanas com timestamps e deduplicação;
4. separação explícita entre sinais de indústria/oferta e comportamento do shopper.

No snapshot auditado, os itens 1 e 2 **ainda não estão demonstrados**. A cobertura atual deve ser descrita como baseline setorial/contextual, não como detecção validada de mudança de shopper.

## 4. Fontes candidatas para o próximo ciclo

Os itens abaixo são candidatos para avaliação, não integrações concluídas. Antes de ativar qualquer captura automatizada, verificar termos, método de acesso, direitos, granularidade, estabilidade e possibilidade de reproduzir as observações.

### A. Comportamento humano: Google Trends

- Referência: https://trends.google.com.br/trends/?geo=BR
- Exportação e atribuição: https://support.google.com/trends/answer/4365538?hl=pt-BR
- Papel: interesse relativo por termos/temas (por exemplo, chocolate, barra de chocolate, chocolate proteico, chocolate sem açúcar, preço de chocolate, receitas e ocasiões), com recortes geográficos quando disponíveis.
- Primeiro experimento recomendado: definir uma lista versionada de termos, registrar Brasil e regiões relevantes, exportar CSV em datas fixas e manter cada captura como observação datada. Registrar que o índice é relativo/normalizado e não representa volume absoluto de compras.
- Limite técnico: a página de ajuda documenta exportação CSV, mas isso não significa que exista uma API pública estável para automação. O worker atual não lista CSV entre seus tipos de origem. Começar com captura manual controlada ou implementar um adaptador somente após confirmar acesso e desenho técnico.

### B. Mercado/preços: pesquisas públicas de Procon e órgãos municipais

- Exemplo de benchmark granular: pesquisa de preços de chocolate da Páscoa 2026, Prefeitura de Timbó/SC: https://www.timbo.sc.gov.br/wp-content/uploads/2026/03/Pesquisa-semanal-de-Precos-2026-Pascoa-ovos-barras-e-caixas-16-03-1.pdf
- O documento mostra produtos e gramaturas, preços por varejista e variações na coleta publicada; é útil para validar o modelo de normalização por 100 g e comparabilidade entre lojas.
- Limite: é um recorte de Páscoa de 2026, não prova uma série nacional contínua. Pesquisar outras coletas datadas do mesmo órgão e de Procons de outras regiões; não misturar períodos, lojas ou produtos sem registrar diferenças.
- Para o baseline atual, escolher um painel pequeno de produtos comparáveis e capturar preços anunciados de páginas públicas de varejo com frequência definida, apenas se os termos permitirem. Guardar timestamp, URL, região/CEP de entrega quando aplicável, marca/SKU, gramatura, preço cheio, preço promocional, unidade normalizada, disponibilidade e condições de promoção. A captura precisa distinguir preço exibido de preço efetivamente pago.

### C. Provedor de dados de encartes: Instituto DS de Pesquisas (IDSP)

- Referência pública: https://institutodspesquisas.com/
- O site descreve coleta diária de encartes de 2.000+ redes, cobertura declarada de 26 UFs e série histórica desde janeiro de 2024. O índice de preços destacado na página é uma cesta de 27 itens; a página não confirma que chocolate esteja incluído nessa cesta.
- Ação: verificar se o provedor tem dados de chocolate por SKU/gramatura, preço anunciado, rede, praça, promoção e histórico; obter metodologia detalhada e condições comerciais/de uso. Manter como **candidata em verificação**, sem tratar a descrição pública como prova de cobertura de chocolate ou acesso aos registros.
- Este candidato pode complementar Scanntech, NielsenIQ, Kantar e outros provedores; não substitui o mapeamento amplo nem deve ser considerado validado antes de contato/checagem.

### D. Painéis e institutos

Manter Scanntech, NielsenIQ, Kantar/Worldpanel, Circana, Ipsos, YouGov, Euromonitor, Mintel, GlobalData, dunnhumby e outros fornecedores pertinentes no inventário. Para cada um, a próxima tarefa é identificar o produto de dados específico, acesso real, cobertura de chocolate no Brasil, período, granularidade, custo e direitos. Não assumir acesso a dados proprietários por haver uma publicação aberta.

## 5. Desenho de baseline inicial

### Comportamento
- Definir 10–20 termos de busca por hipóteses e registrar a lista, região e data.
- Capturar semanalmente interesse relativo e consultas relacionadas, guardando cada exportação separadamente.
- Separar termos genéricos, preço/valor, formatos/gramaturas, ingredientes/sabores e ocasiões.
- Não interpretar crescimento de busca como compra, preferência populacional ou intenção de compra.

### Varejo
- Começar com um conjunto manejável de barras e caixas de chocolate com SKU/gramatura identificáveis em mais de uma rede.
- Capturar preços e atributos com timestamps em pelo menos uma cadência semanal, se autorizado.
- Calcular preço por 100 g apenas quando peso e preço forem identificáveis.
- Registrar ruptura/indisponibilidade separadamente de ausência de página ou falha de captura.
- Evitar misturar ovos de Páscoa com barras de consumo cotidiano sem taxonomia e análise sazonal próprias.

### Cruzamento
- Comparar janelas e regiões compatíveis.
- Marcar convergência, divergência ou relação desconhecida; não inferir causalidade.
- Preservar fonte primária, timestamp de publicação e captura, método e limitações.
- Fazer revisão semanal de sinais aceitos, rejeitados e falsos positivos.
- Manter quatro semanas de observações antes de avaliar persistência; desenvolvimento técnico pode continuar em paralelo.

## 6. Critérios mensuráveis de avanço

A fase de baseline só será considerada operacional quando:

- [ ] houver pelo menos uma fonte de comportamento com capturas datadas repetíveis;
- [ ] houver pelo menos uma fonte de varejo com preço, gramatura e promoção/condição observáveis e capturas repetidas;
- [ ] cada observação possuir URL/referência, timestamp, método, região/cobertura e unidade;
- [ ] houver snapshots independentes, sem sobrescrever a única observação anterior;
- [ ] deduplicação e linhagem de evidência estiverem verificadas;
- [ ] o conjunto tiver observações em quatro semanas distintas;
- [ ] sinais de fonte única forem rotulados como preliminares;
- [ ] a revisão documentar falsos positivos, sazonalidade e evidência contraditória;
- [ ] nenhum indicador de busca/conversa for descrito como venda ou compra observada.

## 7. Próximas ações técnicas

1. Resolver a lacuna de snapshot histórico: a ingestão HTML atual faz upsert por URL/ID e não preserva cada estado temporal. Antes de expandir fontes, definir como persistir observações imutáveis/versionadas sem quebrar o worker.
2. Escolher entre uma captura CSV manual controlada do Google Trends e um adaptador de ingestão permitido; não automatizar scraping frágil por padrão.
3. Avaliar uma fonte de preço de varejo repetível, primeiro por termos e qualidade de acesso, depois por teste de captura.
4. Adicionar campos/metadados de tipo de evidência e cobertura à camada de análise apenas após auditar o esquema existente; evitar uma migração redundante.
5. Atualizar a issue #67 com evidências de cada critério, e só marcá-la concluída após os testes reais.

## Referências externas consultadas

- Google Trends — exportar, incorporar e citar dados: https://support.google.com/trends/answer/4365538?hl=pt-BR
- Google Trends Brasil: https://trends.google.com.br/trends/?geo=BR
- Prefeitura de Timbó — pesquisa de preços de Páscoa 2026: https://www.timbo.sc.gov.br/wp-content/uploads/2026/03/Pesquisa-semanal-de-Precos-2026-Pascoa-ovos-barras-e-caixas-16-03-1.pdf
- Instituto DS de Pesquisas — metodologia e indicadores públicos: https://institutodspesquisas.com/
