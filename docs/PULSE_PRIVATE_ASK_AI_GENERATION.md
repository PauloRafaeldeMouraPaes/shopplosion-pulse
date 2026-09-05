# Pulse — Ask AI privado: geração server-side

## Arquitetura
- `ask.html` continua autenticado e tenant-scoped.
- `supabase/functions/pulse-ask-ai/index.ts` recebe somente a pergunta.
- A Edge Function usa o JWT do usuário ao consultar `document_chunks`, portanto RLS permanece ativo.
- Os 8 melhores chunks são enviados ao provedor somente no servidor.
- A resposta exige citações `[E1]`, `[E2]` etc. correspondentes aos chunks recuperados.
- Nenhuma chave do provedor de IA é enviada ao navegador.

## Provedor
A implementação usa a Claude Messages API via `ANTHROPIC_API_KEY`. O modelo é configurável por `PULSE_LLM_MODEL` e, por padrão, usa `claude-sonnet-5`.

## Secrets de produção
Configurar no projeto Supabase:
- `ANTHROPIC_API_KEY`
- `PULSE_LLM_MODEL` (opcional; exemplo: `claude-sonnet-5`)

Os secrets devem ficar somente no Supabase Edge Functions. Nunca colocar a chave em `pulse-config.js`, HTML, GitHub ou variáveis públicas.

## Deploy
```powershell
supabase login
supabase link --project-ref ppfuygnpgywfpiqxsfys
supabase secrets set ANTHROPIC_API_KEY=COLOQUE_A_CHAVE_AQUI
supabase secrets set PULSE_LLM_MODEL=claude-sonnet-5
supabase functions deploy pulse-ask-ai --use-api
```

## Critérios de aceite
1. Usuário autenticado consegue gerar resposta sobre seus próprios documentos.
2. A Edge Function rejeita chamada sem JWT.
3. A recuperação usa o contexto do usuário e RLS.
4. A resposta contém referências às evidências utilizadas.
5. O navegador nunca recebe `ANTHROPIC_API_KEY`.
6. Falha do provedor não expõe segredo nem dados de outra indústria.

## Limite conhecido
O deploy da Edge Function e a configuração da `ANTHROPIC_API_KEY` dependem da conta Supabase/Anthropic e não podem ser concluídos pelo repositório sem um segredo fornecido pelo usuário. O segredo nunca deve ser enviado pelo chat.
