(function(){
  'use strict';

  var CATEGORY_META={
    all:{label:'Todas as categorias',ids:[]},
    chocolates:{label:'Chocolates',ids:['premium','indulgencia-seletiva']},
    bebidas:{label:'Bebidas',ids:['ocasiao']},
    saude:{label:'Saúde & bem-estar',ids:['saude-bemestar']},
    geral:{label:'Visão transversal',ids:['canal','pack','promocao','frequencia','confianca-financeira','varejo-geral','scanntech-radar']}
  };

  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function q(s,r){return (r||document).querySelector(s);}

  function setupTopCategory(){
    var select=q('#pulse-category-select');
    if(!select)return;
    var options=[['all','Todas as categorias'],['chocolates','Chocolates'],['bebidas','Bebidas'],['saude','Saúde & bem-estar'],['geral','Visão transversal']];
    select.innerHTML=options.map(function(x){return '<option value="'+x[0]+'">'+x[1]+'</option>';}).join('');
    try{
      var saved=localStorage.getItem('pulsePrimaryCategory');
      if(options.some(function(x){return x[0]===saved;}))select.value=saved;
    }catch(e){}
    function apply(){
      var chosen=select.value||'all';
      try{localStorage.setItem('pulsePrimaryCategory',chosen);}catch(e){}
      document.body.dataset.pulseCategory=chosen;
      var context=q('#pulse-category-context');
      if(!context){
        context=document.createElement('div');
        context.id='pulse-category-context';
        context.setAttribute('role','status');
        var header=q('header.top');
        if(header&&header.parentNode)header.parentNode.insertBefore(context,header.nextSibling);
      }
      if(context){
        context.innerHTML='<strong>'+CATEGORY_META[chosen].label+'</strong><span>'+(
          chosen==='all'?'Visão completa do mercado.':'Categoria principal selecionada. Os filtros de sinais continuam disponíveis em “Filtrar”.'
        )+'</span>';
        context.hidden=false;
      }
      document.dispatchEvent(new CustomEvent('pulse:category-change',{detail:{category:chosen}}));
    }
    select.addEventListener('change',apply);
    apply();
  }

  function setupFilterScopes(){
    function apply(scope){
      var root=q('[data-filter-scope="'+scope+'"]');
      if(!root)return;
      var cards=scope==='signals'?qa('#signals .row'):qa('#opportunities .opp .box');
      var values={};
      qa('[data-filter]',root).forEach(function(s){values[s.dataset.filter]=s.value||'all';});
      var shown=0;
      cards.forEach(function(card){
        var ok=Object.keys(values).every(function(key){
          var wanted=values[key];
          if(wanted==='all')return true;
          var actual=String(card.dataset[key]||'').toLowerCase();
          return actual===String(wanted).toLowerCase();
        });
        card.classList.toggle('filtered-out',!ok);
        card.setAttribute('aria-hidden',ok?'false':'true');
        if(ok)shown++;
      });
      var summary=q('[data-filter-summary="'+scope+'"]');
      if(summary)summary.textContent=shown+' '+(scope==='signals'?'sinais':'oportunidades')+' exibidos';
      var empty=q('[data-filter-empty="'+scope+'"]');
      if(empty)empty.hidden=shown!==0;
      var panel=q('[data-filter-scope="'+scope+'"]');
      if(panel)panel.dataset.filterActive=Object.keys(values).some(function(k){return values[k]!=='all';})?'true':'false';
    }

    function bind(){
      qa('[data-filter-scope]').forEach(function(root){
        var scope=root.dataset.filterScope;
        qa('[data-filter]',root).forEach(function(select){
          select.addEventListener('change',function(){apply(scope);});
        });
        apply(scope);
      });
      qa('[data-filter-reset]').forEach(function(button){
        button.addEventListener('click',function(){
          var scope=button.dataset.filterReset,root=q('[data-filter-scope="'+scope+'"]');
          if(!root)return;
          qa('[data-filter]',root).forEach(function(select){select.value='all';});
          apply(scope);
        });
      });
    }

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
    window.PULSE_APPLY_FILTERS=apply;
  }

  function addMobileCategoryStyles(){
    if(q('#pulse-ux-filter-fix-styles'))return;
    var style=document.createElement('style');
    style.id='pulse-ux-filter-fix-styles';
    style.textContent=''
      +'#pulse-category-context{display:flex;align-items:center;gap:8px;padding:9px 22px;border-bottom:1px solid #eee;background:#fff7fb;color:#344054;font-size:12px;line-height:1.35;}'
      +'#pulse-category-context strong{color:#e51b67;font-weight:900;}'
      +'#pulse-category-context span{color:#667085;}'
      +'.filtered-out{display:none!important;}'
      +'@media(max-width:800px){header.top{display:flex!important;flex-wrap:wrap!important;height:auto!important;align-items:center!important;gap:8px!important;padding:10px 12px!important;}header.top .logo{flex:1 1 100%!important;}header.top .context{display:flex!important;flex:1 1 100%!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;font-size:11px!important;white-space:nowrap!important;}header.top .pulse-category-picker{display:flex!important;align-items:center!important;margin:0!important;gap:6px!important;}header.top .pulse-category-picker select{display:block!important;max-width:180px!important;font-size:12px!important;padding:7px 8px!important;}#pulse-category-context{padding:8px 12px!important;font-size:11px!important;flex-wrap:wrap!important;}details.filter-panel{width:100%!important;}details.filter-panel .filter-controls{display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important;}details.filter-panel .filter-control select{width:100%!important;min-width:0!important;font-size:14px!important;padding:9px!important;} }';
    document.head.appendChild(style);
  }

  function init(){
    addMobileCategoryStyles();
    setupTopCategory();
    setupFilterScopes();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
