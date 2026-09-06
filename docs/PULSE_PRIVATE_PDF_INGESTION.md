# Pulse — ingestão privada de PDF v1

## Objetivo
Adicionar extração textual de PDFs ao mesmo fluxo já usado por TXT/CSV/JSON/MD/LOG, mantendo o documento no Storage privado e os chunks vinculados à indústria autenticada.

## Implementação
- `pulse-config.js` intercepta `File#text()` somente para PDFs.
- PDF.js `4.10.38` é carregado sob demanda no navegador.
- A extração ocorre localmente no browser e gera marcadores `[Página N]`.
- O fluxo existente de `app.html` continua responsável por criar `document_chunks` com `industry_id`.
- PDFs sem texto extraível continuam armazenados, mas não são falsamente marcados como indexados.

## Segurança
- Nenhuma chave de provedor de IA participa da extração.
- O conteúdo extraído só é persistido nos chunks privados protegidos por RLS.
- O Ask AI continua recebendo somente evidências recuperadas no contexto do usuário autenticado.

## Critérios de aceite
1. PDF textual gera pelo menos um chunk quando contém texto extraível.
2. O chunk mantém a referência de página no conteúdo.
3. TXT/CSV/JSON/MD/LOG continuam usando o `File#text()` nativo.
4. O documento permanece no Storage privado da indústria.
5. O navegador não contém `ANTHROPIC_API_KEY` ou `GEMINI_API_KEY`.
6. Falha do PDF.js não deve apagar o documento armazenado.

## Limitação v1
PDFs escaneados como imagem, sem camada textual, não geram texto nesta versão. OCR será uma etapa separada para evitar misturar extração textual determinística com reconhecimento visual.
