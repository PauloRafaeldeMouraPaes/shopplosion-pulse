(function(){
  'use strict';

  var TAXONOMY={
    chocolates:{label:'Chocolates'},
    bebidas:{label:'Bebidas'},
    saude:{label:'Saúde & bem-estar'},
    geral:{label:'Visão transversal'}
  };
  var OPTIONS=[['all','Todas as categorias'],['chocolates','Chocolates'],['bebidas','Bebidas'],['saude','Saúde & bem-estar'],['geral','Visão transversal']];

  var SOURCE_URLS={
    kantarBebidas:'https://www.kantar.com/brazil/Inspiration/Consumo/2025/queda-bebidas-alcoolicas-geracoes',
    kantarCerveja:'https://www.kantar.com/brazil/inspiration/consumo/2025/comportamento-consumo-cerveja-brasil',
    niqBebidas:'https://nielseniq.com/global/pt/insights/analysis/2026/geracao-z-sazonalidade-saudabilidade-e-consumo-no-lar-moldam-as-tendencias-da-copa-em-2026/',
    niqSaude:'https://nielseniq.com/global/pt/insights/analysis/2026/como-as-canetas-emagrecedoras-estao-redesenhando-o-consumo-no-brasil/'
  };

  function q(s,r){return(r||document).querySelector(s)}
  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}

  function sourceLink(label,url){return '<a class="pulse-evidence-source" href="'+url+'" target="_blank" rel="noopener noreferrer">Fonte: '+label+' ↗</a>';}

  function makeRow(item){
    var row=document.createElement('div');
    row.className='row pulse-category-evidence-row';
    row.setAttribute('data-evidence-id',item.id);
    row.dataset.pulseCategory=item.category;
    row.dataset.theme=item.theme;
    row.dataset.channel=item.channel;
    row.dataset.region='Brasil';
    row.dataset.period=item.period;
    row.innerHTML='<div class="num">'+item.num+'</div>'+
      '<div><span class="pulse-category-badge is-specific">'+TAXONOMY[item.category].label.toUpperCase()+'</span><b>'+item.title+'</b><p>'+item.text+'</p>'+sourceLink(item.source,item.url)+'</div>'+
      '<div><b class="big-num">'+item.metric+'</b><small>'+item.metricLabel+'</small></div>'+
      '<div><span class="confidence">ALTA</span><br><span class="pulse-evidence-type">EVIDÊNCIA PUBLICADA</span></div>';
    return row;
  }

  function ensureCategoryEvidence(){
    var root=q('#signals .rows');
    if(!root || q('.pulse-category-evidence-row',root)) return;
    var items=[
      {id:'bebidas-nao-alcoolicas',category:'bebidas',theme:'saudabilidade',channel:'multicanal',period:'2026',num:'05',title:'Bebidas não alcoólicas ganham espaço',text:'Na pesquisa NielsenIQ para o cenário da Copa de 2026, a intenção de consumo de bebidas não alcoólicas cresceu 10,3 p.p. contra o 1º tri. de 2025, enquanto a intenção de bebidas alcoólicas caiu 2,1 p.p.',metric:'+10,3 p.p.',metricLabel:'não alcoólicas',source:'NielsenIQ · 01 abr. 2026',url:SOURCE_URLS.niqBebidas},
      {id:'bebidas-zero',category:'bebidas',theme:'saudabilidade',channel:'varejo',period:'2026',num:'06',title:'Zero açúcar acelera dentro das bebidas não alcoólicas',text:'Refrigerantes sem açúcar representam 32,9% das vendas da categoria e crescem 13 vezes mais que as versões regulares; energéticos zero representam 29,3% e crescem duas vezes mais.',metric:'32,9%',metricLabel:'vendas · zero açúcar',source:'NielsenIQ · 01 abr. 2026',url:SOURCE_URLS.niqBebidas},
      {id:'cerveja-ocasioes',category:'bebidas',theme:'ocasiao',channel:'multicanal',period:'2025',num:'07',title:'Cerveja perde consumidores, mas ganha ocasiões',text:'O estudo Brand Footprint Brasil 2025 aponta 63% dos brasileiros consumindo cerveja fora do lar; houve 1,1 milhão de consumidores a menos, mas as ocasiões de consumo cresceram 20%, para mais de 41,4 milhões.',metric:'+20%',metricLabel:'ocasiões fora do lar',source:'Kantar/Worldpanel by Numerator · 2025',url:SOURCE_URLS.kantarCerveja},
      {id:'alcool-pressao',category:'bebidas',theme:'ocasiao',channel:'multicanal',period:'2025',num:'08',title:'Bebidas alcoólicas sofrem pressão de penetração',text:'No 1º tri. de 2025, a penetração de bebidas alcoólicas caiu 34% e as ocasiões de consumo da categoria recuaram 24%, segundo a Kantar.',metric:'-34%',metricLabel:'penetração',source:'Kantar · 2025',url:SOURCE_URLS.kantarBebidas},
      {id:'chocolate-premium',category:'chocolates',theme:'premium',channel:'varejo',period:'2025',num:'09',title:'Chocolate premium aparece como indulgência seletiva',text:'A base atual do Pulse registra ganho de 1,6 p.p. de participação para chocolate em barra premium mesmo com queda no volume total da categoria. O dado é tratado como sinal de indulgência seletiva, não como tendência geral de premiumização.',metric:'+1,6 p.p.',metricLabel:'participação',source:'Base atual do Pulse · cruzamento Scanntech/McKinsey',url:'https://www.scanntech.com.br/'},
      {id:'saude-glp1',category:'saude',theme:'saudabilidade',channel:'multicanal',period:'2026',num:'10',title:'Saúde reorganiza a cesta de consumo',text:'Entre os lares brasileiros que usam medicamentos à base de GLP-1, 62,2% afirmam ter despriorizado compras para viabilizar o tratamento; o impacto se estende a bebidas, indulgências e outros gastos discricionários.',metric:'62,2%',metricLabel:'despriorizaram compras',source:'NielsenIQ · 29 abr. 2026',url:SOURCE_URLS.niqSaude}
    ];
    items.forEach(function(item){root.appendChild(makeRow(item));});
  }

  function categoryForCard(card){
    var explicit=card.getAttribute('data-pulse-category');
    if(explicit && TAXONOMY[explicit]) return explicit;
    var id=card.getAttribute('data-evidence-id')||'';
    if(id==='chocolate-premium') return 'chocolates';
    if(id.indexOf('bebida')===0 || id.indexOf('cerveja')===0 || id==='alcool-pressao') return 'bebidas';
    if(id.indexOf('saude')===0) return 'saude';
    return 'geral';
  }

  function labelFor(k){return k==='all'?'Todas as categorias':(TAXONOMY[k]?TAXONOMY[k].label:k)}

  function ensureContext(){
    var select=q('#pulse-category-select');if(!select)return null;
    var host=q('#pulse-category-context');
    if(!host){
      host=document.createElement('div');host.id='pulse-category-context';host.setAttribute('role','status');
      var header=select.closest('header')||select.parentElement;
      if(header&&header.parentElement)header.parentElement.insertBefore(host,header.nextSibling);else document.body.insertBefore(host,document.body.firstChild);
    }
    return host;
  }

  function apply(){
    ensureCategoryEvidence();
    var select=q('#pulse-category-select');if(!select)return;
    var chosen=select.value||'all';
    try{localStorage.setItem('pulsePrimaryCategory',chosen)}catch(e){}
    var allCards=qa('main [data-evidence-id]');
    var specific=0;
    allCards.forEach(function(card){
      var category=categoryForCard(card);
      var visible=chosen==='all'||category===chosen;
      card.dataset.pulseCategory=category;
      card.classList.toggle('pulse-category-hidden',!visible);
      card.classList.toggle('pulse-category-match',chosen!=='all'&&visible);
      card.setAttribute('aria-hidden',visible?'false':'true');
      if(chosen!=='all'&&category===chosen)specific++;
      var badge=card.querySelector(':scope > .pulse-category-badge');
      if(!badge){badge=document.createElement('span');badge.className='pulse-category-badge';card.insertBefore(badge,card.firstChild)}
      badge.textContent=chosen!=='all'&&visible?'DA SUA CATEGORIA':(category==='geral'?'VISÃO TRANSVERSAL':TAXONOMY[category].label.toUpperCase());
      badge.classList.toggle('is-specific',chosen!=='all'&&visible);
      badge.classList.toggle('is-general',!(chosen!=='all'&&visible));
    });
    var context=ensureContext();
    if(context){
      if(chosen==='all')context.innerHTML='<strong>Todas as categorias</strong><span>Visão completa do mercado.</span>';
      else context.innerHTML='<strong>'+labelFor(chosen)+'</strong><span>Filtro aplicado · '+specific+' evidência(s) específica(s) exibida(s).</span>';
      context.dataset.category=chosen;context.hidden=false;
    }
    document.body.dataset.pulseCategory=chosen;
    qa('[data-filter-summary="signals"]').forEach(function(el){el.textContent=qa('#signals .row:not(.pulse-category-hidden):not(.filtered-out)').length+' sinais exibidos'});
    qa('[data-filter-summary="opportunities"]').forEach(function(el){el.textContent=qa('#opportunities .opp .box:not(.pulse-category-hidden):not(.filtered-out)').length+' oportunidades exibidas'});
    document.dispatchEvent(new CustomEvent('pulse:category-change',{detail:{category:chosen}}));
  }

  function init(){
    var select=q('#pulse-category-select');if(!select)return;
    select.innerHTML=OPTIONS.map(function(x){return'<option value="'+x[0]+'">'+x[1]+'</option>'}).join('');
    try{var saved=localStorage.getItem('pulsePrimaryCategory');if(OPTIONS.some(function(x){return x[0]===saved}))select.value=saved}catch(e){}
    ensureCategoryEvidence();
    select.addEventListener('change',apply);
    apply();
    var style=document.createElement('style');style.id='pulse-category-filter-style';style.textContent='#pulse-category-context{display:flex;align-items:center;gap:8px;padding:10px 22px;border-bottom:1px solid #eee;background:#fff7fb;color:#344054;font-size:12px;line-height:1.35}#pulse-category-context strong{color:#e51b67;font-weight:900}#pulse-category-context span{color:#667085}[data-evidence-id].pulse-category-hidden{display:none!important}[data-evidence-id].pulse-category-match{outline:2px solid rgba(229,27,103,.12);outline-offset:1px}.pulse-category-badge{display:inline-flex;margin:0 0 7px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.04em;background:#eef2f6;color:#667085}.pulse-category-badge.is-specific{background:#fde7f0;color:#b4235a}.pulse-category-empty{display:grid;gap:5px;margin:12px 0;padding:14px;border:1px dashed #d0d5dd;border-radius:10px;background:#f8f9fc;color:#475467}.pulse-category-empty[hidden]{display:none!important}.pulse-category-empty strong{font-size:13px;color:#101828}.pulse-category-empty span{font-size:12px;line-height:1.45}.pulse-category-evidence-row{position:relative}.pulse-evidence-source{display:inline-block;margin-top:5px;font-size:11px;color:#b4235a;text-decoration:underline}.pulse-evidence-type{font-size:9px;color:#667085;font-weight:800;letter-spacing:.04em}@media(max-width:800px){#pulse-category-context{padding:8px 12px;font-size:11px;flex-wrap:wrap}.pulse-category-evidence-row{grid-template-columns:auto 1fr!important;gap:10px!important}.pulse-category-evidence-row>div:nth-child(3),.pulse-category-evidence-row>div:nth-child(4){grid-column:2}.pulse-evidence-source{font-size:10px}}';document.head.appendChild(style)
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.PULSE_CATEGORY_FILTER={apply:apply,taxonomy:TAXONOMY};
})();
