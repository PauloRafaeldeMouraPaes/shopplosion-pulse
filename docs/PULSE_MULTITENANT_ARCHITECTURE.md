# Pulse — Multi-Tenant Architecture v1

## Objetivo

Transformar o Pulse em um produto multiempresa no qual cada indústria possui autenticação, documentos, análises e histórico isolados dos demais clientes.

## Decisão arquitetural

- Frontend: aplicação Pulse hospedada inicialmente de forma gratuita via GitHub/Netlify.
- Autenticação: Supabase Auth.
- Banco: PostgreSQL via Supabase.
- Arquivos: Supabase Storage privado.
- Isolamento: `industry_id` + Row Level Security (RLS).
- Segredos: somente variáveis de ambiente/configuração segura; nenhuma chave privada no repositório ou no HTML.

## Modelo mínimo

### industries
- id UUID PK
- name TEXT NOT NULL
- slug TEXT UNIQUE NOT NULL
- status TEXT NOT NULL DEFAULT 'active'
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

### profiles
- id UUID PK/FK para auth.users
- industry_id UUID NOT NULL FK industries(id)
- role TEXT NOT NULL DEFAULT 'member'
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

### documents
- id UUID PK
- industry_id UUID NOT NULL FK industries(id)
- uploaded_by UUID NOT NULL FK auth.users(id)
- storage_path TEXT NOT NULL
- filename TEXT NOT NULL
- mime_type TEXT
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

### analyses
- id UUID PK
- industry_id UUID NOT NULL FK industries(id)
- created_by UUID NOT NULL FK auth.users(id)
- title TEXT NOT NULL
- payload JSONB NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

## Regra de segurança

O frontend nunca é a autoridade de isolamento. Toda leitura/escrita de `documents` e `analyses` deve ser autorizada pelo backend/banco usando a identidade autenticada e o `industry_id` derivado de `profiles`.

Um usuário da indústria A não pode obter, alterar, enumerar ou baixar recursos da indústria B mesmo que conheça ou altere IDs no navegador.

## RLS obrigatório

Cada tabela tenant-scoped deve possuir RLS habilitado e políticas baseadas no `industry_id` do usuário autenticado. O Storage também deve usar políticas equivalentes; caminhos de arquivo não podem ser considerados segredo.

## Fluxo

1. Usuário autentica.
2. Supabase fornece a sessão.
3. Perfil determina a indústria e o papel.
4. Pulse carrega somente dados autorizados pela RLS.
5. Upload usa caminho privado associado à indústria.
6. Análises são persistidas com `industry_id`.
7. Logout encerra a sessão local.

## Não fazer

- Não usar senha hard-coded no JavaScript.
- Não guardar documentos em `localStorage` como armazenamento principal.
- Não confiar em `industry_id` enviado pelo cliente para autorização.
- Não usar bucket público para documentos de clientes.
- Não colocar `service_role` key no frontend.
- Não publicar dados reais de clientes no repositório.

## Critérios de aceite

- Login e logout funcionam.
- Usuário autenticado conhece apenas sua indústria.
- Upload de A não aparece para B.
- Análise de A não aparece para B.
- Alterar IDs via DevTools/API não permite acesso cruzado.
- URLs de Storage de A não permitem download não autorizado por B.
- Usuário sem perfil válido não acessa a área privada.
- Todos os testes existentes do Pulse continuam passando.

## Estratégia de rollout

A implementação deve ocorrer atrás de uma branch dedicada e somente chegar à `main` após validação. Nenhuma chave ou credencial real deve ser commitada. O primeiro ambiente pode ser gratuito; custos futuros serão avaliados apenas após validação de uso.
