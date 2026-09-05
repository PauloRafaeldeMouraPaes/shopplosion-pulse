import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  })

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const termsFor = (value: string) =>
  Array.from(new Set(normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length >= 2))).slice(0, 8)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'missing_authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableMap = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const model = Deno.env.get('PULSE_LLM_MODEL') || 'claude-sonnet-5'

  if (!supabaseUrl || !publishableMap) return json({ error: 'supabase_runtime_not_configured' }, 500)
  if (!anthropicKey) return json({ error: 'llm_provider_not_configured' }, 503)

  let publishableKey = ''
  try {
    const parsed = JSON.parse(publishableMap)
    publishableKey = parsed.default || Object.values(parsed)[0] || ''
  } catch {
    return json({ error: 'invalid_supabase_key_configuration' }, 500)
  }
  if (!publishableKey) return json({ error: 'missing_publishable_key' }, 500)

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'invalid_session' }, 401)

  let body: { query?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const query = String(body.query || '').trim().slice(0, 500)
  const terms = termsFor(query)
  if (!query || !terms.length) return json({ error: 'invalid_query', message: 'Digite uma pergunta válida.' }, 400)

  const filters = terms.map((term) => `content.ilike.%${term}%`).join(',')
  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('id,document_id,chunk_index,content,source_type,created_at')
    .or(filters)
    .limit(80)

  if (chunkError) return json({ error: 'retrieval_failed' }, 500)

  const score = (content: string) => {
    const text = normalize(content)
    return terms.reduce((total, term) => total + Math.max(0, text.split(term).length - 1), 0)
  }

  const ranked = (chunks || [])
    .map((chunk) => ({ ...chunk, score: score(chunk.content || '') }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)
    .slice(0, 8)

  if (!ranked.length) return json({ answer: 'Não encontrei evidências relevantes na base privada da sua indústria.', citations: [] })

  const documentIds = Array.from(new Set(ranked.map((chunk) => chunk.document_id)))
  const { data: documents, error: documentError } = await supabase
    .from('documents')
    .select('id,filename')
    .in('id', documentIds)
  if (documentError) return json({ error: 'document_lookup_failed' }, 500)

  const documentMap = Object.fromEntries((documents || []).map((document) => [document.id, document]))
  const evidence = ranked.map((chunk, index) => ({
    ref: `E${index + 1}`,
    document: documentMap[chunk.document_id]?.filename || 'Documento privado',
    chunk: Number(chunk.chunk_index) + 1,
    source_type: chunk.source_type || 'text',
    content: String(chunk.content || '').slice(0, 5000),
  }))

  const evidenceText = evidence
    .map((item) => `<evidence ref="${item.ref}" document="${item.document}" chunk="${item.chunk}" source="${item.source_type}">${item.content}</evidence>`)
    .join('\n')

  const system = `Você é o analista privado do Shopplosion Pulse. Responda em português do Brasil, de forma objetiva e analítica. Use SOMENTE as evidências fornecidas. Não invente números, fatos, fontes ou conclusões. Diferencie claramente FACT e INFERENCE quando houver inferência. Se as evidências não sustentarem a resposta, diga isso. Sempre cite as evidências usadas no formato [E1], [E2]. Não revele dados fora das evidências.`
  const prompt = `Pergunta do usuário: ${query}\n\nEvidências recuperadas da indústria autenticada:\n${evidenceText}\n\nProduza uma resposta curta, útil e verificável, citando cada afirmação relevante com [Ex].`

  const providerResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!providerResponse.ok) {
    const detail = await providerResponse.text()
    console.error('Anthropic request failed', providerResponse.status, detail.slice(0, 500))
    return json({ error: 'llm_provider_failed', provider_status: providerResponse.status }, 502)
  }

  const providerJson = await providerResponse.json()
  const answer = Array.isArray(providerJson?.content)
    ? providerJson.content.filter((block: any) => block?.type === 'text').map((block: any) => block.text).join('\n').trim()
    : ''

  if (!answer) return json({ error: 'empty_llm_response' }, 502)

  return json({
    answer,
    model,
    citations: evidence.map((item) => ({ ref: item.ref, document: item.document, chunk: item.chunk, source_type: item.source_type })),
  })
})
