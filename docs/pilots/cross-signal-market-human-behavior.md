# Pulse — Especificação de cruzamento entre mercado e comportamento humano

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

## 5. Fontes e regras de coleta

Priorizar fontes com acesso estável, método reproduzível, datas, cobertura identificável e permissão de uso:

- Google Trends ou ferramenta equivalente para interesse de busca relativo.
- APIs oficiais, feeds, licenças ou mecanismos públicos permitidos para conteúdo social.
- Avaliações públicas de produtos e varejistas, respeitando os termos de acesso.
- Conteúdo editorial, fóruns e comunidades públicas, sem contornar autenticação, bloqueios ou limites técnicos.
- Catálogos públicos de varejistas para preço anunciado, gramatura, promoção e disponibilidade observável.
- Painéis de consumo, sell-out ou dados de varejo mediante autorização/licença.
- **Scanntech:** avaliar disponibilidade de indicadores de varejo e consumo, evolução de vendas e preços, promoções, categorias, canais e recortes regionais, conforme o produto contratado e os direitos de uso.
- **NielsenIQ (Nielsen):** avaliar dados de painel de varejo, desempenho de categorias e marcas, distribuição, participação, preço, promoção e comportamento de compra, conforme cobertura e licença disponíveis.
- **Kantar:** avaliar dados de painéis de consumo domiciliar e/ou shopper, penetração, frequência, ocasiões, volume, gasto e mudanças no comportamento de compra, conforme o estudo ou produto contratado.
- **Outros institutos e fontes de referência:** considerar estudos reconhecidos relevantes para chocolate e confectionery, documentando universo, amostra, período, metodologia e se a evidência é primária ou reproduzida.

### 5.1 Institutos de mercado prioritários: Scanntech, NielsenIQ e Kantar

Esses três provedores passam a integrar explicitamente o **mapa prioritário de fontes para o piloto Chocolate**. Devem ser investigados em paralelo às fontes públicas e comportamentais, não tratados como fontes intercambiáveis: cada provedor, produto e estudo pode medir universos, canais, períodos e variáveis diferentes.

Para cada provedor, registrar:
- produto, relatório, painel ou conjunto de dados específico considerado;
- disponibilidade real para o projeto (acesso público, demonstração, contrato, licença, parceiro ou ausência de acesso);
- granularidade temporal, geográfica, de canal, categoria, marca e formato;
- métricas disponíveis e definições oficiais (por exemplo, valor, unidades, volume, preço, distribuição, penetração ou frequência);
- período histórico e cadência de atualização;
- cobertura e limitações metodológicas;
- custo, condições contratuais, permissões de armazenamento, transformação, exibição e redistribuição;
- responsável pela fonte, data de verificação e próximo passo de acesso.

**Uso esperado no piloto**
- **Scanntech:** investigar como fonte potencial de sinais de varejo e evolução de mercado, sem presumir quais métricas ou níveis de detalhe estão incluídos em qualquer plano.
- **NielsenIQ:** investigar como fonte potencial de mensuração de varejo, categorias e marcas, observando rigorosamente a definição de mercado e a cobertura do painel.
- **Kantar:** investigar como fonte potencial de evidência de consumo e shopper, distinguindo compras domiciliares, ocasiões, declarações e outras medidas conforme o produto utilizado.

**Regra de validação:** nenhuma dessas fontes será marcada como integrada, acessível ou usada em uma conclusão até haver evidência verificável de acesso e de um conjunto de dados específico. A menção do instituto, por si só, não constitui evidência. Se não houver licença ou acesso autorizado, registrar a lacuna e utilizar somente materiais públicos autorizados como contexto, sem simular dados proprietários.

Quando disponíveis, esses dados poderão atuar como evidência independente para confirmar, contradizer ou contextualizar sinais humanos. Antes de cruzar séries, verificar se período, geografia, canal, categoria, população e unidade de medida são compatíveis.

Cada conector deve registrar cobertura, frequência, região/idioma, limites, data de captura, falhas, método de deduplicação e vieses conhecidos. A indisponibilidade de uma API ou de uma fonte não autoriza scraping proibido, contorno de bloqueios ou fabricação de dados.

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
