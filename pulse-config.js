/* Pulse legacy indexing + PDF extraction configuration. */
/* Indexing strategy: secure Edge Function for text-like documents first; browser-local PDF fallback second. */
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
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let running=false;
  const run=async()=>{
    if(running||typeof document==='undefined'||!window.PULSE_SUPABASE_CONFIG)return;
    running=true;
    try{
      const waitFor=async(name,timeout=12000)=>{const started=Date.now();while(!window[name]&&Date.now()-started<timeout)await sleep(100);return window[name]};
      const waitForUser=async(client,timeout=12000)=>{const started=Date.now();while(Date.now()-started<timeout){const {data,error}=await client.auth.getUser();if(!error&&data?.user)return data.user;await sleep(250)}return null};
      const supabase=await waitFor('supabase');
      if(!supabase)return;
      const hasDocuments=!!document.getElementById('documents');
      if(!hasDocuments)return;
      const client=supabase.createClient(window.PULSE_SUPABASE_CONFIG.url,window.PULSE_SUPABASE_CONFIG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const user=await waitForUser(client);
      if(!user)return;
      const {data:profile,error:profileError}=await client.from('profiles').select('industry_id').eq('id',user.id).single();
      if(profileError||!profile?.industry_id)return;
      const message=document.getElementById('message');
      if(message){message.textContent='Verificando indexação dos documentos...';message.className='msg show';}
      let remoteIndexed=0;
      let remotePending=0;
      let remoteSkipped=0;
      try{
        const {data:remote,error:remoteError}=await client.functions.invoke('pulse-index-pending',{body:{}});
        if(!remoteError){remoteIndexed=Number(remote?.indexed||0);remotePending=Number(remote?.pending||0);remoteSkipped=Number(remote?.skipped||0)}
        else console.warn('PULSE_REMOTE_INDEX_FAILED',remoteError);
      }catch(error){console.warn('PULSE_REMOTE_INDEX_FAILED',error)}
      const {data:docs,error:docsError}=await client.from('documents').select('id,filename,mime_type,storage_path').eq('industry_id',profile.industry_id);
      if(docsError||!docs?.length){
        if(remoteIndexed&&message){message.textContent=remoteIndexed+' documento(s) existente(s) foram indexados automaticamente.';message.className='msg show ok'}
        if(remoteIndexed)window.dispatchEvent(new CustomEvent('pulse:documents-indexed',{detail:{count:remoteIndexed}}));
        return;
      }
      const compatible=docs.filter(d=>{const mime=String(d.mime_type||'').toLowerCase();const ext=String(d.filename||'').toLowerCase().split('.').pop()||'';return ['application/pdf','text/plain','text/csv','application/json','text/markdown'].includes(mime)||['pdf','txt','csv','json','md','log'].includes(ext)});
      const {data:chunks}=await client.from('document_chunks').select('document_id').in('document_id',compatible.map(d=>d.id));
      const indexed=new Set((chunks||[]).map(c=>c.document_id));
      const pending=compatible.filter(d=>d.storage_path&&!indexed.has(d.id));
      if(!pending.length){
        if(remoteIndexed&&message){message.textContent=remoteIndexed+' documento(s) existente(s) foram indexados automaticamente.';message.className='msg show ok'}
        else if(message){message.textContent='Indexação verificada: nenhum documento compatível pendente.';message.className='msg show ok'}
        if(remoteIndexed)window.dispatchEvent(new CustomEvent('pulse:documents-indexed',{detail:{count:remoteIndexed}}));
        return;
      }
      let count=remoteIndexed;
      for(const doc of pending){
        try{
          const ext=String(doc.filename||'').toLowerCase().split('.').pop()||'';
          if(String(doc.mime_type||'').toLowerCase()!=='application/pdf'&&ext!=='pdf')continue;
          const {data:file,error}=await client.storage.from('pulse-documents').download(doc.storage_path);
          if(error||!file)continue;
          const text=await extractPdfText(file);
          if(!text){console.warn('PULSE_AUTO_INDEX_EMPTY',doc.id);continue;}
          const rows=[];for(let i=0;i<text.length;i+=1800){const content=text.slice(i,i+1800).trim();if(content)rows.push({industry_id:profile.industry_id,document_id:doc.id,chunk_index:rows.length,content,source_type:'pdf'})}
          if(!rows.length)continue;
          const {error:insertError}=await client.from('document_chunks').upsert(rows,{onConflict:'document_id,chunk_index',ignoreDuplicates:true});
          if(insertError){console.warn('PULSE_AUTO_INDEX_INSERT_FAILED',doc.id,insertError);continue;}
          count++;
        }catch(error){console.warn('PULSE_AUTO_INDEX_FAILED',doc.id,error)}
      }
      if(count){
        if(message){message.textContent=count+' documento(s) existente(s) foram indexados automaticamente.';message.className='msg show ok'}
        window.dispatchEvent(new CustomEvent('pulse:documents-indexed',{detail:{count}}));
      }else if(message){
        message.textContent=remoteSkipped?'Há documentos pendentes que não puderam ser indexados automaticamente; consulte a lista abaixo.':'Há documentos compatíveis pendentes de indexação.';
        message.className='msg show';
      }
    }catch(error){console.warn('PULSE_AUTO_INDEX_INIT_FAILED',error)}
    finally{running=false}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.addEventListener('focus',()=>run());
  window.addEventListener('pageshow',()=>run());
  setInterval(run,30000);
})();
