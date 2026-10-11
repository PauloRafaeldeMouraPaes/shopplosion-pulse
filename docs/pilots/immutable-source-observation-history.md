# Proposta técnica — histórico imutável de observações de fontes

**Status:** desenho técnico; não implantado.  
**Escopo:** piloto Chocolate e evolução compatível com o coletor existente.  
**Objetivo:** preservar proveniência e mudanças ao longo do tempo sem confundir uma nova coleta com uma nova tendência.

## 1. Problema verificado

O worker `supabase/functions/pulse-external-source-worker/index.ts` calcula um SHA-256 do título, URL e conteúdo, consulta `intelligence_source_items` por `source_id + external_id` e faz `upsert` do item atual. Para páginas HTML, o `external_id` é a própria URL. Assim, coletas posteriores da mesma página substituem o conteúdo anterior. `intelligence_source_fetch_runs` registra o resultado da execução, mas não preserva, por si só, cada versão observada.

Consequência: o Pulse pode identificar que um item mudou entre duas coletas, mas não consegue reconstruir de forma confiável todas as versões históricas a partir da linha atual.

## 2. Modelo recomendado: observações + versões de conteúdo

Não substituir nem reinterpretar as tabelas atuais. Acrescentar duas tabelas:

### `intelligence_source_item_versions` — versões únicas do conteúdo

- `id uuid primary key default gen_random_uuid()`
- `industry_id uuid not null` — mesma partição lógica do restante da inteligência.
- `source_id uuid not null`
- `source_item_id uuid null` — referência ao item corrente, quando disponível.
- `external_id text not null` — identidade fornecida pela fonte.
- `content_fingerprint text not null` — SHA-256 do conteúdo normalizado capturado.
- `title text not null`
- `url text null`
- `published_at timestamptz null` — data atribuída pela fonte, não a data da coleta.
- `first_observed_at timestamptz not null default now()`
- `content text not null` — conteúdo extraído limitado pelo coletor atual.
- `metadata jsonb not null default '{}'::jsonb` — tipo de fonte, versão do parser e metadados não sensíveis.
- Restrição única sugerida: `(source_id, external_id, content_fingerprint)`.

Uma versão só é inserida quando o fingerprint ainda não existir para aquela identidade. Conteúdo idêntico repetido não cria uma versão nova. Mudanças na extração/parser devem ser registradas em `metadata` para não serem confundidas automaticamente com mudanças de comportamento.

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

Restrições: uma única observação por `(fetch_run_id, source_id, external_id)`; índices em `(industry_id, observed_at desc)`, `(source_id, external_id, observed_at desc)` e `version_id`. A restrição única das versões evita cópias integrais desnecessárias; a tabela de observações ainda prova quando uma versão foi vista novamente.

> A semântica de `observed_at` é “o coletor observou este conteúdo nesta execução”, não “o consumidor mudou de preferência nesta data”.

## 3. Fluxo de coleta proposto

1. Criar a linha de `intelligence_source_fetch_runs` como hoje.
2. Buscar e normalizar os itens.
3. Calcular o fingerprint determinístico.
4. Inserir a versão com `ON CONFLICT (source_id, external_id, content_fingerprint) DO NOTHING`; em seguida, resolver o `version_id` existente ou recém-criado.
5. Inserir uma observação vinculada à execução, sem sobrescrever observações antigas.
6. Atualizar `intelligence_source_items` como projeção operacional atual, mantendo compatibilidade com consumidores atuais.
7. Finalizar a execução com contagens de itens vistos, versões novas, itens alterados e falhas.
8. Se a persistência de versão/observação falhar, marcar a execução como falha parcial/total; não reportar captura bem-sucedida silenciosamente.

A inserção da versão, observação e projeção atual deve idealmente ocorrer numa única operação transacional (RPC/função de banco) ou com tratamento explícito de falha e reconciliação. Não depender de uma sequência de chamadas que possa deixar o histórico incompleto sem sinalização.

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

**Implicação para o desenho:** as tabelas novas devem preservar o isolamento por `industry_id`, não receber políticas genéricas de leitura pública e não abrir escrita direta aos usuários autenticados. A política de leitura, se necessária no painel, deve usar o mesmo mecanismo `current_industry_id()` confirmado no banco. A execução do worker precisa continuar restrita ao servidor. Ainda é necessário validar privilégios efetivos, FKs/cascatas e advisors na branch de desenvolvimento antes da migração.

## 6. Compatibilidade e implantação gradual

1. Fazer inventário de constraints, FKs, RLS/policies e funções atuais.
2. Criar migration numa branch de desenvolvimento do Supabase, não diretamente em produção.
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
- Não executa migrações.
- Não ativa fontes novas nem contorna bloqueios de acesso.
- Não afirma que existe uma série de comportamento humano ou de preços de varejo comparáveis.
- Não considera o período anterior à primeira coleta histórica como observado.

## Decisão técnica

**Recomendação:** implementar primeiro a camada append-only de versões e observações, mantendo `intelligence_source_items` como projeção compatível. Esse é o menor passo que elimina a perda de histórico sem obrigar uma reescrita imediata do painel ou do modelo de sinais.
