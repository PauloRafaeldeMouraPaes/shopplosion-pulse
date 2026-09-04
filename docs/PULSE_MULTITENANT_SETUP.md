# Pulse Multi-Tenant — Setup

## Estado

A fundação de dados e segurança está versionada nas migrations `001_multitenant_core.sql` e `002_storage_and_membership_hardening.sql`. O projeto Supabase real já está conectado ao frontend por `pulse-config.js`, usando apenas a chave pública/publishable. O login está em `auth.html` e, após autenticação, direciona para `app.html`, a área privada da indústria.

## Configuração inicial

1. Criar um projeto gratuito no Supabase.
2. Executar `supabase/migrations/001_multitenant_core.sql` no SQL Editor.
3. Executar `supabase/migrations/002_storage_and_membership_hardening.sql` no SQL Editor. Essa etapa cria/garante o bucket privado e as políticas de Storage.
4. Criar as primeiras indústrias em `public.industries`.
5. Criar os usuários em Supabase Auth.
6. Associar cada usuário a exatamente uma indústria em `public.profiles`.
7. Preencher `pulse-config.js` com a URL pública do projeto e a chave pública/anon (ou publishable key). Essa chave pode estar no navegador; `service_role` nunca pode estar no navegador.
8. Publicar pelo GitHub Pages ou Netlify. O `_redirects` mantém `/` como entrada de login e `/app` como área autenticada.

## Área privada da indústria

Após o login, `app.html` valida o usuário no Supabase, consulta a associação em `public.profiles` e valida que a indústria está ativa. A área privada permite:

- identificar a indústria autenticada;
- listar apenas os documentos autorizados pela RLS;
- enviar documentos para o bucket privado `pulse-documents` usando caminho iniciado pelo UUID da indústria;
- gerar URLs temporárias para documentos autorizados;
- listar apenas as análises autorizadas pela RLS;
- sair da conta e retornar ao login;
- abrir a camada de Universo Pulse, separada dos dados privados do cliente.

## Modelo de caminho de arquivos

Uploads usam `pulse-documents/<industry_uuid>/<arquivo>`. O primeiro segmento é validado no Storage contra a indústria ativa derivada da sessão; conhecer o caminho de outro cliente não concede acesso.

## Teste obrigatório de isolamento

Criar pelo menos duas indústrias de teste: A e B, com um usuário ativo em cada uma.

- Usuário A deve listar apenas documentos A.
- Usuário A deve listar apenas análises A.
- Usuário B deve listar apenas documentos B.
- Usuário B deve listar apenas análises B.
- Trocar manualmente IDs não pode atravessar o tenant.
- Inserir um `industry_id` de B enquanto autenticado como A deve ser rejeitado pela RLS.
- Uma URL/caminho de Storage pertencente a A não pode ser baixado, atualizado ou excluído por B.
- Usuário de indústria suspensa não deve obter dados, criar registros ou operar Storage.
- Usuário autenticado sem `profiles` não deve acessar a área privada.

## Segurança

Credenciais reais, tokens privilegiados, documentos de clientes e dados pessoais não devem ser commitados. O repositório deve conter somente schema, código e dados sintéticos de teste. O frontend não é autoridade de tenant; o banco/Storage é.

## Validação determinística

O CI executa `scripts/audit_pulse_multitenant.py`, que verifica a presença das proteções essenciais, a ausência de configuração privilegiada no navegador, o roteamento de login/app, a área autenticada, RLS, membership ativo e políticas privadas de Storage.

## Critério de conclusão

A fundação técnica está implementada e o login real já foi validado. A conclusão de segurança multi-tenant, porém, exige o teste operacional A-versus-B dos documentos, análises e Storage. Esse teste deve ser realizado com duas sessões autenticadas e é o próximo gate de aceitação antes de tratar o isolamento como comprovado em produção.
