# Caminho de validação sem branch Supabase paga

**Decisão:** não criar branch Supabase com cobrança recorrente e não alterar o projeto de produção.

## O que é possível validar sem infraestrutura adicional

1. Usar o branch e o pull request existentes no GitHub como área de revisão.
2. Executar no GitHub Actions uma verificação estática do contrato do histórico imutável: presença dos casos H01–H15, entidades propostas, campos de identidade/proveniência e guardrails de segurança.
3. Manter a matriz de aceitação e o desenho revisáveis antes de produzir qualquer DDL.
4. Gerar a migration com a Supabase CLI somente quando houver um ambiente local isolado disponível; aplicar e testar apenas nesse ambiente.

## Limites explícitos

A verificação estática não executa SQL e não comprova FKs, RLS, isolamento entre tenants, atomicidade ou comportamento de retry. H01–H15 continuam **não executados** até que a migration e o worker estejam implementados e os testes de integração rodem em banco isolado.

Não usar apply_migration, execute_sql, deploy de Edge Function, db push ou qualquer DDL no projeto Pulse Production para contornar a falta de ambiente de desenvolvimento. Não fabricar histórico retroativo: um eventual backfill pode representar apenas o estado atual e deve ser identificado como tal.

## Próxima etapa técnica

Após o preflight estático passar, preparar a implementação real em ambiente local Supabase (CLI + Docker) ou em ambiente de desenvolvimento explicitamente aprovado. Validar constraints compostas tenant-aware, permissões efetivas e a gravação transacional de versão + observação + projeção atual; então executar H01–H15 e revisar advisors antes de qualquer proposta de release.
