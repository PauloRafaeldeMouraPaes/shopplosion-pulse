# Superpowers no Pulse — guia de adoção

**Status:** proposta de processo para revisão; não altera o runtime nem instala dependências de aplicação.

Referência upstream: [obra/superpowers](https://github.com/obra/superpowers)  
Versão consultada: `main`, commit `bb92a77741419a4ab5f06e711a283343f1ada0c3` (2026-10-15).

## Objetivo

Adotar as práticas de engenharia que reduzem retrabalho no Pulse, sem importar o framework inteiro, seus scripts de interface ou instruções que conflitem com as regras já estabelecidas no projeto.

## Práticas adotadas

### 1. Diagnosticar a causa antes de corrigir

Para bug, falha de CI ou comportamento inesperado:

1. Reproduzir o problema e registrar a saída observada.
2. Inspecionar logs, diff recente e o caminho completo dos dados.
3. Identificar a causa-raiz com evidência.
4. Criar um teste que reproduza o defeito.
5. Aplicar a menor correção coerente com a arquitetura.
6. Executar novamente o teste específico e a regressão relevante.

Não fazer sucessivas alterações especulativas. Se não for possível reproduzir, registrar a incerteza e coletar evidências antes de mexer.

### 2. Teste antes da implementação

Para nova lógica, correção ou mudança de comportamento:

1. Definir o comportamento esperado e os casos-limite.
2. Escrever um teste que falhe pela razão certa.
3. Executar o teste e confirmar a falha.
4. Implementar a menor mudança que o faça passar.
5. Executar o teste novamente e depois os testes de regressão.
6. Refatorar apenas com os testes relevantes verdes.

Exceções limitadas: documentação, código gerado e mudanças puramente configuracionais. Mesmo nessas exceções, validar o diff e as verificações aplicáveis.

### 3. Planejar mudanças que atravessam várias partes do sistema

Antes de uma alteração não trivial, registrar um plano curto contendo:

- resultado desejado e não objetivos;
- arquivos/serviços envolvidos e dependências;
- tarefas pequenas com critérios verificáveis;
- testes por tarefa;
- riscos, migração e reversão quando houver banco, autenticação, dados ou deploy.

Seguir os padrões existentes do Pulse; não redesenhar ou criar novas telas/rotas/IDs/âncoras sem que isso faça parte do escopo autorizado. Preferir a menor solução que cumpra o objetivo.

### 4. Revisar tecnicamente o feedback

Antes de aceitar uma sugestão de revisão:

- verificar se ela corresponde ao código real e ao requisito;
- procurar efeitos colaterais, segurança, multi-tenant e regressões;
- implementar itens independentes um por vez;
- justificar tecnicamente qualquer discordância.

Não tratar feedback externo como verdade automática nem descartá-lo sem investigação.

### 5. Verificar antes de declarar concluído

Antes de dizer que algo foi resolvido:

- consultar o diff final e confirmar quais arquivos mudaram;
- executar as verificações relevantes no commit atual;
- conferir os resultados e distinguir testes locais, CI, staging e produção;
- declarar explicitamente testes que não foram executados e bloqueios remanescentes.

Não usar uma execução antiga de CI como evidência de um commit novo. Não dizer que houve validação em produção se só houve teste sintético.

## Guardrails específicos do Pulse

Estas regras têm precedência sobre sugestões genéricas do Superpowers:

- **Produção Supabase:** nenhuma DDL, alteração de grants, `db push` ou mutação de dados sem lineage reconciliado, plano de rollback e validação isolada aprovada.
- **Multi-tenant e segurança:** testar isolamento por indústria/tenant, privilégios mínimos, RPCs internas e caminhos de scheduler/Edge Function.
- **Evidência e inteligência:** preservar proveniência, timestamps reais, fingerprints e distinção entre hipótese, sinal e tendência validada. Não fabricar capturas ou evidências.
- **Chocolate:** não declarar baseline iniciado/concluído sem capturas reais, cobertura e completude verificadas e critérios humanos satisfeitos.
- **Interface:** acabamento não é redesenho. Preservar o design system canônico e evitar mudanças de rota, ID, âncora e fluxo fora do escopo.
- **Integração:** preferir branch + PR revisável. Não fazer merge ou deploy automaticamente só porque os testes passaram.
- **Interação:** executar de ponta a ponta com mínima interrupção; pedir esclarecimento apenas quando uma decisão material não puder ser inferida com segurança.

## Fluxo operacional padrão

1. **Entender:** objetivo, restrições, fonte da verdade e estado atual.
2. **Investigar:** reproduzir ou mapear a implementação existente.
3. **Planejar:** apenas o necessário para a complexidade real.
4. **Testar:** definir primeiro os critérios e, para lógica, confirmar falha antes da correção.
5. **Implementar:** mudança pequena, escopo controlado.
6. **Verificar:** testes, auditorias e inspeção do diff.
7. **Revisar:** avaliar segurança, regressões e aderência ao pedido.
8. **Entregar:** links, commit/PR, evidências, limitações e próximo bloqueio real.

## O que não importar agora

Não copiar indiscriminadamente todas as skills, scripts de visualização, servidores auxiliares, mecanismos de subagentes ou comandos específicos de outros ambientes. O Pulse tem fluxo próprio, CI e guardrails de produção. Adoção incremental evita dependências e conflitos desnecessários.

## Referências upstream examinadas

- [Brainstorming](https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md)
- [Writing Plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md)
- [Test-Driven Development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md)
- [Systematic Debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md)
- [Verification Before Completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md)
- [Requesting Code Review](https://github.com/obra/superpowers/blob/main/skills/requesting-code-review/SKILL.md)
- [Receiving Code Review](https://github.com/obra/superpowers/blob/main/skills/receiving-code-review/SKILL.md)

Este guia resume práticas selecionadas e adaptadas; não é uma cópia nem uma instalação completa do repositório upstream.
