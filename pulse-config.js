/* Pulse legacy indexing + PDF extraction configuration. */
/* Public Supabase browser configuration. */
window.PULSE_SUPABASE_CONFIG={url:'https://ppfuygnpgywfpiqxsfys.supabase.co',anonKey:'sb_publishable_aRzZJXmWvRu86J4I7_VFDw_ucU46Km7'};

(function(){
  if(typeof window==='undefined'||typeof File==='undefined'||!File.prototype||typeof File.prototype.text!=='function')return;
  const nativeText=File.prototype.text;
  const isPdf=file=>String(file?.type||'').toLowerCase()==='application/pdf'||/\.pdf$/i.test(String(file?.name||''));
  let pdfjsPromise=null;
  const loadPdfJs=()=>{
    if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
    if(!pdfjsPromise)pdfjsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
    return pdfjsPromise;
  };
  const extractPdfText=async file=>{
    const pdfjs=await loadPdfJs();
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),disableWorker:true}).promise;
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n);
      const content=await page.getTextContent();
      const text=content.items.map(item=>String(item?.str||'')).join(' ').replace(/\s+/g,' ').trim();
      if(text)pages.push('[Página '+n+']\n'+text);
    }
    return pages.join('\n\n').trim();
  };
  File.prototype.text=function(){return isPdf(this)?extractPdfText(this):nativeText.call(this)};
  window.PULSE_PDF_TEXT_EXTRACTION={enabled:true,library:'pdfjs-dist',version:'4.10.38',mode:'browser-local'};
})();

(function(){
  const run=async()=>{
    if(!document.getElementById('documents')||!window.supabase||!window.PULSE_SUPABASE_CONFIG)return;
    try{
      const client=window.supabase.createClient(window.PULSE_SUPABASE_CONFIG.url,window.PULSE_SUPABASE_CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const {data:{user},error:userError}=await client.auth.getUser();
      if(userError||!user)return;
      const {data:profile,error:profileError}=await client.from('profiles').select('industry_id').eq('id',user.id).single();
      if(profileError||!profile?.industry_id)return;
      const {data:docs,error:docsError}=await client.from('documents').select('id,filename,mime_type,storage_path').eq('industry_id',profile.industry_id).in('mime_type',['application/pdf','text/plain','text/csv','application/json','text/markdown']);
      if(docsError||!docs?.length)return;
      const {data:chunks}=await client.from('document_chunks').select('document_id').in('document_id',docs.map(d=>d.id));
      const indexed=new Set((chunks||[]).map(c=>c.document_id));
      const pending=docs.filter(d=>d.storage_path&&!indexed.has(d.id));
      if(!pending.length)return;
      let count=0;
      for(const doc of pending){
        try{
          const {data:file,error}=await client.storage.from('pulse-documents').download(doc.storage_path);
          if(error||!file)continue;
          const ext=String(doc.filename||'').toLowerCase().split('.').pop()||'';
          let text='';
          if(String(doc.mime_type||'').toLowerCase()==='application/pdf'||ext==='pdf')text=await extractPdfText(file);
          else{text=(await file.text()).replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ').trim();if(ext==='json'){try{text=JSON.stringify(JSON.parse(text),null,2)}catch{}}}
          if(!text){console.warn('PULSE_AUTO_INDEX_EMPTY',doc.id);continue;}
          const rows=[];for(let i=0;i<text.length;i+=1800){const content=text.slice(i,i+1800).trim();if(content)rows.push({industry_id:profile.industry_id,document_id:doc.id,chunk_index:rows.length,content,source_type:ext==='csv'?'csv':ext==='json'?'json':ext==='pdf'?'pdf':'text'})}
          if(!rows.length)continue;
          const {error:insertError}=await client.from('document_chunks').upsert(rows,{onConflict:'document_id,chunk_index',ignoreDuplicates:true});
          if(insertError){console.warn('PULSE_AUTO_INDEX_INSERT_FAILED',doc.id,insertError);continue;}
          count++;
        }catch(error){console.warn('PULSE_AUTO_INDEX_FAILED',doc.id,error)}
      }
      if(count){const message=document.getElementById('message');if(message){message.textContent=count+' documento(s) existente(s) foram indexados automaticamente.';message.className='msg show ok'}window.dispatchEvent(new CustomEvent('pulse:documents-indexed',{detail:{count}}));}
    }catch(error){console.warn('PULSE_AUTO_INDEX_INIT_FAILED',error)}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,900),{once:true});else setTimeout(run,900);
})();
