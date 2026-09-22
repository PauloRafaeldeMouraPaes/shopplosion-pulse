import { createClient } from 'npm:@supabase/supabase-js@2'

const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' }
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}})

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return json({error:'method_not_allowed'},405)
  const authorization=req.headers.get('Authorization')
  if(!authorization?.startsWith('Bearer ')) return json({error:'missing_authorization'},401)
  const supabaseUrl=Deno.env.get('SUPABASE_URL')
  const keys=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if(!supabaseUrl||!keys) return json({error:'runtime_not_configured'},500)
  let publishableKey=''
  try{const parsed=JSON.parse(keys);publishableKey=parsed.default||Object.values(parsed)[0]||''}catch{return json({error:'invalid_key_configuration'},500)}
  const supabase=createClient(supabaseUrl,publishableKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:userData,error:userError}=await supabase.auth.getUser()
  if(userError||!userData.user) return json({error:'invalid_session'},401)
  const {data:profile,error:profileError}=await supabase.from('profiles').select('industry_id').eq('id',userData.user.id).single()
  if(profileError||!profile?.industry_id) return json({error:'profile_not_found'},403)
  let body:any
  try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const e=body?.evidence||{}
  const evidenceId=String(e.id||'').trim()
  if(!evidenceId) return json({error:'missing_evidence_id'},400)
  const row={industry_id:profile.industry_id,created_by:userData.user.id,evidence_id:evidenceId,title:String(e.title||e.fato||'Evidência').slice(0,500),category:String(e.categoria||'').slice(0,200),fact:String(e.fato||'').slice(0,5000),source:String(e.fonte||e.source||'').slice(0,1000),context:String(e.contexto||'').slice(0,5000),interpretation:String(e.interpretacao||'').slice(0,5000),hypothesis:String(e.hipotese||'').slice(0,5000),action:String(e.acao||'').slice(0,5000),period:String(e.periodo||'').slice(0,200),confidence:String(e.confianca||'').slice(0,100),payload:e}
  const {data,error}=await supabase.from('saved_evidence').upsert(row,{onConflict:'industry_id,created_by,evidence_id'}).select('id,evidence_id,created_at').single()
  if(error) return json({error:'save_failed',message:'Não foi possível guardar a evidência.'},500)
  return json({saved:true,data})
})