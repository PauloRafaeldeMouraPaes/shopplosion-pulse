/*
 * Public Supabase browser configuration.
 * The publishable key is designed for browser use; never place privileged secrets here.
 */
window.PULSE_SUPABASE_CONFIG={
  url:'https://ppfuygnpgywfpiqxsfys.supabase.co',
  anonKey:'sb_publishable_aRzZJXmWvRu86J4I7_VFDw_ucU46Km7'
};

/*
 * Private-document PDF ingestion v1.
 * app.html already calls File#text() before creating tenant-scoped chunks.
 * For PDFs, transparently replace that read with local PDF.js text extraction.
 * The file is never sent to the LLM provider by this hook.
 */
(function(){
  if(typeof window==='undefined'||typeof File==='undefined'||!File.prototype||typeof File.prototype.text!=='function')return;
  const nativeText=File.prototype.text;
  const pdfPattern=/\.pdf$/i;
  let pdfjsPromise=null;
  const loadPdfJs=()=>{
    if(!pdfjsPromise){
      pdfjsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs').catch(error=>{
        pdfjsPromise=null;
        throw error;
      });
    }
    return pdfjsPromise;
  };
  const isPdf=file=>String(file?.type||'').toLowerCase()==='application/pdf'||pdfPattern.test(String(file?.name||''));
  const extractPdfText=async file=>{
    const pdfjs=await loadPdfJs();
    const buffer=await file.arrayBuffer();
    const loadingTask=pdfjs.getDocument({data:new Uint8Array(buffer),disableWorker:true});
    const pdf=await loadingTask.promise;
    const pages=[];
    for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
      const page=await pdf.getPage(pageNumber);
      const content=await page.getTextContent();
      const text=content.items.map(item=>String(item?.str||'')).join(' ').replace(/\s+/g,' ').trim();
      if(text)pages.push('[Página '+pageNumber+']\n'+text);
    }
    return pages.join('\n\n').trim();
  };
  File.prototype.text=function(){
    if(!isPdf(this))return nativeText.call(this);
    return extractPdfText(this);
  };
  window.PULSE_PDF_TEXT_EXTRACTION={
    enabled:true,
    library:'pdfjs-dist',
    version:'4.10.38',
    mode:'browser-local'
  };
})();
