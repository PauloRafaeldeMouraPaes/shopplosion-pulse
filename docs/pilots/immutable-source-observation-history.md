# Proposta técnica — histórico imutável de observações de fontes

**Status:** implementação versionada no PR #80 e validada parcialmente em PostgreSQL efêmero; não implantada no Supabase de produção.  
**Contrato de testes:** [matriz de aceitação do histórico imutável](immutable-source-observation-tests.md).  
**Escopo:** piloto Chocolate e evolução compatível com o coletor existente.  
**Objetivo:** preservar proveniência e mudanças ao longo do tempo sem confundir uma nova coleta com uma nova tendência.

## 1. Problema verificado

O worker `supabase/functions/pulse-external-source-worker/index.ts` calcula um SHA-256 do título, URL e conteúdo, consulta `intelligence_source_items` por `source_id + external_id` e faz `upsert` do item atual. Para páginas HTML, o `external_id` é a própria URL. Assim, coletas posteriores da mesma página substituem o conteúdo anterior. `intelligence_source_fetch_runs` registra o resultado da execução, mas não preserva, por si só, cada versão observada.

Consequência: o Pulse pode identificar que um item mudou entre duas coletas, mas não consegue reconstruir de forma confiável todas as versões históricas a partir da linha atual.

**Regra de identidade para feeds JSON:** o coletor usa apenas identificadores fornecidos pela fonte (`id`, `guid`, `url` ou `link`). Registros sem identificador estável são ignorados, em vez de usar a posição no array. Índices mudam quando itens são inseridos ou reordenados e poderiam transformar um registro diferente na mesma identidade histórica, produzindo falsos históricos. A cobertura descartada deve ser monitorada antes de ativar uma fonte JSON no piloto.

## 2. Modelo recomendado: observações + versões de conteúdo

Não substituir nem reinterpretar as tabelas atuais. Acrescentar duas tabelas:

### `intelligence_source_item_versions` — versões únicas do conteúdo

- `id uuid primary key default gen_random_uuid()`
- `industry_id uuid not null` — mesma partição lógica do restante da inteligência.
- `source_id uuid not null`
- `external_id text not null` — identidade fornecida pela fonte.
- `content_fingerprint text not null` — SHA-256 UTF-8 de uma representação JSON compacta dos campos persistidos `[title, url ou "", content]`; o worker calcula o hash depois de aplicar os limites de tamanho (título 500, URL 2.000, conteúdo 12.000 caracteres).
- `title text not null`
- `url text null`
- `published_at timestamptz null` — data atribuída pela fonte, não a data da coleta.
- `first_observed_at timestamptz not null default now()`
- `content text not null` — conteúdo extraído limitado pelo coletor atual.
- `metadata jsonb not null default '{}'::jsonb` — tipo de fonte, versão do parser e metadados não sensíveis.
- Restrição única sugerida: `(source_id, external_id, content_fingerprint)`.

Uma versão só é inserida quando o fingerprint ainda não existir para aquela identidade, usando `INSERT ... ON CONFLICT (source_id, external_id, content_fingerprint) DO NOTHING` e resolvendo a versão existente antes de gravar a observação. Conteúdo idêntico repetido não cria uma versão nova. Mudanças na extração/parser devem ser registradas em `metadata` para não serem confundidas automaticamente com mudanças de comportamento. `intelligence_source_item_versions` não referencia a projeção atual: ela é mutável, enquanto a versão precisa preservar o snapshot de forma independente.

### `intelligence_source_item_observations` — cada observação em uma execução

- `id uuid primary key default gen_random_uuid()`
- `industry_id uuid not null`
- `source_id uuid not null`
- `fetch_run_id uuid not null` — execução que originou a observação.
- `source_item_id uuid null` — item corrente correspondente.
- `version_id uuid null` — versão imutável do conteúdo; nulo apenas para ocorrências não persistidas com sucesso.
- `external_id text not null`
- `observed_at timestamptz not null default now()`
- `outcome text not null` — por exemplo `captured`, `unchanged`, `parse_error`; usar CHECK.
- `metadata jsonb not null default '{}'::jsonb`.

Restrições: uma única observação por `(fetch_run_id, external_id)` (a execução já pertence a uma fonte); índices em `(industry_id, observed_at desc)`, `(source_id, external_id, observed_at desc)` e `version_id`. A restrição única das versões evita cópias integrais desnecessárias; a tabela de observações ainda prova quando uma versão foi vista novamente.

**Integridade relacional obrigatória:** as FKs devem impedir que uma linha combine `industry_id` de um tenant com `source_id`, `fetch_run_id` ou `source_item_id` de outro. Para isso, a implementação deve avaliar FKs compostas e constraints únicas auxiliares como `(id, industry_id)` / `(id, source_id, industry_id)` nas tabelas de origem e execução, ou uma função transacional equivalente com validação explícita. FKs simples independentes para `industry_id` e `source_id` não garantem essa correspondência. A migration deve ser validada contra o schema real e seus constraints antes de ser considerada pronta.

> A semântica de `observed_at` é “o coletor observou este conteúdo nesta execução”, não “o consumidor mudou de preferência nesta data”.

## 3. Fluxo de coleta

1. Criar `intelligence_source_fetch_runs` e validar que a execução foi persistida.
2. Buscar e normalizar itens respeitando os limites do coletor.
3. Gerar `content_fingerprint` de forma determinística usando SHA-256 da representação JSON compacta `[title, url ou "", content]`, com os valores que serão de fato persistidos. A codificação é UTF-8; `published_at` e metadados de parser ficam fora do fingerprint do conteúdo.
4. Chamar `pulse_record_source_item_observation` uma vez por item. A RPC, dentro de uma única transação, deduplica/insere a versão, atualiza a projeção `intelligence_source_items` e insere a observação append-only.
5. Atualizar contagens de execução apenas com os resultados efetivamente retornados pela RPC; `current_item_changed` incrementa a contagem de itens alterados.
6. Ao ocorrer uma falha de persistência, abortar o processamento dessa fonte e marcar a execução como `failed` com erro e contagens parciais. As chamadas bem-sucedidas de itens anteriores permanecem commitadas, mas ficam identificadas como parte de uma execução falha e podem ser reconciliadas; a transação é atômica por item, não pelo lote inteiro.

O worker passa a falhar explicitamente quando a RPC retorna erro ou resultado inesperado, em vez de ignorar um erro de upsert. O retry dentro da mesma execução e identidade só é idempotente quando aponta para a mesma versão; se vier com fingerprint conflitante, a RPC rejeita a chamada e reverte as gravações dessa chamada.

## 4. Integridade, isolamento e segurança

- Habilitar RLS nas duas tabelas.
- Manter as tabelas fora de acesso público desnecessário; o worker usa credencial privilegiada no servidor.
- Não expor chave `service_role`/secret no navegador.
- Não conceder escrita direta a `anon` ou `authenticated`.
- Aplicar política de leitura por tenant compatível com as políticas reais existentes, não presumir que `TO authenticated` por si só isola dados.
- Preferir escrita append-only: sem políticas de UPDATE/DELETE para clientes e, se compatível com a operação do banco, trigger que rejeite UPDATE/DELETE. A role privilegiada do worker continua sendo altamente confiável; a imutabilidade lógica deve ser reforçada por testes e revisão de acessos.
- Validar chaves estrangeiras e cascatas com o schema real antes de criar a migração; evitar exclusões em cascata que apaguem evidência histórica inadvertidamente.
- Definir retenção e limites de conteúdo antes de produção. Respeitar termos, direitos de uso e privacidade das fontes; não capturar dados pessoais desnecessários.
- Não contornar HTTP 403 nem controles de acesso de fontes.

## 5. Estado do schema verificado em produção (somente leitura)

Consulta ao catálogo do PostgreSQL em 11/10/2026 confirmou:

- `intelligence_source_items` possui unicidade em `(source_id, external_id)`, FKs para `intelligence_sources` e `industries`, RLS habilitado e política de leitura para `authenticated` restrita a `industry_id = current_industry_id()`.
- `intelligence_source_fetch_runs` possui FKs para fonte e indústria, RLS habilitado e política de leitura restrita à indústria atual.
- `intelligence_sources` tem unicidade em `(industry_id, url)`, RLS habilitado e políticas de leitura/inserção/atualização/exclusão por indústria atual.
- A consulta de políticas não encontrou políticas de escrita para `authenticated` em itens ou execuções; o worker usa cliente administrativo no servidor.

**Implicação para o desenho:** as tabelas novas devem preservar o isolamento por `industry_id`, não receber políticas genéricas de leitura pública e não abrir escrita direta aos usuários autenticados. A política de leitura, se necessária no painel, deve usar o mesmo mecanismo `current_industry_id()` confirmado no banco. A execução do worker precisa continuar restrita ao servidor. O SQL gerado pelo Supabase CLI e o teste da RPC são exercitados numa fixture sintética de PostgreSQL 17 no CI; isso não equivale a aplicar a migration num clone real do schema de produção. Antes de qualquer deployment, ainda é necessário reconciliar o SQL com o catálogo real, revisar privilégios efetivos e executar advisors num ambiente isolado.

## 6. Compatibilidade e implantação gradual

1. Fazer inventário de constraints, FKs, RLS/policies e funções atuais.
2. Gerar a migration com o nome real da Supabase CLI no GitHub Actions/local; validar em PostgreSQL sintético/isolado sem credenciais Supabase e sem aplicar DDL à produção.
3. Adicionar tabelas e índices sem mudar a leitura atual.
4. Atualizar o worker para gravar versões/observações.
5. Testar duas coletas do mesmo item, uma mudança de conteúdo, duas fontes com mesmo `external_id`, isolamento por tenant e falhas parciais.
6. Fazer backfill apenas do estado atual existente, marcado explicitamente como `backfill_current_state`; nunca inventar timestamps históricos nem afirmar que os 26 itens atuais constituem série longitudinal.
7. Liberar gradualmente e verificar métricas/consultas.
8. Só depois criar consultas de tendência que usem observações históricas e distingam data de publicação, data de coleta e data de primeira observação.

## 7. Critérios de aceite

- Recoletar conteúdo idêntico gera uma observação nova, mas não duplica a versão.
- Alterar conteúdo da mesma URL gera nova versão e preserva a anterior.
- RSS/Atom com `external_id` estável preserva versões separadas.
- Duas fontes diferentes não colidem por compartilhar um `external_id`.
- Falha ao persistir o histórico não é apresentada como execução inteiramente bem-sucedida.
- Consultas permitem reconstruir a sequência de versões observadas por fonte/item.
- RLS/isolamento e permissões são testados antes de qualquer deploy.
- O painel não chama “tendência” a uma simples mudança de página, repetição de coleta ou artefato do parser.

## 8. Fora do escopo desta etapa

- Não altera o banco de produção.
- Não aplica migrations a banco algum nesta etapa; o arquivo versionado no PR foi executado somente dentro de uma transação de teste que termina em `ROLLBACK` no PostgreSQL efêmero.
- Não ativa fontes novas nem contorna bloqueios de acesso.
- Não afirma que existe uma série de comportamento humano ou de preços de varejo comparáveis.
- Não considera o período anterior à primeira coleta histórica como observado.

## Decisão técnica

**Recomendação:** implementar primeiro a camada append-only de versões e observações, mantendo `intelligence_source_items` como projeção compatível. Esse é o menor passo que elimina a perda de histórico sem obrigar uma reescrita imediata do painel ou do modelo de sinais.
