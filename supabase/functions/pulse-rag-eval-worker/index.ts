import { createClient } from 'npm:@supabase/supabase-js@2'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-pulse-cron','Access-Control-Allow-Methods':'POST,OPTIONS'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}})
const normalize=(v:string)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
const termsFor=(v:string)=>Array.from(new Set(normalize(v).split(/[^a-z0-9%$]+/).filter(t=>t.length>=2))).slice(0,12)
const key=(s:string)=>{try{const x=JSON.parse(s);return x.default||Object.values(x)[0]||''}catch{return ''}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'method_not_allowed'},405)
 const url=Deno.env.get('SUPABASE_URL'),sr=Deno.env.get('SUPABASE_SECRET_KEYS');if(!url||!sr)return json({error:'runtime_not_configured'},500)
 const admin=createClient(url,key(sr),{auth:{persistSession:false,autoRefreshToken:false}})
 const {data:authOk,error:authError}=await admin.rpc('verify_pulse_internal_token',{p_token:req.headers.get('x-pulse-cron')||'',p_name:'rag_eval_worker'});if(authError||authOk!==true)return json({error:'internal_auth_failed'},403)
 const {data:cases,error:ce}=await admin.from('rag_eval_cases').select('*');if(ce)return json({error:'cases_query_failed'},500);const {data:profiles,error:pe}=await admin.from('profiles').select('id,industry_id').order('created_at');if(pe)return json({error:'profiles_query_failed'},500)
 const profileByIndustry=new Map<string,string>();for(const p of profiles||[])if(!profileByIndustry.has(p.industry_id))profileByIndustry.set(p.industry_id,p.id)
 const results=[]
 for(const evalCase of cases||[]){const started=Date.now(),industryId=evalCase.industry_id,createdBy=profileByIndustry.get(industryId);if(!createdBy){results.push({case_id:evalCase.id,passed:false,error:'profile_not_found'});continue}
  const query=String(evalCase.query),terms=termsFor(query),expectedTerms=(evalCase.expected_terms||[]).map((x:string)=>normalize(x)),expectedDocs=(evalCase.expected_document_ids||[]) as string[]
  const fts=await admin.from('document_chunks').select('id,document_id,chunk_index,content,source_type').eq('industry_id',industryId).textSearch('search_vector',terms.join(' OR '),{type:'websearch',config:'simple'}).limit(80);let chunks=fts.data||[],retrievalError=fts.error
  if(retrievalError){const fallback=await admin.from('document_chunks').select('id,document_id,chunk_index,content,source_type').eq('industry_id',industryId).or(terms.map(t=>`content.ilike.%${t}%`).join(',')).limit(80);chunks=fallback.data||[];retrievalError=fallback.error}
  const ranked=(chunks||[]).map(c=>{const text=normalize(c.content||'');const score=terms.reduce((n,t)=>n+(text.includes(normalize(t))?1:0),0);return {...c,score}}).filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,8)
  const combined=ranked.map(c=>normalize(c.content||'')).join('\n'),termsFound=expectedTerms.filter(t=>combined.includes(t)).length,docsFound=expectedDocs.filter(id=>ranked.some(c=>c.document_id===id)).length,termRecall=expectedTerms.length?termsFound/expectedTerms.length:1,docRecall=expectedDocs.length?docsFound/expectedDocs.length:1
  let actualOutcome:'evidence'|'no_evidence'|'scope_rejected'|'retrieval_error'=retrievalError?'retrieval_error':'no_evidence';if(!retrievalError&&(termsFound>0||expectedDocs.length>0&&docsFound>0))actualOutcome='evidence'
  const passed=actualOutcome===evalCase.expected_outcome && (evalCase.expected_outcome==='no_evidence' ? termsFound===0 && docsFound===0 : termRecall===1 && docRecall===1),topScore=ranked[0]?.score??null,uniqueDocs=new Set(ranked.map(c=>c.document_id)).size
  const {data:run,error:re}=await admin.from('rag_eval_runs').insert({case_id:evalCase.id,industry_id:industryId,query,retrieved_count:ranked.length,top_score:topScore,unique_documents:uniqueDocs,expected_outcome:evalCase.expected_outcome,actual_outcome:actualOutcome,expected_terms_found:termsFound,expected_terms_total:expectedTerms.length,expected_documents_found:docsFound,expected_documents_total:expectedDocs.length,passed,latency_ms:Date.now()-started,created_by:createdBy}).select('id').single()
  results.push({case_id:evalCase.id,passed,run_id:run?.id||null,error:re?.message||null,term_recall:termRecall,document_recall:docRecall,retrieved_count:ranked.length,actual_outcome:actualOutcome})
 }
 return json({runs:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results})
})