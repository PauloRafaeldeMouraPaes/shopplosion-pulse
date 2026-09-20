import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } })
const normalize = (value: string) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const termsFor = (value: string) => Array.from(new Set(normalize(value).split(/[^a-z0-9]+/).filter((term) => term.length >= 2))).slice(0, 8)

const providerMessage = (status: number, raw: string) => {
  let message = ''
  try { const parsed = JSON.parse(raw); message = String(parsed?.error?.message || parsed?.message || '') } catch {}
  if (status === 401 || status === 403) return 'A chave Gemini foi recusada. Verifique se ela está ativa e vinculada ao projeto correto.'
  if (status === 429) return 'O limite gratuito do Gemini foi atingido. Aguarde a renovação da cota e tente novamente.'
  if (status === 400) return message ? `O Gemini recusou a solicitação: ${message}` : 'O Gemini recusou a solicitação. Verifique o projeto, a chave e o modelo configurado.'
  return message ? `O Gemini retornou um erro: ${message}` : `O Gemini retornou HTTP ${status}.`
}

const industryNameMatches = (text: string, currentIndustry: string, allIndustryNames: string[]) => {
  const normalizedText = normalize(text)
  const current = normalize(currentIndustry)
  return allIndustryNames
    .map((name) => normalize(name))
    .filter((name) => name && name !== current)
    .some((other) => normalizedText.includes(other))
}

const foreignIndustryMention = (query: string, currentIndustry: string, allIndustryNames: string[]) =>
  industryNameMatches(query, currentIndustry, allIndustryNames)

const foreignIndustryInAnswer = (answer: string, currentIndustry: string, allIndustryNames: string[]) =>
  industryNameMatches(answer, currentIndustry, allIndustryNames)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'missing_authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableMap = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const model = Deno.env.get('PULSE_LLM_MODEL') || 'gemini-2.5-flash-lite'
  if (!supabaseUrl || !publishableMap) return json({ error: 'supabase_runtime_not_configured' }, 500)
  if (!geminiKey) return json({ error: 'llm_provider_not_configured' }, 503)

  let publishableKey = ''
  try { const parsed = JSON.parse(publishableMap); publishableKey = parsed.default || Object.values(parsed)[0] || '' } catch { return json({ error: 'invalid_supabase_key_configuration' }, 500) }
  if (!publishableKey) return json({ error: 'missing_publishable_key' }, 500)

  const supabase = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'invalid_session' }, 401)

  const { data: profile, error: profileError } = await supabase.from('profiles').select('industry_id').eq('id', userData.user.id).single()
  if (profileError || !profile?.industry_id) return json({ error: 'profile_not_found' }, 403)
  const { data: industry, error: industryError } = await supabase.from('industries').select('id,name,status').eq('id', profile.industry_id).single()
  if (industryError || !industry || industry.status !== 'active') return json({ error: 'industry_not_active' }, 403)
  const { data: industries, error: industriesError } = await supabase.from('industries').select('name').eq('status', 'active')
  if (industriesError) return json({ error: 'industry_scope_lookup_failed' }, 500)
  const allIndustryNames = (industries || []).map((item) => String(item.name || '')).filter(Boolean)

  let body: { query?: string, scope?: string, public_evidence?: any[] }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const query = String(body.query || '').trim().slice(0, 500)
  const scope = ['industry','universe','both'].includes(String(body.scope || 'industry')) ? String(body.scope || 'industry') : 'industry'
  const publicEvidence = Array.isArray(body.public_evidence) ? body.public_evidence.slice(0, 20) : []
  const terms = termsFor(query)
  if (!query || !terms.length) return json({ error: 'invalid_query', message: 'Digite uma pergunta válida.' }, 400)

  const filters = terms.map((term) => `content.ilike.%${term}%`).join(',')
  let ranked: any[] = []
  let documentMap: Record<string,string> = {}
  if (scope !== 'universe') {
    const { data: chunks, error: chunkError } = await supabase
      .from('document_chunks')
      .select('id,document_id,chunk_index,content,source_type,created_at')
      .eq('industry_id', profile.industry_id)
      .or(filters)
      .limit(80)
    if (chunkError) return json({ error: 'retrieval_failed', message: 'Falha ao recuperar as evidências privadas.' }, 500)
    const score = (content: string) => { const text = normalize(content); return terms.reduce((total, term) => total + Math.max(0, text.split(term).length - 1), 0) }
    const privateRanked = (chunks || []).map((chunk) => ({ ...chunk, score: score(chunk.content || ''), scope_source: 'private' })).filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index).slice(0, 8)
    const documentIds = Array.from(new Set(privateRanked.map((chunk) => chunk.document_id)))
    if (documentIds.length) {
      const { data: documents, error: documentError } = await supabase.from('documents').select('id,filename').eq('industry_id', profile.industry_id).in('id', documentIds)
      if (documentError) return json({ error: 'document_lookup_failed', message: 'As evidências foram encontradas, mas os documentos não puderam ser identificados.' }, 500)
      documentMap = Object.fromEntries((documents || []).map((document) => [document.id, document.filename]))
    }
    ranked = privateRanked
  }
  if (scope !== 'industry') {
    const score = (content: string) => { const text = normalize(content); return terms.reduce((total, term) => total + Math.max(0, text.split(term).length - 1), 0) }
    const publicRanked = publicEvidence.map((item: any) => {
      const content = [item.fato, item.contexto, item.interpretacao, item.hipotese, item.acao, ...(Array.isArray(item.keywords) ? item.keywords : [])].filter(Boolean).join(' ')
      return { id: item.id, document_id: null, chunk_index: 0, content, source_type: 'public', created_at: item.periodo || '', score: score(content), scope_source: 'public', public_evidence_id: item.id, public_source: item.fonte || 'Mercado publicado' }
    }).filter((item: any) => item.score > 0).sort((a: any, b: any) => b.score - a.score).slice(0, 8)
    ranked = scope === 'both' ? [...ranked, ...publicRanked].sort((a, b) => b.score - a.score).slice(0, 12) : publicRanked
  }
  if (!ranked.length) return json({ answer: scope === 'universe' ? 'Não encontrei evidências relevantes no mercado publicado para esta pergunta.' : 'Não encontrei evidências relevantes no escopo selecionado.', citations: [], scope })
  const evidence = ranked.map((item, index) => {
    if (item.scope_source === 'public') return { ref: `E${index + 1}`, document: `Mercado publicado · ${item.public_evidence_id || 'evidência'}`, document_id: null, document_chunk_id: null, chunk: 1, source_type: 'public', public_evidence_id: item.public_evidence_id, content: String(item.content || '').slice(0, 5000) }
    return { ref: `E${index + 1}`, document: documentMap[item.document_id] || 'Documento privado', document_id: item.document_id, document_chunk_id: item.id, chunk: Number(item.chunk_index) + 1, source_type: item.source_type || 'text', content: String(item.content || '').slice(0, 5000) }
  })
  const evidenceText = evidence.map((item) => `<evidence ref="${item.ref}" document="${item.document}" chunk="${item.chunk}" source="${item.source_type}">${item.content}</evidence>`).join('\n')

  const system = 'Você é o analista do Shopplosion Pulse. Responda em português do Brasil, de forma objetiva e analítica. Use SOMENTE as evidências fornecidas. Não invente números, fatos, fontes ou conclusões. Diferencie claramente FACT e INFERENCE quando houver inferência. Se as evidências não sustentarem a resposta, diga isso. Sempre cite as evidências usadas no formato [E1], [E2]. Em escopo privado, nunca revele dados fora da indústria autenticada. Em escopo público, trate as evidências como mercado publicado. Em escopo combinado, diferencie claramente o que vem do mercado publicado e o que vem da indústria autenticada.'
  const prompt = `Pergunta do usuário: ${query}\n\nEscopo selecionado: ${scope}\n\nIndústria autenticada: ${industry.name}\n\nEvidências recuperadas conforme o escopo:\n${evidenceText}\n\nProduza uma resposta curta, útil e verificável, citando cada afirmação relevante com [Ex].`
  const providerResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 700 } }) })
  if (!providerResponse.ok) { const detail = await providerResponse.text(); return json({ error: 'llm_provider_failed', provider_status: providerResponse.status, message: providerMessage(providerResponse.status, detail) }, 502) }
  const providerJson = await providerResponse.json()
  const answer = Array.isArray(providerJson?.candidates?.[0]?.content?.parts) ? providerJson.candidates[0].content.parts.filter((part: any) => typeof part?.text === 'string').map((part: any) => part.text).join('\n').trim() : ''
  if (!answer) return json({ error: 'empty_llm_response' }, 502)
  if (scope !== 'universe' && foreignIndustryInAnswer(answer, industry.name, allIndustryNames)) {
    return json({
      answer: 'A resposta foi bloqueada porque o modelo tentou mencionar uma indústria fora do escopo autenticado. Nenhum dado de outra indústria foi retornado.',
      citations: [],
      scope_rejected: true,
    }, 200)
  }
  return json({ answer, model, scope, citations: evidence.map((item) => ({ ref: item.ref, document: item.document, document_id: item.document_id, document_chunk_id: item.document_chunk_id, chunk: item.chunk, source_type: item.source_type, public_evidence_id: item.public_evidence_id || null })) })
})
