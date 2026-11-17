# Vercel: prévia por pull request

Decisão de 2026-11-17 (Paulo): o Vercel serve só prévias de pull request. A produção continua no GitHub Pages, publicada pelo workflow `Pulse Production Release` e conferida arquivo por arquivo por `scripts/verify_published_artifact.py`.

- `vercel.json`: site estático, sem instalação e sem build, servido da raiz. Deploy da branch `main` desligado (`git.deploymentEnabled.main = false`), para o Vercel nunca virar uma segunda produção.
- `.vercelignore`: tira scripts, testes, Edge Functions, workflows e as capturas brutas do piloto da prévia.
- Configuração no Vercel (uma vez, pelo dono): importar o repositório `PauloRafaeldeMouraPaes/shopplosion-pulse` no plano Hobby, sem framework e sem comando de build. Cada PR passa a ganhar um link de prévia, comentado no próprio PR.
- Login nas prévias: o Supabase só aceita redirecionamento para URLs cadastradas em Auth > URL Configuration. Sem cadastrar o padrão das prévias, as páginas públicas funcionam e o login não. Cadastrar é mudança de configuração de segurança da produção e só é feita com o aceite explícito do dono.
- Plano Hobby: gratuito e para uso não comercial; se o Pulse passar a ter uso comercial, rever o plano.
