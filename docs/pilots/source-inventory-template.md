# Pulse — Inventário vivo de fontes

**Aplicação inicial:** piloto Chocolate — Brasil  
**Status deste documento:** estrutura operacional inicial; não é evidência de que as fontes listadas estejam integradas ou licenciadas.

## Objetivo

Manter um inventário extensível das fontes que o Pulse pode consultar para responder a perguntas de inteligência. A lista nunca deve ser considerada fechada: novas fontes são pesquisadas quando uma hipótese exige evidência que ainda não existe no inventário.

## Regras

1. Registrar a fonte específica (produto, relatório, painel, série ou conjunto de dados), não apenas a marca do provedor.
2. Distinguir **descoberta**, **acesso verificado**, **uso em teste**, **integração operacional** e **uso numa conclusão**.
3. Nunca inferir acesso a dados pagos/proprietários a partir da existência pública de um fornecedor.
4. Não contar republicações do mesmo estudo como confirmações independentes.
5. Documentar metodologia, período, cobertura, granularidade, custo e direitos de uso antes da integração.
6. Preferir fontes primárias e dados comparáveis; usar relatórios secundários como contexto quando não houver fonte primária.
7. A ausência de uma fonte ou de um dado não é evidência de ausência de comportamento ou tendência.
8. Não contornar autenticação, bloqueios, termos de uso ou limites de acesso.
9. Reavaliar fontes quando mudarem produto, método, cobertura, disponibilidade ou condições de uso.

## Status padronizados

- **A descobrir:** fonte ainda não identificada para uma necessidade específica.
- **Candidata:** fonte identificada, relevância ainda não verificada.
- **Em verificação:** metodologia, acesso, cobertura ou permissões sob análise.
- **Acesso confirmado:** há evidência de acesso permitido a um conjunto de dados específico.
- **Em teste:** coleta ou análise experimental em andamento.
- **Ativa:** integração ou rotina de coleta operacional verificada.
- **Limitada:** utilizável apenas para certas perguntas, regiões, períodos ou indicadores.
- **Bloqueada:** acesso indisponível ou condições impeditivas documentadas.
- **Rejeitada:** não atende aos critérios; registrar justificativa.
- **Descontinuada:** deixou de ser usada; preservar histórico e motivo.

## Campos obrigatórios por fonte

| Campo | Descrição |
|---|---|
| ID da fonte | Identificador interno estável |
| Organização/provedor | Quem publica ou fornece |
| Produto/série/relatório | Conjunto de dados específico |
| Família | Instituto/painel, oficial, setorial, acadêmica, varejo, busca, social, avaliações etc. |
| Papel | Comportamento, mercado, contexto ou validação |
| Pergunta que ajuda a responder | Hipótese ou decisão atendida |
| Métrica e unidade | Definição oficial, por exemplo volume, valor, preço/kg, preço/100 g, interesse relativo |
| Origem | Primária, secundária ou republicação |
| URL/referência | Endereço canônico ou referência contratual documentada |
| Acesso/licença | Público, autorizado, licenciado, demonstração, indisponível ou a verificar |
| Período e atualização | Histórico, cadência e data da última observação |
| Cobertura | País, região, canal, categoria, marca, população ou amostra |
| Granularidade | Dia/semana/mês, SKU/categoria, região, canal etc. |
| Metodologia | Universo, amostra, definição, coleta e limitações |
| Custo e direitos | Preço, armazenamento, transformação, exibição e redistribuição |
| Independência | Relação com outras fontes e estudos que replica |
| Qualidade | Avaliação fundamentada de atualidade, pertinência e comparabilidade |
| Status | Um dos status padronizados |
| Última verificação | Data e responsável |
| Próximo passo | Ação concreta para confirmar ou melhorar a fonte |

## Rubrica de avaliação

Avaliar cada dimensão como **forte**, **parcial**, **fraca** ou **desconhecida**, com justificativa:

- Relevância para a pergunta de negócio.
- Confiabilidade e transparência metodológica.
- Atualidade e continuidade temporal.
- Cobertura geográfica e populacional.
- Granularidade necessária.
- Comparabilidade com outras séries.
- Independência em relação às evidências já usadas.
- Estabilidade de acesso e permissão de uso.
- Custo e viabilidade operacional.
- Proveniência e possibilidade de reprodução.

Não usar uma pontuação agregada para ocultar falhas críticas. Uma fonte pode ser reconhecida e ainda ser inadequada para uma pergunta específica.

## Mapa inicial de fontes a investigar

Esta lista é ilustrativa, não exaustiva. Cada item começa como **candidato**, salvo quando houver registro separado que comprove seu status real.

### Institutos, painéis e inteligência comercial

- Scanntech
- NielsenIQ (NIQ)
- Kantar / Worldpanel
- Circana
- Ipsos
- YouGov
- Euromonitor International
- Mintel
- GlobalData
- dunnhumby
- Outros institutos locais, regionais ou especializados relevantes para a pergunta

### Estatísticas oficiais e pesquisa econômica

- IBGE
- Banco Central do Brasil
- IPEA
- FGV IBRE
- IPEAD/UFMG e outros centros regionais pertinentes
- Procons e fontes oficiais de defesa do consumidor
- Estatísticas estaduais e municipais
- Organismos internacionais e bases públicas quando agregarem contexto comparável

### Associações e especialistas de setor

- ABICAB
- ABRAS
- ABAD
- ABRE
- ICCO
- Outras associações de alimentos, ingredientes, cacau, embalagem, distribuição e varejo conforme a hipótese

### Academia e pesquisa técnica

- Universidades e repositórios científicos brasileiros e internacionais
- Artigos revisados por pares, teses, centros de pesquisa e conferências
- Estudos metodológicos relevantes para comportamento, shopper, preço, categoria e detecção de tendências

### Varejo, e-commerce e oferta

- Catálogos públicos e páginas de produto de varejistas e marketplaces
- Séries autorizadas de preço, promoções, sortimento e disponibilidade
- Dados licenciados de sell-out, painel, fidelidade ou transações, quando disponíveis e permitidos

### Busca, conversa e comportamento humano

- Google Trends e ferramentas equivalentes de busca agregada
- APIs oficiais e dados licenciados de plataformas sociais
- Fóruns e comunidades públicas com acesso permitido
- Vídeos e comentários públicos acessíveis de acordo com as condições da plataforma
- Avaliações de produtos, perguntas e reclamações públicas
- Pesquisas de opinião, hábitos e ocasiões com metodologia identificável

## Estado inicial observado no repositório

Inspeção do código versionado em `main` identificou um worker genérico em `supabase/functions/pulse-external-source-worker/index.ts` que lê fontes ativas da tabela `intelligence_sources` e trata fontes dos tipos RSS/Atom, JSON e HTML. Isso fornece uma base de ingestão genérica, mas **não comprova integração direta com APIs proprietárias ou produtos licenciados de Scanntech, NielsenIQ, Kantar ou qualquer outro instituto**.

Implicações para o trabalho:
- Reaproveitar o worker genérico quando a fonte e o formato forem compatíveis, após validar acesso, termos e qualidade.
- Para APIs autenticadas, arquivos licenciados ou esquemas específicos, avaliar adaptador próprio, armazenamento e regras de segurança antes de implementar.
- Não presumir quais fontes estão ativas em produção apenas a partir do código. O inventário de execução exige verificar a configuração real da tabela `intelligence_sources` e as últimas capturas, usando acesso autorizado.
- Registrar separadamente “o código aceita este formato”, “a fonte foi configurada”, “a captura teve sucesso” e “o dado foi validado e usado numa conclusão”.
- Não colocar credenciais, chaves ou conteúdo licenciado no inventário público do repositório.

Referência do worker: https://github.com/PauloRafaeldeMouraPaes/shopplosion-pulse/blob/main/supabase/functions/pulse-external-source-worker/index.ts

## Processo de descoberta contínua

Para cada oportunidade de pesquisa ou sinal prioritário:

1. Especificar qual evidência poderia confirmar, contradizer ou contextualizar a hipótese.
2. Consultar o inventário antes de buscar novos fornecedores.
3. Pesquisar fontes primárias e alternativas independentes para a lacuna identificada.
4. Registrar candidatas e a justificativa de relevância.
5. Verificar acesso real, metodologia, período, cobertura, granularidade, custo e direitos.
6. Identificar dependências e republicações; contar linhagens de evidência, não quantidade de URLs.
7. Aprovar, limitar, bloquear ou rejeitar com motivo documentado.
8. Se automatizar, definir contrato de dados, captura de timestamps, tratamento de falhas, deduplicação, versionamento e monitoramento.
9. Reavaliar quando uma fonte falhar, mudar de método ou deixar de ser comparável.

## Checklist específico para o piloto Chocolate

- [ ] Inventariar as fontes que já estão conectadas ao Pulse e seu status real.
- [ ] Identificar indicadores necessários para preço, promoções, gramatura, sortimento e vendas/compra.
- [ ] Identificar fontes para buscas, necessidades, ocasiões, percepção de valor, sabores e formatos.
- [ ] Investigar Scanntech, NielsenIQ, Kantar/Worldpanel e alternativas sem presumir acesso.
- [ ] Mapear estatísticas oficiais, estudos setoriais e fontes acadêmicas relevantes.
- [ ] Registrar cobertura nacional e regional e apontar lacunas.
- [ ] Selecionar fontes para um primeiro ciclo com base em comparabilidade e acesso permitido.
- [ ] Capturar snapshots datados e criar uma linha de base reproduzível.
- [ ] Registrar falsos positivos, evidências contraditórias e motivos de rejeição.
- [ ] Rever semanalmente fontes, cobertura, falhas e novas necessidades de pesquisa.

## Critério de conclusão

O inventário inicial estará pronto para uso quando toda fonte usada numa conclusão do piloto tiver um registro verificável, status real de acesso, definição da métrica, período, cobertura, limitações, linhagem e condições de uso. Não é necessário integrar todos os candidatos; é necessário conseguir explicar por que cada fonte usada foi selecionada e o que ela realmente permite concluir.
