# Pulse Multi-Tenant — Setup

## Estado

A fundação de dados e segurança foi preparada em `supabase/migrations/001_multitenant_core.sql`. Ainda não existe credencial Supabase real no repositório e isso é intencional.

## Configuração inicial

1. Criar um projeto gratuito no Supabase.
2. Executar a migration `001_multitenant_core.sql` no SQL Editor.
3. Criar o bucket privado `pulse-documents`.
4. Configurar políticas de Storage para exigir usuário autenticado e validar o primeiro segmento do caminho contra `public.current_industry_id()`.
5. Criar as primeiras indústrias.
6. Criar os usuários em Auth.
7. Associar cada usuário a exatamente uma indústria em `profiles`.
8. Configurar no frontend apenas a URL pública do projeto e a chave pública/anon apropriada, via configuração de deploy. Nunca usar `service_role` no navegador.

## Teste obrigatório de isolamento

Criar pelo menos duas indústrias de teste: A e B.

- Usuário A deve listar apenas documentos A.
- Usuário A deve listar apenas análises A.
- Usuário B deve listar apenas documentos B.
- Usuário B deve listar apenas análises B.
- Trocar manualmente IDs não pode atravessar o tenant.
- Uma URL de Storage pertencente a A não pode ser baixada por B sem autorização.
- Usuário desabilitado/suspenso não deve operar como membro ativo.

## Segurança

Credenciais reais, tokens, documentos de clientes e dados pessoais não devem ser commitados. O repositório deve conter somente schema, código e dados sintéticos de teste.

## Critério de conclusão

A fundação só será considerada pronta quando a aplicação conectada ao projeto Supabase passar os testes de autenticação, autorização, Storage e isolamento cruzado, além de todos os testes regressivos existentes do Pulse.
