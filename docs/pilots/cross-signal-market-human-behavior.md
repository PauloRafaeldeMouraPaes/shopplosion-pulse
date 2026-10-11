# Pulse — Especificação de cruzamento entre mercado e comportamento humano

## Documentos operacionais relacionados

- [Inventário vivo de fontes e critérios de avaliação](source-inventory-template.md)
- [Auditoria operacional das fontes do piloto Chocolate — 11/10/2026](chocolate-source-audit-2026-10-11.md)
- [Protocolo do piloto Chocolate](chocolate-emerging-shopper-signals.md)

**Status:** especificação de produto e pesquisa; não afirma que todos os conectores descritos já estejam implementados.  
**Aplicação inicial:** piloto Chocolate no Brasil.  
**Princípio:** o valor do Pulse está em relacionar mudanças observáveis no mercado com mudanças agregadas no que as pessoas buscam, dizem, avaliam e fazem — preservando a diferença entre declaração, comportamento observado e resultado comercial.

## 1. Objetivo

O Pulse deve detectar e explicar convergências, divergências e possíveis defasagens entre:

1. **Movimentos de mercado:** preço por unidade comparável (preferencialmente por 100 g), promoções, gramatura, sortimento, disponibilidade, lançamentos, posicionamento, vendas e participação, quando dados autorizados estiverem disponíveis.
2. **Expressões e sinais humanos:** buscas agregadas, conversas públicas, perguntas, avaliações, reclamações, receitas, conteúdo de uso, comparação de alternativas, ocasiões de consumo e linguagem emergente.
3. **Contexto:** sazonalidade, notícias, mudanças econômicas, calendário, região, canal, campanha e fatores externos que possam explicar movimentos sem relação causal direta.

Não basta exibir séries lado a lado. O sistema deve identificar relações candidatas, explicar a evidência que as sustenta, indicar explicações alternativas e recomendar a próxima verificação.

## 2. Unidade central: sinal cruzado

Cada sinal cruzado deve conter:

- **Pergunta/título:** mudança investigada em linguagem clara.
- **Dimensão de mercado:** métrica, unidade, produto/categoria, canal/região, janela temporal, baseline e fonte.
- **Dimensão humana:** tipo de dado (busca, conversa pública, avaliação, reclamação etc.), tema, janela temporal, cobertura e fonte.
- **Relação temporal:** simultânea, comportamento antecede mercado, mercado antecede comportamento ou ordem desconhecida. Não inferir antecedência sem timestamps comparáveis.
- **Evidência observada:** valores ou trechos curtos verificáveis, URLs canônicas, datas de publicação/captura e método de coleta.
- **Interpretação:** explicação possível, separada dos fatos.
- **Explicações alternativas:** sazonalidade, campanha, viralização, mudança de cobertura, notícia, preço, distribuição ou outra variável.
- **Confiança e limitações:** qualidade, atualidade, representatividade, independência e comparabilidade das fontes.
- **Status:** candidato, em validação, corroborado, inconclusivo ou rejeitado.
- **Próximo teste:** qual dado ou observação distinguiria as explicações concorrentes.
- **Implicação de negócio:** decisão ou experimento possível, sem recomendar ação irreversível com base apenas em hipótese.

Um sinal não ganha confiança apenas por reunir muitas URLs. Fontes que republicam a mesma pesquisa ou release contam como uma única origem de evidência.

## 3. Taxonomia para o cruzamento

### Mercado
- Preço normalizado por 100 g, preço anunciado versus preço efetivamente pago quando conhecido.
- Promoção, profundidade promocional e frequência.
- Gramatura, tamanho de porção, embalagem e arquitetura de preço.
- Sortimento, lançamento, retirada e disponibilidade/ruptura.
- Vendas, unidades, volume, penetração, frequência, cesta e participação, apenas quando houver dados autorizados e definição de métrica.
- Canal, região e período.

### Comportamento humano agregado
- Necessidade, ocasião e contexto de consumo.
- Percepção de valor e preço, comparação e procura por alternativas.
- Interesse por sabor, ingrediente, intensidade, formato ou benefício.
- Recomendação, satisfação, reclamação e barreiras de uso.
- Busca, descoberta, receita, presente, compartilhamento e experimentação.
- Vocabulário novo, comunidades/temas emergentes e evolução das perguntas.

### Relações a detectar
- **Convergência:** ambos se movem de forma compatível.
- **Divergência:** oferta/mercado e expressão humana caminham em direções diferentes.
- **Defasagem:** uma dimensão se move antes da outra, com timestamps suficientes para testar a hipótese.
- **Substituição:** cresce o interesse por alternativa ao mesmo tempo que muda preço, disponibilidade ou sortimento do produto original.
- **Desconexão de inovação:** lançamento ou exposição cresce sem evidência equivalente de interesse humano, ou o interesse surge antes de haver ampla oferta.
- **Sinal contraditório:** fontes humanas ou de mercado divergem; manter a divergência visível em vez de forçar uma narrativa única.

## 4. Exemplo de investigação — Chocolate

**Hipótese:** pressão de preço pode estar associada à procura por formatos menores, promoções ou alternativas de marca.

O Pulse deve procurar, em janelas comparáveis:

1. Série de preços por 100 g, gramatura, promoção e disponibilidade para produtos comparáveis.
2. Evolução agregada de buscas e conversas públicas sobre preço, promoção, tamanho, alternativas e ocasiões de consumo.
3. Avaliações e reclamações públicas relevantes, distinguindo comentários espontâneos de conteúdo promocional ou incentivado quando isso for identificável.
4. Contexto sazonal e de mídia para não confundir um pico de Páscoa, uma campanha ou um conteúdo viral com uma mudança duradoura.
5. Dados de compra/sell-out ou painel autorizado, se disponíveis, para verificar se a expressão se associa a comportamento de compra.

**Conclusão permitida sem dados de compra:** “Há sinais públicos compatíveis com maior atenção a preço e formatos menores durante a janela observada; a relação com mudança efetiva de compra ainda não foi confirmada.”

**Conclusão não permitida sem evidência adicional:** “Os consumidores trocaram de marca por causa do preço” ou qualquer afirmação sobre clientes de uma marca específica.

## 5. Ecossistema amplo de fontes e regras de coleta

**O Pulse não deve depender de uma lista fechada de institutos.** Scanntech, NielsenIQ e Kantar são exemplos importantes, não uma lista exclusiva nem um limite de cobertura. O sistema deve manter um inventário vivo de fontes, descobrir novas fontes pertinentes a cada categoria e pergunta, e avaliar cada uma por qualidade, acesso, relevância e independência.

A busca de fontes deve cobrir, conforme a pergunta de pesquisa, as seguintes famílias:

### 5.1 Institutos de pesquisa, painéis e inteligência comercial

Mapear e avaliar provedores nacionais e internacionais de dados de varejo, shopper, consumo, opinião, hábitos, categorias, preços e tendências. Exemplos a investigar conforme a relevância e a disponibilidade incluem:

- Scanntech;
- NielsenIQ (NIQ; incluindo produtos e serviços historicamente associados à GfK, conforme o caso);
- Kantar;
- Circana;
- Ipsos;
- YouGov;
- Euromonitor International;
- Mintel;
- dunnhumby;
- Worldpanel e outros painéis de consumo ou shopper;
- institutos, consultorias e empresas de pesquisa locais, regionais ou especializados.

Esta lista é **ilustrativa e não exaustiva**. O nome de uma empresa não garante que ela ofereça o indicador necessário, que o dado cubra o Brasil ou Chocolate, ou que o Pulse tenha direito de acesso.

### 5.2 Estatísticas oficiais e fontes públicas

Pesquisar séries e publicações de instituições públicas nacionais, estaduais, municipais e internacionais, conforme a pergunta. Exemplos a avaliar:

- IBGE;
- Banco Central do Brasil;
- IPEA;
- FGV IBRE;
- órgãos estaduais e municipais de estatística e pesquisa econômica, como IPEAD/UFMG quando pertinente;
- Procons, Consumidor.gov.br e outras fontes oficiais de reclamações ou proteção do consumidor;
- órgãos e bases públicas de outros países ou organismos multilaterais, quando ajudarem a contextualizar o mercado brasileiro.

Documentar a definição da métrica, universo, período, metodologia e limitações. Um índice geral de inflação, por exemplo, pode contextualizar a pressão de preços, mas não substitui uma série de preço por SKU ou por 100 g.

### 5.3 Associações setoriais e dados especializados da categoria

Avaliar associações, observatórios e organizações técnicas nacionais e internacionais relevantes para a categoria. Para Chocolate e confectionery, exemplos incluem ABICAB, ABRAS, ABAD, ABRE, ICCO e outras entidades pertinentes, conforme o tema e o material disponível. Expandir o mapeamento para fornecedores, ingredientes, embalagem, varejo, distribuição e canais quando isso ajudar a explicar mudanças.

Relatórios setoriais, comunicados e apresentações devem ser identificados como tais; várias páginas que reproduzem o mesmo release ou estudo não constituem confirmação independente.

### 5.4 Academia, especialistas e publicações técnicas

Incluir artigos científicos, teses, repositórios universitários, conferências, centros de pesquisa e publicações técnicas quando trouxerem evidência metodológica ou contexto relevante. Registrar data, amostra, método e se os resultados podem ser generalizados para o Brasil atual.

### 5.5 Varejo, comércio eletrônico e observação de oferta

Avaliar catálogos, páginas de produto, preços anunciados, promoções, gramatura, composição, sortimento e disponibilidade observável em varejistas e marketplaces. Distinguir preço anunciado de preço pago, disponibilidade observada de estoque confirmado e presença no catálogo de vendas realizadas.

Dados transacionais, sell-out, fidelidade, cesta ou desempenho de SKU só podem ser utilizados quando houver acesso autorizado e definições compreendidas.

### 5.6 Busca, comportamento e conversa humana agregada

- Google Trends e outras ferramentas de busca agregada, quando disponíveis;
- APIs oficiais, licenças e mecanismos permitidos de plataformas sociais, vídeo e comunidades;
- fóruns, comentários, avaliações, receitas, perguntas e reclamações públicas acessíveis nos termos aplicáveis;
- pesquisas de opinião e estudos de hábitos, com identificação clara de amostra e método;
- fontes adicionais que sejam pertinentes à pergunta, mesmo que não estejam listadas neste documento.

Distinguir declaração, intenção, busca, expressão pública, comportamento observado e compra efetiva. Nenhuma dessas medidas deve ser tratada como substituta automática das demais.

### 5.7 Descoberta contínua de fontes

Para cada nova pergunta ou sinal relevante, o fluxo de pesquisa deve:
1. identificar quais tipos de evidência poderiam confirmar, contradizer ou contextualizar a hipótese;
2. procurar fontes existentes no inventário e descobrir fontes adicionais reconhecidas ou primárias;
3. registrar a fonte candidata, o indicador exato, a URL ou referência, a data e a justificativa de relevância;
4. avaliar acesso, licença, metodologia, cobertura, histórico, atualização, custo e independência;
5. comparar a nova fonte com as já utilizadas e detectar dependência, duplicação ou republicação;
6. aprovar, rejeitar ou manter como candidata, registrando o motivo;
7. atualizar o inventário sem assumir que toda fonte encontrada deve virar integração automatizada.

O inventário deve ser extensível: não pode exigir alteração de código só para registrar um novo provedor ou uma nova publicação. A automação de captura, por outro lado, exige uma avaliação técnica e jurídica separada.

### 5.8 Registro mínimo por fonte

Para toda fonte candidata ou ativa, registrar:
- nome da organização e do produto, painel, relatório, série ou conjunto de dados específico;
- categoria da fonte e papel na análise (comportamento, mercado, contexto ou validação);
- URL canônica, responsável/editor e data de publicação, quando disponíveis;
- status de acesso (público, autorizado, licenciado, demonstração, indisponível ou a verificar);
- período histórico, frequência de atualização e granularidade temporal;
- cobertura geográfica, canal, categoria, marca, produto, população ou amostra;
- definição da métrica, unidade, metodologia e limitações;
- custo e condições de armazenamento, transformação, exibição e redistribuição;
- origem primária ou derivada e relações com outras fontes;
- data da última verificação, qualidade atribuída e próximo passo.

### 5.9 Provedores prioritários para investigar no piloto Chocolate

Scanntech, NielsenIQ e Kantar continuam explicitamente no mapa prioritário, juntamente com todas as outras famílias e provedores relevantes acima. Para cada um, verificar o produto específico disponível, cobertura de Chocolate no Brasil, indicadores, histórico, granularidade regional e de canal, frequência, custos e permissões. Não presumir que métricas específicas estejam incluídas em qualquer contrato ou produto.

**Regra universal de validação:** nenhuma organização será marcada como integrada, acessível ou usada em uma conclusão até existir evidência verificável do acesso e do conjunto de dados específico. Materiais públicos de um instituto podem ser usados dentro das permissões aplicáveis, mas não substituem nem autorizam inferir dados proprietários que não foram consultados.

Nenhuma fonte deve ser aceita ou rejeitada apenas por sua marca ou reputação. A credibilidade institucional é um fator de avaliação, não substituto de metodologia, pertinência, atualidade, independência e compatibilidade entre métricas. A indisponibilidade de uma fonte não autoriza scraping proibido, contorno de bloqueios ou fabricação de dados.

Cada conector deve registrar cobertura, frequência, região/idioma, limites, data de captura, falhas, método de deduplicação e vieses conhecidos.
## 6. Privacidade e interpretação

- Analisar tendências agregadas; não criar perfis sensíveis de indivíduos nem tentar identificar autores.
- Coletar somente o necessário, respeitar termos de uso, licenças, legislação aplicável e políticas de retenção.
- Não inferir atributos pessoais sensíveis a partir de publicações.
- Distinguir conteúdo espontâneo, publicidade, influenciadores, campanhas e republicações sempre que possível.
- Tratar métricas de menções, buscas e engajamento como indicadores da plataforma e da amostra observada, não como estimativas automáticas da população.
- Mostrar lacunas de cobertura e viés de seleção junto à interpretação.

## 7. Método de detecção e validação

1. Estabelecer baseline com snapshots datados; não inventar histórico que não foi capturado.
2. Normalizar unidades, taxonomia, regiões, canais e janelas temporais.
3. Deduplicar conteúdo e agrupar republicações que derivem da mesma fonte.
4. Detectar mudanças frente ao baseline, considerando volume, aceleração, persistência e sazonalidade.
5. Gerar candidatos de relação entre sinais de mercado e humanos por tema, produto, região e janela.
6. Procurar evidências independentes e explicações alternativas.
7. Rotular o resultado como candidato, em validação, corroborado, inconclusivo ou rejeitado.
8. Registrar decisão de revisão humana, falsos positivos e motivo de rejeição.
9. Traduzir somente sinais suficientemente sustentados em hipóteses de negócio e testes pequenos, mensuráveis e reversíveis.

Correlação temporal é um indício para investigação, não prova de causalidade. A causalidade exige desenho de pesquisa apropriado e dados compatíveis.

## 8. Critérios mínimos de qualidade

- Toda afirmação publicada tem fonte, data, janela, cobertura e limitações.
- Dados de mercado e humanos não são combinados quando unidades, populações ou períodos não são comparáveis.
- A mesma pesquisa replicada em várias páginas não conta como corroborada por múltiplas fontes.
- Picos isolados e conteúdo viral não viram tendências persistentes sem validação temporal.
- Métricas sociais não são rotuladas como vendas, intenção de compra ou comportamento real.
- Cada sinal prioritário informa o que sabemos, o que é hipótese, o que contradiz a hipótese e qual teste vem a seguir.
- A qualidade é medida por revisão documentada de sinais verdadeiros/falsos, não pelo volume de sinais gerados.

## 9. Plano de implementação incremental

### Etapa A — Inventário e contratos
Auditar fontes, workers, tabelas, histórico, campos de proveniência e capacidades já existentes. Evitar criar um segundo pipeline de captura ou um esquema paralelo desnecessário.

### Etapa B — Observações comparáveis
Garantir snapshots com timestamp, hash/fingerprint, URL canônica, deduplicação e classificação por taxonomia para fontes de mercado e humanas.

### Etapa C — Cruzamento
Implementar uma camada que relacione sinais já existentes por categoria/tema, produto, geografia e janela temporal, preservando as duas evidências de origem e a explicação da relação candidata.

### Etapa D — Revisão e painel
Exibir a mudança de mercado, a mudança humana, a relação proposta, as evidências e as limitações juntas. Permitir rejeitar/validar a interpretação sem apagar a trilha de auditoria.

### Etapa E — Avaliação longitudinal
Continuar as revisões semanais durante quatro semanas ou mais. Usar esse período para avaliar persistência e falsos positivos, sem bloquear desenvolvimento técnico paralelo.

## 10. Critério de sucesso do piloto

O piloto será bem-sucedido quando o Pulse conseguir mostrar, para um conjunto pequeno de casos auditáveis, uma cadeia reproduzível:

**mudança observada no mercado + mudança observada em sinais humanos + relação temporal/contextual testável + fontes independentes quando disponíveis + interpretação limitada pela evidência + próximo teste de negócio.**

Não é necessário que todos os candidatos sejam confirmados. Identificar corretamente uma hipótese inconclusiva ou rejeitar um falso positivo também é resultado válido.
