/* Shopplosion Pulse — study format extensions v2 */
(() => {
  'use strict';
  const DB='shopplosion-pulse-studies', STORE='studies', MAX_CHARS=18000;
  const IMAGE_TYPES=new Set(['image/png','image/jpeg','image/jpg','image/webp','image/gif']);
  const isPptx=f=>/\.pptx$/i.test(f.name)||f.type==='application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const isImage=f=>IMAGE_TYPES.has((f.type||'').toLowerCase())||/\.(png|jpe?g|webp|gif)$/i.test(f.name);
  const normalize=s=>String(s||'').replace(/\u0000/g,' ').replace(/\s+/g,' ').trim();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hash=async text=>{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');};
  const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB,2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const put=async item=>{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});};
  const getAll=async()=>{const db=await openDb();return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});};
  const refresh=()=>{window.PULSE_STUDY_REFRESH?.();window.dispatchEvent(new CustomEvent('pulse:studies-updated'));};
  const decode=b=>new TextDecoder('utf-8',{fatal:false}).decode(b);
  const u16=(v,o)=>v.getUint16(o,true), u32=(v,o)=>v.getUint32(o,true);
  async function unzipPptx(buffer){
    const bytes=new Uint8Array(buffer), view=new DataView(buffer), files=[];
    for(let o=0;o+30<=bytes.length;){
      if(u32(view,o)!==0x04034b50){o++;continue;}
      const method=u16(view,o+8), compSize=u32(view,o+18), nameLen=u16(view,o+26), extraLen=u16(view,o+28);
      const name=decode(bytes.subarray(o+30,o+30+nameLen)), start=o+30+nameLen+extraLen, end=start+compSize;
      if(end>bytes.length) break;
      files.push({name,method,data:bytes.slice(start,end)});o=end;
    }
    const out=new Map();
    for(const f of files){
      if(f.method===0) out.set(f.name,f.data);
      else if(f.method===8&&'DecompressionStream' in window){
        const ds=new DecompressionStream('deflate-raw');
        const stream=new Blob([f.data]).stream().pipeThrough(ds);
        out.set(f.name,new Uint8Array(await new Response(stream).arrayBuffer()));
      }
    }
    return out;
  }
  const xmlText=bytes=>decode(bytes).replace(/<a:t[^>]*>/gi,' ').replace(/<\/a:t>/gi,' ').replace(/<[^>]+>/g,' ');
  const extractPptx=async file=>{
    const zip=await unzipPptx(await file.arrayBuffer());
    const slides=[...zip.keys()].filter(n=>/^ppt\/slides\/slide\d+\.xml$/i.test(n)).sort((a,b)=>{
      const ma=a.match(/slide(\d+)/i),mb=b.match(/slide(\d+)/i),na=ma?Number(ma[1]):0,nb=mb?Number(mb[1]):0;return na-nb;
    });
    return normalize(slides.map((name,i)=>'Slide '+(i+1)+': '+normalize(xmlText(zip.get(name)))).join('\n')).slice(0,MAX_CHARS);
  };
  const imageDescriptor=async file=>{
    const buffer=await file.arrayBuffer(), bytes=new Uint8Array(buffer);
    const digest=await hash(new TextDecoder('latin1').decode(bytes.slice(0,Math.min(bytes.length,65536))));
    let dimensions='';
    try{const url=URL.createObjectURL(file),img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});dimensions=img.naturalWidth+'×'+img.naturalHeight;URL.revokeObjectURL(url);}catch(_){ }
    return 'Imagem fornecida pelo usuário. Dimensões: '+(dimensions||'não identificadas')+'. Evidência visual armazenada localmente; OCR não executado neste runtime. Fingerprint: '+digest;
  };
  const makeStudy=async(file,text,method,evidence)=>{const clean=normalize(text).slice(0,MAX_CHARS),id=await hash([file.name,file.size,clean].join('|'));const sentences=clean.split(/(?<=[.!?])\s+/).filter(s=>s.length>35).slice(0,8);return{id,name:file.name,type:file.type||'application/octet-stream',size:file.size,lastModified:file.lastModified,summary:{excerpt:clean,sentences,keywords:[],topics:[],claims:sentences.map((text,i)=>({id:'claim-'+(i+1),text,topics:[],polarity:'neutral',type:'observed-text',support:evidence})),chars:clean.length,extraction:method},processedAt:new Date().toISOString(),provenance:{sourceName:file.name,extractionMethod:method,evidenceType:evidence,confidence:method==='pptx-text'?'descriptive':'visual-reference'}};};
  const notice=(file,method)=>{const host=document.querySelector('#pulse-study-intelligence');if(!host)return;const msg=method==='pptx-text'?'PPTX processado localmente: texto das lâminas foi extraído sem envio externo.':'Imagem processada como evidência visual local. OCR não está disponível neste runtime; nenhum texto foi inventado.';const node=document.createElement('div');node.style.cssText='margin-top:8px;padding:8px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;';node.innerHTML='<b>'+esc(file.name)+'</b> — '+esc(msg);host.appendChild(node);};
  const processSpecial=async file=>{const pptx=isPptx(file),image=isImage(file);if(!pptx&&!image)return false;try{const text=pptx?await extractPptx(file):await imageDescriptor(file);const study=await makeStudy(file,text,pptx?'pptx-text':'visual-reference',pptx?'user-provided-study':'user-provided-image');await put(study);window.PULSE_STUDIES=await getAll();window.PULSE_ACTIVE_STUDY_CONTEXT=typeof window.PULSE_STUDY_CONTEXT==='function'?window.PULSE_STUDY_CONTEXT():'';notice(file,pptx?'pptx-text':'visual-reference');refresh();return true;}catch(err){console.error('[Pulse Study Formats]',err);return false;}};
  window.addEventListener('change',async e=>{const input=e.target;if(!(input instanceof HTMLInputElement)||input.id!=='pulse-files'||!input.files?.length)return;const special=[...input.files].filter(f=>isPptx(f)||isImage(f));if(!special.length)return;e.stopImmediatePropagation();e.preventDefault();for(const file of special)await processSpecial(file);},true);
  window.PULSE_STUDY_FORMATS={pptx:true,imageVisualReference:true,ocr:false};
})();
