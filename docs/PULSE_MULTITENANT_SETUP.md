# Pulse Multi-Tenant — Setup

## Estado

A fundação de dados e segurança está versionada nas migrations `001_multitenant_core.sql` e `002_storage_and_membership_hardening.sql`. O site já possui uma entrada de login em `auth.html`, mas não há credencial Supabase real no repositório — isso é intencional.

## Configuração inicial

1. Criar um projeto gratuito no Supabase.
2. Executar `supabase/migrations/001_multitenant_core.sql` no SQL Editor.
3. Executar `supabase/migrations/002_storage_and_membership_hardening.sql` no SQL Editor. Essa etapa cria/garante o bucket privado e as políticas de Storage.
4. Criar as primeiras indústrias em `public.industries`.
5. Criar os usuários em Supabase Auth.
6. Associar cada usuário a exatamente uma indústria em `public.profiles`.
7. Preencher `pulse-config.js` com a URL pública do projeto e a chave pública/anon (ou publishable key). Essa chave pode estar no navegador; `service_role` nunca pode estar no navegador.
8. Publicar pelo Netlify. O `_redirects` faz `/` abrir a tela de login e `/app` servir o Pulse existente.

## Modelo de caminho de arquivos

Uploads devem usar `pulse-documents/<industry_uuid>/<arquivo>`. O primeiro segmento é validado no Storage contra a indústria ativa derivada da sessão; conhecer o caminho de outro cliente não concede acesso.

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

O CI executa `scripts/audit_pulse_multitenant.py`, que verifica a presença das proteções essenciais, a ausência de `service_role` no navegador, o roteamento de login/app, RLS, membership ativo e políticas privadas de Storage.

## Critério de conclusão

A fundação só será considerada pronta para produção quando a aplicação conectada ao projeto Supabase passar os testes reais de autenticação, autorização, Storage e isolamento cruzado, além de todos os testes regressivos existentes do Pulse. Sem um projeto Supabase real configurado, esta etapa permanece **BLOCKED — configuração externa necessária**, e não deve ser reportada como concluída.
