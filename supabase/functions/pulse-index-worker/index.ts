import { createClient } from 'npm:@supabase/supabase-js@2'
import * as pdfjsLib from 'npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})
const key=(s:string)=>{try{const x=JSON.parse(s);return x.default||Object.values(x)[0]||''}catch{return ''}}
const textLike=(mime:string,name:string)=>{
  const m=String(mime||'').toLowerCase(),n=String(name||'').toLowerCase()
  return ['text/plain','text/csv','application/json','text/markdown'].includes(m)||/\.(txt|csv|json|md)$/i.test(n)
}
const chunk=(text:string,size=1800)=>{const out:string[]=[];for(let i=0;i<text.length;i+=size)out.push(text.slice(i,i+size));return out.filter(Boolean)}
const pdfText=async(bytes:ArrayBuffer)=>{
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(bytes),disableWorker:true}).promise
  let text=''
  for(let p=1;p<=doc.numPages;p++){
    const page=await doc.getPage(p);const tc=await page.getTextContent();text+=tc.items.map((x:any)=>String(x.str||'')).join(' ')+'\n'
  }
  return text.trim()
}

Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const presented=req.headers.get('x-pulse-cron')||''
  const url=Deno.env.get('SUPABASE_URL'),secretKeys=Deno.env.get('SUPABASE_SECRET_KEYS')
  if(!url||!secretKeys)return json({error:'runtime_not_configured'},500)
  const secret=key(secretKeys);if(!secret)return json({error:'secret_unavailable'},500)
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:authOk,error:authError}=await admin.rpc('verify_pulse_internal_token',{p_token:presented,p_name:'index_worker'})
  if(authError||authOk!==true)return json({error:'internal_auth_failed'},403)
  const {data:docs,error:docsError}=await admin.from('documents').select('id,industry_id,storage_path,filename,mime_type').order('created_at',{ascending:true})
  if(docsError)return json({error:'documents_query_failed'},500)
  let indexed=0,skipped=0,pending=0
  const results=[]
  for(const d of docs||[]){
    const {count}=await admin.from('document_chunks').select('id',{count:'exact',head:true}).eq('document_id',d.id)
    if((count||0)>0){skipped++;continue}
    try{
      const {data:file,error:downloadError}=await admin.storage.from('pulse-documents').download(d.storage_path)
      if(downloadError||!file)throw new Error('STORAGE_DOWNLOAD_FAILED')
      let content=''
      const mime=String(d.mime_type||'').toLowerCase()
      if(mime==='application/pdf'||/\.pdf$/i.test(d.filename||'')) content=await pdfText(await file.arrayBuffer())
      else if(textLike(mime,d.filename)) content=await file.text()
      else {skipped++;results.push({document_id:d.id,status:'unsupported'});continue}
      if(!content.trim())throw new Error('PDF_TEXT_EMPTY_OCR_REQUIRED')
      const pieces=chunk(content)
      const rows=pieces.map((content,chunk_index)=>({industry_id:d.industry_id,document_id:d.id,chunk_index,content,source_type:mime==='application/pdf'?'pdf':'text'}))
      const {error:upsertError}=await admin.from('document_chunks').upsert(rows,{onConflict:'document_id,chunk_index'})
      if(upsertError)throw new Error('CHUNK_UPSERT_FAILED')
      indexed++;results.push({document_id:d.id,status:'indexed',chunks:rows.length})
    }catch(e){pending++;results.push({document_id:d.id,status:'pending',error:e instanceof Error?e.message:'INDEX_FAILED'})}
  }
  return json({indexed,pending,skipped,results})
})
