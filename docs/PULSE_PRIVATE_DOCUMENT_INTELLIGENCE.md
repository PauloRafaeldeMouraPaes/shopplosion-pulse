# Pulse — Inteligência Privada de Documentos v1

## Objetivo
Criar a camada tenant-scoped que transforma documentos textuais privados em blocos recuperáveis para o futuro Ask AI privado, sem misturar dados entre indústrias.

## Escopo v1
- Persistir `document_chunks` com `industry_id` e `document_id`.
- Extrair texto no navegador apenas de `.txt`, `.csv`, `.json` e tipos textuais equivalentes.
- Dividir conteúdo em blocos determinísticos de tamanho limitado.
- Manter PDFs, XLS/XLSX, DOC/DOCX e imagens como `armazenado, ainda não extraído` até existir um extrator apropriado.
- Aplicar RLS em `document_chunks` e validar que o documento pai pertence à indústria autenticada.

## Não escopo
- Nenhum LLM ainda.
- Nenhuma chave de provedor de IA no navegador.
- Nenhum OCR.
- Nenhum parser proprietário para Office/PDF nesta etapa.
- Nenhuma alteração no Universo Pulse público.

## Contrato de segurança
1. `industry_id` é persistido no chunk.
2. RLS restringe leitura/escrita à indústria autenticada.
3. Inserção exige documento pai pertencente à mesma indústria.
4. O frontend nunca é a autoridade final de isolamento.
5. Dados privados não são copiados para `index.html` nem para tabelas públicas.

## Estados de ingestão exibidos ao usuário
- `indexado`: conteúdo textual foi extraído e dividido em chunks.
- `armazenado`: arquivo privado foi salvo, mas ainda não possui extrator compatível.
- `erro`: arquivo foi salvo, porém a indexação textual falhou.

## Critério para o próximo estágio
Antes de conectar Ask AI, deve existir teste A-vs-B que prove que um usuário de A não consegue consultar chunks de B, inclusive por `document_id`.
