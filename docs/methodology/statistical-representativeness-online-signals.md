# Pulse — Protocolo de representatividade estatística para sinais on-line

**Status:** proposta metodológica para revisão; não certifica que fontes atuais sejam representativas.  
**Escopo inicial:** piloto Chocolate no Brasil; reutilizável por categoria após validação.  
**Princípio:** descoberta on-line e estimação populacional são produtos distintos e devem permanecer separados até validação.

## 1. Objetivo

Permitir que o Pulse descubra mudanças emergentes em dados on-line e, quando houver desenho e evidência adequados, estime se essas mudanças refletem a população-alvo. Volume de posts, buscas, avaliações ou páginas não constitui, por si só, amostra representativa.

## 2. Contrato da população-alvo

Antes de estimar qualquer indicador, documentar:
- população-alvo e unidade de análise (pessoa, domicílio, ocasião, compra, SKU ou publicação);
- geografia, período de referência, faixa etária e critérios de inclusão/exclusão;
- parâmetro estimado, denominador e decisão de negócio que ele informará;
- fonte de referência, data, cobertura e limitações.

Exemplo a validar: pessoas residentes no Brasil que compraram chocolate para consumo próprio ou presente em um período definido. Não misturar compradores, consumidores, domicílios e usuários de plataformas.

## 3. Classes de evidência e inferência

Cada fonte e cada sinal recebe uma classe explícita:

1. **Observação de plataforma:** descreve somente o conteúdo observado naquela plataforma e janela.
2. **Sinal exploratório on-line:** mudança em buscas, conversas, avaliações ou publicações; não estima automaticamente a população.
3. **Indicador calibrado:** estimativa ajustada a referências observáveis, com método, pressupostos, diagnóstico de viés e validação fora da amostra publicados.
4. **Estimativa baseada em desenho amostral:** inferência apoiada em desenho probabilístico conhecido ou metodologia de painel apropriada, com incerteza compatível com o desenho.
5. **Indicador comercial observado:** preço anunciado, disponibilidade, promoção, transação ou sell-out; especificar qual deles. Não inferir comportamento populacional além do universo medido.

Não converter uma classe em outra apenas aumentando o volume de dados. Uma estimativa de erro amostral convencional não deve ser apresentada para amostras de conveniência como se corrigisse o viés de seleção.

## 4. Hierarquia de fontes

Priorizar, de acordo com a pergunta:
- pesquisas probabilísticas e estatísticas oficiais para benchmarks populacionais;
- painéis de consumidores ou compradores com recrutamento, composição, ponderação e limitações documentados;
- dados de sell-out ou painel de varejo para comportamento de compra no universo coberto;
- dados de varejistas para preço, promoção, sortimento e disponibilidade observados;
- fontes on-line públicas e autorizadas, APIs oficiais e fornecedores licenciados para descoberta de sinais;
- notícias e comunicados primários para eventos e contexto.

Uma fonte de referência deve ser escolhida por adequação ao estimando, não apenas por disponibilidade. Verificar custo, licença, periodicidade, representatividade geográfica e possibilidade de auditoria antes da contratação ou ativação.

## 5. Requisitos de coleta e proveniência

Para cada registro, guardar quando permitido:
- fonte, URL canônica ou identificador de origem;
- timestamp de publicação e captura, fuso horário e janela observada;
- método de acesso e versão do conector;
- hash/fingerprint, regra de deduplicação e relação com republicações;
- universo observado, cobertura, idioma, geografia e limitações conhecidas;
- licença/termos aplicáveis, base de autorização e política de retenção;
- transformação aplicada, versão do código e trilha de auditoria.

Respeitar termos, robots, limites de requisição, privacidade e controles de acesso. Não contornar bloqueios de acesso. Minimizar dados pessoais; preferir métricas agregadas e evitar inferir atributos sensíveis.

## 6. Calibração e ponderação

Quando for apropriado e houver dados auxiliares confiáveis:
- comparar a composição da amostra com benchmarks relevantes (por exemplo, região, idade, gênero ou frequência de compra, se medidos de forma compatível);
- justificar previamente as variáveis de calibração e documentar as ausências de cobertura;
- publicar distribuição dos pesos, peso máximo, tamanho efetivo da amostra e efeito do desenho quando calculável;
- testar sensibilidade a especificações alternativas, pesos extremos e categorias pouco representadas;
- preservar uma amostra ou janela temporal de validação que não participe do ajuste.

Ponderação por margens demográficas não elimina automaticamente diferenças de propensão a postar, usar a plataforma, comentar ou comprar. Se o viés de seleção não for identificável ou validável, manter o resultado como exploratório.

## 7. Incerteza e validação

- Usar intervalos de confiança/credibilidade apenas quando o modelo e o desenho os sustentarem; documentar pressupostos e método.
- Distinguir incerteza amostral, erro de medição, viés de cobertura, erro de classificação e incerteza do modelo.
- Validar estimativas contra uma fonte independente adequada ao mesmo parâmetro e período.
- Fazer validação temporal fora da amostra e, quando possível, validação por região/canal.
- Medir erro, calibração e estabilidade em períodos normais e sazonais; documentar falsos positivos e sinais rejeitados.
- Não declarar acurácia, representatividade ou precisão sem amostra de validação e critérios pré-definidos.

## 8. Contrato mínimo de um sinal no Pulse

Todo sinal publicado deve incluir:
- afirmação observada e tipo de indicador;
- classe de inferência (observação de plataforma, exploratório, calibrado, desenho amostral ou comercial);
- população/universo, geografia e período;
- fonte, data de captura/publicação e citações verificáveis;
- tamanho bruto e efetivo quando aplicáveis, cobertura e método;
- estimativa e incerteza, somente quando justificadas;
- novidade versus baseline, sazonalidade e deduplicação;
- fontes independentes de corroboração e possíveis contradições;
- hipótese de shopper separada do fato;
- limitações, confiança explicada e decisão que os dados podem ou não sustentar.

## 9. Regra de cruzamento entre fontes

Redes sociais, buscas, varejo, painéis e dados macroeconômicos não são intercambiáveis. Um sinal pode ser fortalecido por convergência entre fontes independentes, mas somente se:
- as fontes medirem conceitos compatíveis;
- a independência for real, não republicação de uma mesma origem;
- períodos e populações forem comparáveis;
- a direção da relação tiver hipótese explicável e alternativas consideradas;
- a conclusão não exceder o que cada fonte mede.

Exemplo: crescimento de conversas sobre embalagens menores, acompanhado de redução de gramatura em varejistas, gera hipótese para investigar; não prova, isoladamente, trade-down populacional. Para estimar prevalência, validar com painel/pesquisa ou dado transacional adequado.

## 10. Critérios de liberação

**Pode ser publicado como sinal exploratório** quando a fonte é autorizada, rastreável, deduplicada, datada e a limitação aparece junto da afirmação.

**Pode ser publicado como estimativa calibrada/representativa** somente após revisão metodológica que confirme população-alvo, benchmark adequado, cobertura, pesos, incerteza, validação independente e estabilidade fora da amostra.

**Bloquear ou colocar em quarentena** registros sem proveniência suficiente, placeholders, citações não verificáveis, duplicatas tratadas como independentes, fontes com acesso não autorizado ou inferências de shopper baseadas apenas em indicadores macro.

## 11. Plano para o piloto Chocolate

1. Auditar fontes e workers atuais; confirmar quais conectores realmente executam e quais dados chegam ao tenant do piloto.
2. Definir os estimandos prioritários (por exemplo, mudança na prevalência de uma ocasião de consumo, procura por formato ou comportamento de compra) antes de selecionar a fonte.
3. Selecionar uma referência adequada a cada estimando: painel/pesquisa para comportamento de pessoas; painel de varejo/sell-out para compra; dados de varejistas para preço e disponibilidade; fontes on-line para descoberta.
4. Iniciar baseline prospectivo com timestamps, fingerprints, deduplicação e registro de falhas. Não fabricar histórico ausente.
5. Comparar sinais on-line com referência independente e registrar falsos positivos e discrepâncias.
6. Revisão humana e estatística antes de rotular qualquer resultado como representativo.
7. Só depois avaliar integração à interface e automação periódica.

## 12. Critérios de aceite

- 100% dos sinais publicados têm fonte, período, universo e classe de inferência.
- Nenhuma amostra de conveniência é rotulada como representativa sem validação documentada.
- Estimativas populacionais têm benchmark adequado, método, incerteza e validação fora da amostra.
- Fontes republicadas não contam como corroboração independente.
- Falhas de coleta e ausência de dados são exibidas como lacunas, não como ausência de mudança.
- Fatos, hipóteses e implicações de negócio permanecem separados.
- A revisão não pressupõe parceria com marca nem acesso a dados proprietários sem autorização.

## 13. Decisão metodológica

O Pulse deve ser um sistema de **descoberta ampla e inferência disciplinada**: usar dados on-line para encontrar sinais candidatos e usar desenho amostral, benchmarks e validação para decidir quais conclusões podem ser generalizadas. Quando a representatividade não puder ser demonstrada, o sistema deve dizer isso explicitamente em vez de produzir uma falsa precisão.
