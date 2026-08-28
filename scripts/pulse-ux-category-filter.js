(function(){
  'use strict';
  var TAXONOMY={
    chocolates:{label:'Chocolates',ids:['premium','indulgencia-seletiva']},
    bebidas:{label:'Bebidas',ids:['ocasiao']},
    saude:{label:'Saúde & bem-estar',ids:['saude-bemestar']},
    geral:{label:'Visão transversal',ids:['canal','pack','promocao','frequencia','confianca-financeira','varejo-geral','scanntech-radar']}
  };
  var OPTIONS=[['all','Todas as categorias'],['chocolates','Chocolates'],['bebidas','Bebidas'],['saude','Saúde & bem-estar'],['geral','Visão transversal']];
  function q(s,r){return(r||document).querySelector(s)}
  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function categoryFor(id){for(var k in TAXONOMY)if(TAXONOMY[k].ids.indexOf(id)!==-1)return k;return'geral'}
  function labelFor(k){return k==='all'?'Todas as categorias':TAXONOMY[k]?TAXONOMY[k].label:k}
  function ensureContext(){
    var select=q('#pulse-category-select'); if(!select)return null;
    var host=q('#pulse-category-context');
    if(!host){
      host=document.createElement('div'); host.id='pulse-category-context'; host.setAttribute('role','status');
      var header=select.closest('header')||select.parentElement;
      if(header&&header.parentElement)header.parentElement.insertBefore(host,header.nextSibling); else document.body.insertBefore(host,document.body.firstChild);
    }
    return host;
  }
  function ensureEmpty(root,category){
    var box=root.parentElement.querySelector('.pulse-category-empty');
    if(!box){box=document.createElement('div');box.className='pulse-category-empty';root.parentElement.insertBefore(box,root)}
    box.innerHTML='<strong>Sem evidência específica nesta tela</strong><span>A categoria <b>'+labelFor(category)+'</b> ainda não possui evidência específica aqui. A visão transversal continua disponível em “Visão transversal”.</span>';
    box.hidden=false;
  }
  function apply(){
    var select=q('#pulse-category-select');if(!select)return;
    var chosen=select.value||'all';
    try{localStorage.setItem('pulsePrimaryCategory',chosen)}catch(e){}
    var allCards=qa('main [data-evidence-id]');
    var specific=0,shown=0;
    allCards.forEach(function(card){
      var category=categoryFor(card.getAttribute('data-evidence-id'));
      var isSpecific=chosen!=='all'&&category===chosen;
      var visible=chosen==='all'||isSpecific;
      card.classList.toggle('pulse-category-hidden',!visible);
      card.classList.toggle('pulse-category-match',isSpecific);
      card.dataset.pulseCategory=category;
      if(isSpecific)specific++;
      if(visible)shown++;
      var badge=card.querySelector(':scope > .pulse-category-badge');
      if(!badge){badge=document.createElement('span');badge.className='pulse-category-badge';card.insertBefore(badge,card.firstChild)}
      badge.textContent=chosen!=='all'&&isSpecific?'DA SUA CATEGORIA':(category==='geral'?'VISÃO TRANSVERSAL':TAXONOMY[category].label.toUpperCase());
      badge.classList.toggle('is-specific',isSpecific);badge.classList.toggle('is-general',!isSpecific);
    });
    qa('main .screen').forEach(function(screen){
      var cards=qa('[data-evidence-id]',screen),specificCards=cards.filter(function(c){return!c.classList.contains('pulse-category-hidden')});
      var empty=screen.querySelector('.pulse-category-empty');
      if(chosen!=='all'&&cards.length&&specificCards.length===0)ensureEmpty(cards[0].parentElement,chosen);
      else if(empty)empty.hidden=true;
    });
    var context=ensureContext();
    if(context){
      if(chosen==='all')context.innerHTML='<strong>Todas as categorias</strong><span>Visão completa do mercado.</span>';
      else if(specific===0)context.innerHTML='<strong>'+labelFor(chosen)+'</strong><span>Filtro aplicado. Ainda não há evidência específica cadastrada para esta categoria; o Pulse não inventa dados.</span>';
      else context.innerHTML='<strong>'+labelFor(chosen)+'</strong><span>Filtro aplicado · '+specific+' evidência(s) específica(s) exibida(s).</span>';
      context.dataset.category=chosen;context.hidden=false;
    }
    document.body.dataset.pulseCategory=chosen;
    qa('[data-filter-summary="signals"]').forEach(function(el){el.textContent=qa('#signals [data-evidence-id]:not(.pulse-category-hidden)').length+' sinais exibidos'});
    qa('[data-filter-summary="opportunities"]').forEach(function(el){el.textContent=qa('#opportunities .opp [data-evidence-id]:not(.pulse-category-hidden)').length+' oportunidades exibidas'});
  }
  function init(){
    var select=q('#pulse-category-select');if(!select)return;
    select.innerHTML=OPTIONS.map(function(x){return'<option value="'+x[0]+'">'+x[1]+'</option>'}).join('');
    try{var saved=localStorage.getItem('pulsePrimaryCategory');if(OPTIONS.some(function(x){return x[0]===saved}))select.value=saved}catch(e){}
    select.addEventListener('change',apply);apply();
    var style=document.createElement('style');style.id='pulse-category-filter-style';style.textContent='#pulse-category-context{display:flex;align-items:center;gap:8px;padding:10px 22px;border-bottom:1px solid #eee;background:#fff7fb;color:#344054;font-size:12px;line-height:1.35}#pulse-category-context strong{color:#e51b67;font-weight:900}#pulse-category-context span{color:#667085}[data-evidence-id].pulse-category-hidden{display:none!important}[data-evidence-id].pulse-category-match{outline:2px solid rgba(229,27,103,.12);outline-offset:1px}.pulse-category-badge{display:inline-flex;margin:0 0 7px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.04em;background:#eef2f6;color:#667085}.pulse-category-badge.is-specific{background:#fde7f0;color:#b4235a}.pulse-category-empty{display:grid;gap:5px;margin:12px 0;padding:14px;border:1px dashed #d0d5dd;border-radius:10px;background:#f8f9fc;color:#475467}.pulse-category-empty[hidden]{display:none!important}.pulse-category-empty strong{font-size:13px;color:#101828}.pulse-category-empty span{font-size:12px;line-height:1.45}';document.head.appendChild(style)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.PULSE_CATEGORY_FILTER={apply:apply,taxonomy:TAXONOMY};
})();
