# Pulse — recuperação de senha e URLs de Auth

## Configuração obrigatória no Supabase

No projeto Supabase, abra **Authentication → URL Configuration**.

Use como **Site URL**:

`https://paulorafaeldeMouraPaes.github.io/shopplosion-pulse/`

Adicione como **Redirect URL** exata:

`https://paulorafaeldeMouraPaes.github.io/shopplosion-pulse/auth.html`

O Pulse calcula o `redirectTo` da recuperação a partir da origem e do caminho da página de login. A URL precisa estar na allow-list do Supabase.

## Fluxo esperado

1. Abrir `/auth.html`.
2. Informar o e-mail.
3. Clicar em **Esqueci minha senha**.
4. Receber o e-mail do Supabase.
5. Abrir o link.
6. O link retorna para `/auth.html` em modo de recuperação.
7. Definir a nova senha.
8. O Pulse atualiza a senha e entra no aplicativo.

## Segurança

- O navegador usa somente a publishable/anon key.
- Nenhuma chave privilegiada deve ser colocada no frontend.
- A recuperação não revela se um e-mail existe, comportamento esperado do Supabase.
- A autorização de indústria continua sendo feita por PostgreSQL/RLS após autenticação.

## Validação manual

- Confirmar que o link de recuperação não aponta para `localhost`.
- Confirmar que a nova senha permite login.
- Confirmar que a conta continua associada à mesma `industry_id`.
- Repetir o teste com o segundo usuário antes do teste de isolamento entre indústrias.
