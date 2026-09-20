(()=>{
if(window.__PULSE_CONDUCAO_LOADED)return;window.__PULSE_CONDUCAO_LOADED=true;
'use strict';
// Fase 3 (Estados e condução): uma recomendação por vez, com motivo baseado em
// dado real e dispensa fácil. Silêncio de 30 dias após três dispensas do MESMO
// motivo. Se nenhum estado tiver ação clara, nada é mostrado (sem faixa).
// Este módulo não inventa dado: só usa contagens reais do escopo autenticado
// (documents, document_chunks, evidence). "Hipóteses abertas" e "respostas sem
// análise" citadas na proposta não têm fonte de dado hoje e ficam de fora até
// existir uma tabela/local que sustente o número.

const STORAGE_KEY='pulse_conducao_dismissals_v1';
const SILENCE_DAYS=30;
const DISMISS_LIMIT=3;

function readDismissals(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return{}}}
function writeDismissals(v){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(v))}catch{}}
function isSilenced(key){
  const all=readDismissals();const entry=all[key];
  if(!entry||!entry.count)return false;
  if(entry.count<DISMISS_LIMIT)return false;
  const elapsedDays=(Date.now()-new Date(entry.lastDismissedAt).getTime())/86400000;
  if(elapsedDays>=SILENCE_DAYS){delete all[key];writeDismissals(all);return false}
  return true;
}
function registerDismissal(key){
  const all=readDismissals();const entry=all[key]||{count:0,lastDismissedAt:null};
  entry.count+=1;entry.lastDismissedAt=new Date().toISOString();all[key]=entry;writeDismissals(all);
}

async function getSession(client,cfg){
  const current=await client.auth.getSession();
  if(current.data?.session)return current.data.session;
  try{
    const storageKey='sb-'+new URL(cfg.url).hostname.split('.')[0]+'-auth-token';
    const stored=JSON.parse(localStorage.getItem(storageKey)||'null');
    const accessToken=stored?.access_token||stored?.currentSession?.access_token;
    const refreshToken=stored?.refresh_token||stored?.currentSession?.refresh_token;
    if(accessToken&&refreshToken){
      const restored=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
      if(!restored.error&&restored.data?.session)return restored.data.session;
    }
  }catch{}
  return null;
}

async function fetchIndustryContext(cfg,session){
  const r=await fetch(cfg.url+'/functions/v1/pulse-auth-broker',{method:'POST',headers:{apikey:cfg.anonKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Origin':location.origin},body:JSON.stringify({action:'industry_context',access_token:session.access_token}),cache:'no-store'});
  const body=await r.json().catch(()=>null);
  if(!r.ok)throw new Error('broker_http_'+r.status);
  return Array.isArray(body)?body[0]:body;
}

async function computeSignal(client,industryId){
  // 1) documentos pendentes de indexação (sem nenhum bloco em document_chunks).
  const {count:totalDocs}=await client.from('documents').select('id',{count:'exact',head:true}).eq('industry_id',industryId);
  const {data:docsList}=await client.from('documents').select('id').eq('industry_id',industryId).limit(2000);
  const ids=(docsList||[]).map(d=>d.id);
  let indexedIds=new Set();
  if(ids.length){
    const {data:chunkDocs}=await client.from('document_chunks').select('document_id').eq('industry_id',industryId).in('document_id',ids);
    indexedIds=new Set((chunkDocs||[]).map(c=>c.document_id));
  }
  const pendentes=ids.filter(id=>!indexedIds.has(id)).length;
  if(pendentes>0){
    return{key:'documentos_pendentes',text:pendentes===1?'1 documento está aguardando indexação: sem isso, ele não vira evidência.':pendentes+' documentos estão aguardando indexação: sem isso, eles não viram evidência.',cta:'Indexar na Base',href:'./app.html?v=20260919.31#documents'};
  }
  if(!totalDocs){
    return{key:'base_vazia',text:'Sua base ainda não tem nenhum documento. Adicione um para começar a extrair evidências.',cta:'Adicionar documento',href:'./app.html?v=20260919.31#documents'};
  }
  // 2) evidências qualificadas novas (últimos 7 dias) que ainda não foram usadas em nenhuma análise salva.
  const since=new Date(Date.now()-7*86400000).toISOString();
  const {count:novas}=await client.from('evidence').select('id',{count:'exact',head:true}).eq('industry_id',industryId).gte('created_at',since);
  if(novas){
    return{key:'evidencias_novas',text:novas===1?'1 evidência nova foi qualificada nos últimos 7 dias.':novas+' evidências novas foram qualificadas nos últimos 7 dias.',cta:'Ver na Investigação',href:'./ask.html?v=20260919.31'};
  }
  return null;
}

function render(signal){
  if(document.querySelector('.pulse-conducao'))return;
  const host=document.querySelector('.pv3-frame')||document.querySelector('main');
  if(!host)return;
  const bar=document.createElement('div');
  bar.className='pulse-conducao';
  bar.setAttribute('role','status');
  bar.innerHTML='<div class="pulse-conducao-text">'+signal.text.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))+'</div><div class="pulse-conducao-actions"><a class="pulse-conducao-cta" href="'+signal.href+'">'+signal.cta+'</a><button type="button" class="pulse-conducao-dismiss">Dispensar</button></div>';
  host.insertBefore(bar,host.firstChild);
  bar.querySelector('.pulse-conducao-dismiss').addEventListener('click',()=>{registerDismissal(signal.key);bar.remove()});
}

async function init(){
  const cfg=window.PULSE_SUPABASE_CONFIG||{};
  if(!cfg.url||!cfg.anonKey||!window.supabase?.createClient)return;
  const client=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const session=await getSession(client,cfg).catch(()=>null);
  if(!session)return;
  let context=null;
  try{context=await fetchIndustryContext(cfg,session)}catch{return}
  if(!context?.industry_id||context.industry_status!=='active')return;
  let signal=null;
  try{signal=await computeSignal(client,context.industry_id)}catch(e){console.error('pulse-conducao',e);return}
  if(!signal)return;
  if(isSilenced(signal.key))return;
  render(signal);
}

const start=()=>{init().catch(()=>{})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
// A Base e o Universo são montados de forma assíncrona pelo Workspace V3;
// tenta novamente depois que o app.pv3 existir, sem duplicar a faixa.
let attempts=0;
const retry=setInterval(()=>{attempts+=1;if(document.querySelector('.pulse-conducao')||attempts>20){clearInterval(retry);return}if(document.querySelector('.pv3-frame'))start()},250);
})();
