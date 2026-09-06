# Pulse — Ask AI privado: geração server-side

## Arquitetura
- `ask.html` continua autenticado e tenant-scoped.
- `supabase/functions/pulse-ask-ai/index.ts` recebe somente a pergunta.
- A Edge Function usa o JWT do usuário ao consultar `document_chunks`, portanto RLS permanece ativo.
- Os 8 melhores chunks são enviados ao provedor somente no servidor.
- A resposta exige citações `[E1]`, `[E2]` etc. correspondentes aos chunks recuperados.
- Nenhuma chave do provedor de IA é enviada ao navegador.

## Provedor
A implementação usa a Gemini API via `GEMINI_API_KEY`, com `gemini-2.5-flash` como modelo padrão. O modelo continua configurável por `PULSE_LLM_MODEL`.

O modelo padrão possui nível sem custo financeiro na Gemini API, sujeito aos limites vigentes do Google. A arquitetura não exige cartão ou compra de créditos para o uso dentro do Free Tier. Consulte a página oficial de preços antes de aumentar o volume.

## Secrets de produção
Configurar no projeto Supabase:
- `GEMINI_API_KEY`
- `PULSE_LLM_MODEL` (opcional; padrão: `gemini-2.5-flash`)

Os secrets devem ficar somente no Supabase Edge Functions. Nunca colocar a chave em `pulse-config.js`, HTML, GitHub ou variáveis públicas.

## Deploy
```powershell
supabase login
supabase link --project-ref ppfuygnpgywfpiqxsfys
supabase secrets set GEMINI_API_KEY=COLOQUE_A_CHAVE_AQUI
supabase secrets set PULSE_LLM_MODEL=gemini-2.5-flash
supabase functions deploy pulse-ask-ai --use-api
```

## Critérios de aceite
1. Usuário autenticado consegue gerar resposta sobre seus próprios documentos.
2. A Edge Function rejeita chamada sem JWT.
3. A recuperação usa o contexto do usuário e RLS.
4. A resposta contém referências às evidências utilizadas.
5. O navegador nunca recebe `GEMINI_API_KEY`.
6. Falha do provedor não expõe segredo nem dados de outra indústria.
7. O fluxo funciona sem compra de créditos enquanto permanecer dentro do Free Tier disponível.

## Limite conhecido
Os limites gratuitos e a disponibilidade de modelos são definidos pelo Google e podem mudar. Se o limite do Free Tier for atingido, a função deve retornar erro do provedor sem expor a chave ou dados privados.
