(function(){
  'use strict';

  function qa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function q(s,r){return (r||document).querySelector(s);}
  function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}

  /*
   * Shopper Intelligence data contract.
   * The UI is no longer allowed to infer a category from a card's visual text.
   * Every insight below has explicit shopper/category dimensions.
   */
  var BEVERAGE_EVIDENCE=[
    {id:'bev-fora-lar',category:'bebidas',themes:['ocasiao','consumo','canal'],channels:['foodservice','multicanal'],regions:['Brasil','Norte/Nordeste'],period:'2025',who:['classes DE'],driver:'conveniencia',title:'Consumo fora do lar está mais frequente e fragmentado',headline:'+29% na frequência de visitas',fact:'Entre janeiro e junho de 2025, a frequência de visitas para consumo fora do lar aumentou 29%. Nas classes DE, o avanço foi de 35%, enquanto volume por viagem e tíquete médio caíram 4%.',source:'Kantar / Worldpanel by Numerator',sourceUrl:'https://www.kantar.com/brazil/inspiration/consumo/2025/comportamento-consumo-fora-de-casa',confidence:'ALTA',periodLabel:'jan.-jun. 2025',implication:'Para bebidas, frequência e ocasião passam a ser tão importantes quanto tamanho da cesta: formatos, disponibilidade e preço de entrada precisam funcionar em missões menores.'},
    {id:'bev-nao-alcoolicas',category:'bebidas',themes:['saudabilidade','ocasiao','consumo'],channels:['foodservice','varejo','multicanal'],regions:['Brasil'],period:'2025',who:['Millennials','shoppers saudabilidade'],driver:'saudabilidade',title:'Bebidas não alcoólicas ganham espaço',headline:'+11% em unidades fora do lar',fact:'Até junho de 2025, bebidas não alcoólicas cresceram 11% em unidades no consumo fora do lar.',source:'Kantar / Worldpanel by Numerator',sourceUrl:'https://www.kantar.com/brazil/inspiration/consumo/2025/comportamento-consumo-fora-de-casa',confidence:'ALTA',periodLabel:'até jun. 2025',implication:'A categoria deve separar crescimento de bebidas não alcoólicas do movimento de bebidas alcoólicas e mapear quais ocasiões estão sustentando a troca.'},
    {id:'bev-alcoolicas',category:'bebidas',themes:['ocasiao','consumo','saudabilidade'],channels:['foodservice','multicanal'],regions:['Brasil','São Paulo','Rio de Janeiro'],period:'2025',who:['Geração Z','Millennials','Baby Boomers'],driver:'ocasiao',title:'Álcool perde penetração, mas as ocasiões de consumo permanecem relevantes',headline:'-34% na penetração de bebidas alcoólicas',fact:'No primeiro trimestre de 2025, a penetração de bebidas alcoólicas caiu 34%, enquanto a categoria registrou retração de 24% nas ocasiões. A Kantar também aponta mudanças geracionais e maior seletividade no consumo.',source:'Kantar / Worldpanel by Numerator',sourceUrl:'https://www.kantar.com/brazil/Inspiration/Consumo/2025/queda-bebidas-alcoolicas-geracoes',confidence:'ALTA',periodLabel:'1º tri. 2025',implication:'Não tratar bebidas como uma cesta homogênea: álcool e não álcool precisam de árvores de decisão e ocasiões diferentes.'},
    {id:'bev-cerveja',category:'bebidas',themes:['ocasiao','canal','consumo'],channels:['foodservice','multicanal'],regions:['Brasil','São Paulo','Rio de Janeiro'],period:'2025',who:['Millennials','Geração X','Baby Boomers'],driver:'ocasiao',title:'Cerveja mantém alcance, mas o consumidor está mais seletivo',headline:'63% ainda consomem fora do lar',fact:'O estudo Brand Footprint Brasil 2025 aponta que 63% dos brasileiros ainda consomem cerveja fora do lar. Entre agosto e dezembro de 2024, houve queda de 1,1 milhão de consumidores, mas as ocasiões de consumo fora de casa cresceram 20%.',source:'Kantar / Worldpanel by Numerator',sourceUrl:'https://www.kantar.com/brazil/inspiration/consumo/2025/comportamento-consumo-cerveja-brasil',confidence:'ALTA',periodLabel:'ago.-dez. 2024 / 2025',implication:'A oportunidade não é simplesmente aumentar penetração: é capturar melhor as ocasiões que permanecem e entender o motivo de escolha.'},
    {id:'bev-zero-2026',category:'bebidas',themes:['saudabilidade','ocasiao','consumo'],channels:['varejo','multicanal'],regions:['Brasil'],period:'2026',who:['Geração Z','shoppers saudabilidade'],driver:'saudabilidade',title:'Zero açúcar ganha força na intenção de consumo',headline:'+10,3 p.p. para bebidas não alcoólicas',fact:'Na pesquisa da NIQ para o contexto da Copa de 2026, a intenção de consumo de bebidas não alcoólicas cresceu 10,3 p.p., enquanto a de bebidas alcoólicas caiu 2,1 p.p. Refrigerantes sem açúcar e energéticos zero foram destacados como motores da categoria.',source:'NielsenIQ',sourceUrl:'https://nielseniq.com/global/pt/insights/analysis/2026/geracao-z-sazonalidade-saudabilidade-e-consumo-no-lar-moldam-as-tendencias-da-copa-em-2026/',confidence:'ALTA',periodLabel:'1º tri. 2026',implication:'Saudabilidade é um driver explícito da árvore de decisão de bebidas e deve ser separado de preço e ocasião.'}
  ];

  var TAXONOMY={
    all:{label:'Todas as categorias'},
    bebidas:{label:'Bebidas'},
    chocolates:{label:'Chocolates'},
    saude:{label:'Saúde & bem-estar'},
    transversal:{label:'Visão transversal'}
  };

  var THEME_OPTIONS=[
    ['all','Todos os temas'],['preco','Preço & valor'],['promocao','Promoção'],['premium','Premiumização'],['pack','Pack & tamanho'],
    ['saudabilidade','Saudabilidade'],['conveniencia','Conveniência'],['ocasiao','Ocasião'],['consumo','Consumo'],['frequencia','Frequência'],
    ['canal','Canal'],['macro','Macro/varejo'],['financeiro','Pressão financeira'],['indulgencia','Indulgência']
  ];
  var CHANNEL_OPTIONS=[
    ['all','Todos os canais'],['varejo','Varejo alimentar'],['atacarejo','Atacarejo'],['supermercado','Supermercado'],['ecommerce','E-commerce'],['foodservice','Fora do lar'],['multicanal','Multicanal']
  ];
  var PERIOD_OPTIONS=[['all','Todos os períodos'],['2024','2024'],['2025','2025'],['2026','2026']];
  var REGION_OPTIONS=[['all','Brasil'],['Norte/Nordeste','Norte/Nordeste'],['São Paulo','São Paulo'],['Rio de Janeiro','Rio de Janeiro']];

  var BASE_MAP={
    canal:{categories:['transversal'],themes:['canal'],channels:['atacarejo','supermercado','ecommerce'],period:'2024'},
    ocasiao:{categories:['bebidas','transversal'],themes:['ocasiao','consumo'],channels:['foodservice','multicanal'],period:'2025'},
    pack:{categories:['transversal'],themes:['pack','preco'],channels:['varejo'],period:'2025'},
    premium:{categories:['chocolates'],themes:['premium'],channels:['multicanal'],period:'2025'},
    promocao:{categories:['transversal'],themes:['promocao','preco'],channels:['multicanal'],period:'2025'},
    frequencia:{categories:['transversal'],themes:['frequencia','consumo'],channels:['multicanal'],period:'2025'},
    'confianca-financeira':{categories:['transversal'],themes:['financeiro','preco'],channels:['varejo','multicanal'],period:'2026'},
    'varejo-geral':{categories:['transversal'],themes:['macro'],channels:['varejo'],period:'2026'},
    'saude-bemestar':{categories:['saude'],themes:['saudabilidade'],channels:['varejo','multicanal'],period:'2025'},
    'indulgencia-seletiva':{categories:['chocolates','bebidas'],themes:['indulgencia','premium','preco'],channels:['varejo','multicanal'],period:'2025'},
    'scanntech-radar':{categories:['transversal'],themes:['macro','consumo','preco'],channels:['varejo'],period:'2026'}
  };

  function baseEvidence(){
    return Array.isArray(window.PULSE_EVIDENCE)?window.PULSE_EVIDENCE.map(function(item){
      var m=BASE_MAP[item.id]||{};
      return {id:item.id,categories:m.categories||['transversal'],themes:m.themes||[],channels:m.channels||[],regions:['Brasil'],period:m.period||String(item.periodo||'').match(/20\d{2}/)?.[0]||'2025',who:[],driver:(m.themes||['macro'])[0],title:item.id,headline:item.metrics&&item.metrics[0]?item.metrics[0].display:'',fact:item.fato||'',source:item.fonte||'Fonte publicada',sourceUrl:'',confidence:item.confianca||'MÉDIA',periodLabel:item.periodo||'',implication:item.acao||item.interpretacao||''};
    }):[];
  }

  function allEvidence(){return baseEvidence().concat(BEVERAGE_EVIDENCE);}

  function categoryMatches(item,category){
    if(category==='all')return true;
    return (item.categories||[]).indexOf(category)>=0;
  }
  function dimensionMatches(item,field,value){
    if(value==='all'||!value)return true;
    if(field==='theme')return (item.themes||[]).indexOf(value)>=0;
    if(field==='channel')return (item.channels||[]).indexOf(value)>=0;
    if(field==='region')return (item.regions||[]).map(norm).indexOf(norm(value))>=0;
    if(field==='period')return String(item.period)===String(value);
    return true;
  }

  function currentCategory(){
    var select=q('.pulse-category-picker select, header.top select[data-category]');
    if(select&&select.value)return select.value;
    var value=document.body.getAttribute('data-pulse-category');
    return value||'all';
  }

  function setCategoryOptions(){
    qa('.pulse-category-picker select, header.top select[data-category]').forEach(function(select){
      var current=select.value||'all';
      select.innerHTML=Object.keys(TAXONOMY).map(function(key){return '<option value="'+key+'">'+TAXONOMY[key].label+'</option>';}).join('');
      if(TAXONOMY[current])select.value=current;else select.value='all';
    });
  }

  function setOptions(select,options){
    if(!select)return;
    var current=select.value||'all';
    select.innerHTML=options.map(function(x){return '<option value="'+x[0]+'">'+x[1]+'</option>';}).join('');
    if(options.some(function(x){return x[0]===current;}))select.value=current;else select.value='all';
  }

  function prepareFilters(){
    qa('[data-filter-scope]').forEach(function(root){
      var theme=root.querySelector('[data-filter="theme"]');
      var channel=root.querySelector('[data-filter="channel"]');
      var period=root.querySelector('[data-filter="period"]');
      var region=root.querySelector('[data-filter="region"]');
      setOptions(theme,THEME_OPTIONS);setOptions(channel,CHANNEL_OPTIONS);setOptions(period,PERIOD_OPTIONS);setOptions(region,REGION_OPTIONS);
      var label=theme&&theme.closest('label');if(label)label.firstChild.textContent='Tema / driver';
      ensureCategoryFilter(root);
    });
  }

  function ensureCategoryFilter(root){
    if(root.querySelector('[data-filter="category"]'))return;
    var label=document.createElement('label');label.className='filter-control';
    label.innerHTML='Categoria<select data-filter="category"></select>';
    var first=root.querySelector('.filter-control');
    if(first&&first.parentNode)first.parentNode.insertBefore(label,first);
    var select=label.querySelector('select');setOptions(select,Object.keys(TAXONOMY).map(function(k){return [k,TAXONOMY[k].label];}));
    var current=currentCategory();if(TAXONOMY[current])select.value=current;
  }

  function evidenceFor(scope,filters){
    var category=filters.category||currentCategory()||'all';
    var data=allEvidence().filter(function(item){
      return categoryMatches(item,category)&&dimensionMatches(item,'theme',filters.theme)&&dimensionMatches(item,'channel',filters.channel)&&dimensionMatches(item,'region',filters.region)&&dimensionMatches(item,'period',filters.period);
    });
    /* Signals are a decision lens, so do not allow generic evidence to drown a category-specific selection. */
    if(category!=='all'){
      var specific=data.filter(function(x){return (x.categories||[]).indexOf(category)>=0;});
      if(specific.length)data=specific;
    }
    return data;
  }

  function filtersFrom(root){
    var values={};qa('[data-filter]',root).forEach(function(s){values[s.dataset.filter]=s.value||'all';});
    if(!values.category)values.category=currentCategory();
    return values;
  }

  function cardMarkup(item){
    var cats=(item.categories||[]).map(function(c){return TAXONOMY[c]?TAXONOMY[c].label:c;}).join(' · ');
    var themes=(item.themes||[]).map(function(t){var found=THEME_OPTIONS.find(function(x){return x[0]===t;});return found?found[1]:t;}).join(' · ');
    return '<article class="pulse-intel-card" data-intel-id="'+item.id+'"><div class="pulse-intel-meta"><span>'+cats+'</span><span>'+item.confidence+'</span></div><h3>'+item.title+'</h3>'+(item.headline?'<strong class="pulse-intel-kpi">'+item.headline+'</strong>':'')+'<p>'+item.fact+'</p><div class="pulse-intel-footer"><span>'+item.source+' · '+item.periodLabel+'</span><span>'+themes+'</span></div>'+(item.implication?'<details><summary>Implicação para decisão</summary><p>'+item.implication+'</p></details>':'')+(item.sourceUrl?'<a class="link" href="'+item.sourceUrl+'" target="_blank" rel="noopener">Fonte →</a>':'')+'</article>';
  }

  function renderIntelligence(scope,root,filters,data){
    var id='pulse-intelligence-'+scope;var panel=q('#'+id);
    if(!panel){
      panel=document.createElement('section');panel.id=id;panel.className='pulse-intelligence-panel';
      var summary=q('[data-filter-summary="'+scope+'"]');
      if(summary&&summary.parentNode)summary.parentNode.insertBefore(panel,summary.nextSibling);
      else root.parentNode.insertBefore(panel,root.nextSibling);
    }
    var category=filters.category||'all';
    var label=TAXONOMY[category]?TAXONOMY[category].label:'Todas as categorias';
    var shown=data.slice(0,6);
    panel.innerHTML='<div class="pulse-intel-head"><div><span class="eyebrow">LENTE DE SHOPPER INTELLIGENCE</span><h2>'+label+'</h2><p>'+decisionSentence(category,filters)+'</p></div><strong>'+data.length+' evidência'+(data.length===1?'':'s')+'</strong></div>'+(shown.length?'<div class="pulse-intel-grid">'+shown.map(cardMarkup).join('')+'</div>':'<div class="pulse-intel-empty"><strong>Nenhuma evidência compatível</strong><span>Os filtros atuais não encontram evidência publicada para esta combinação.</span><button type="button" class="secondary" data-intel-reset>Limpar filtros</button></div>');
    var reset=panel.querySelector('[data-intel-reset]');if(reset)reset.addEventListener('click',function(){qa('[data-filter]',root).forEach(function(s){s.value='all';});apply(root.dataset.filterScope);});
  }

  function decisionSentence(category,filters){
    if(category==='bebidas')return 'Quem compra, por que escolhe, em qual ocasião e por qual canal — com evidência específica de bebidas.';
    if(category==='chocolates')return 'Drivers de valor, premiumização e indulgência que ajudam a explicar a decisão de compra.';
    if(category==='saude')return 'Saudabilidade e benefício funcional como drivers de escolha e crescimento.';
    if(filters.theme&&filters.theme!=='all')return 'Lente de decisão: '+(THEME_OPTIONS.find(function(x){return x[0]===filters.theme;})||['',filters.theme])[1]+'.';
    return 'Visão transversal: preço, canal, ocasião, frequência e pressão financeira que moldam a cesta.';
  }

  function apply(scope){
    var root=q('[data-filter-scope="'+scope+'"]');if(!root)return;
    var filters=filtersFrom(root);var data=evidenceFor(scope,filters);
    var cards=scope==='signals'?qa('#signals .row'):qa('#opportunities .opp .box');
    var visible=0;
    cards.forEach(function(card){
      var id=card.dataset.evidenceId||'';var item=allEvidence().find(function(x){return x.id===id;});
      var ok=item?categoryMatches(item,filters.category||'all')&&dimensionMatches(item,'theme',filters.theme)&&dimensionMatches(item,'channel',filters.channel)&&dimensionMatches(item,'region',filters.region)&&dimensionMatches(item,'period',filters.period):filters.category==='all';
      card.classList.toggle('filtered-out',!ok);card.setAttribute('aria-hidden',ok?'false':'true');if(ok)visible++;
    });
    renderIntelligence(scope,root,filters,data);
    var summary=q('[data-filter-summary="'+scope+'"]');if(summary)summary.textContent=data.length+' evidência'+(data.length===1?'':'s')+' encontrada'+(data.length===1?'':'s');
    var empty=q('[data-filter-empty="'+scope+'"]');if(empty)empty.hidden=true;
    root.dataset.filterActive=Object.keys(filters).some(function(k){return filters[k]!=='all';})?'true':'false';
  }

  function syncCategory(category){
    category=TAXONOMY[category]?category:'all';
    document.body.setAttribute('data-pulse-category',category);
    qa('[data-filter-scope]').forEach(function(root){var select=root.querySelector('[data-filter="category"]');if(select)select.value=category;apply(root.dataset.filterScope);});
    var context=q('#pulse-category-context');if(context){context.innerHTML='<span>Minha categoria</span><strong>'+TAXONOMY[category].label+'</strong><span>· filtros e evidências sincronizados</span>';}
  }

  function addStyles(){
    if(q('#pulse-ux-filter-fix-styles'))return;
    var style=document.createElement('style');style.id='pulse-ux-filter-fix-styles';
    style.textContent=''+
      '.filtered-out{display:none!important}'+
      '.pulse-intelligence-panel{margin:18px 0 24px;padding:22px;border:1px solid #eadfe5;border-radius:18px;background:#fff}'+
      '.pulse-intel-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:16px}.pulse-intel-head h2{margin:4px 0 5px;font-size:25px}.pulse-intel-head p{margin:0;color:#667085;max-width:700px}.pulse-intel-head>strong{font-size:13px;color:#e51b67;white-space:nowrap}.pulse-intel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pulse-intel-card{padding:17px;border:1px solid #ece5e9;border-radius:14px;background:#fff;min-width:0}.pulse-intel-card h3{margin:7px 0 7px;font-size:17px;line-height:1.2}.pulse-intel-card p{color:#596273;line-height:1.5;margin:8px 0}.pulse-intel-meta,.pulse-intel-footer{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#7a8495;text-transform:uppercase;letter-spacing:.04em}.pulse-intel-kpi{display:block;font-size:22px;line-height:1.1}.pulse-intel-footer{margin-top:12px;text-transform:none;letter-spacing:0}.pulse-intel-card details{margin-top:10px}.pulse-intel-card summary{cursor:pointer;font-weight:700;color:#344054;font-size:12px}.pulse-intel-empty{padding:20px;border:1px dashed #cfd5df;border-radius:14px;display:flex;flex-direction:column;gap:7px}.pulse-intel-empty span{color:#667085}.pulse-intel-empty button{width:max-content}.filter-controls{align-items:end}.filter-control select{width:100%}'+
      '@media(max-width:800px){.pulse-intelligence-panel{padding:15px;border-radius:15px}.pulse-intel-head{display:block}.pulse-intel-head>strong{display:block;margin-top:8px}.pulse-intel-grid{grid-template-columns:1fr}.pulse-intel-card{padding:14px}details.filter-panel .filter-controls{grid-template-columns:1fr 1fr!important}.pulse-intel-head h2{font-size:21px}}';
    document.head.appendChild(style);
  }

  function bind(){
    addStyles();setCategoryOptions();prepareFilters();
    var categorySelects=qa('.pulse-category-picker select, header.top select[data-category]');
    categorySelects.forEach(function(select){select.addEventListener('change',function(){syncCategory(select.value);});});
    qa('[data-filter-scope]').forEach(function(root){
      qa('[data-filter]',root).forEach(function(select){select.addEventListener('change',function(){setTimeout(function(){apply(root.dataset.filterScope);},0);});});
      apply(root.dataset.filterScope);
    });
    qa('[data-filter-reset]').forEach(function(button){button.addEventListener('click',function(){var root=q('[data-filter-scope="'+button.dataset.filterReset+'"]');if(root){qa('[data-filter]',root).forEach(function(s){s.value='all';});apply(button.dataset.filterReset);}});});
    document.addEventListener('pulse:category-change',function(e){var category=e&&e.detail&&e.detail.category?e.detail.category:currentCategory();syncCategory(category);});
    document.addEventListener('change',function(e){if(e.target&&e.target.matches('.pulse-category-picker select, header.top select[data-category]'))setTimeout(function(){syncCategory(e.target.value);},0);},true);
    window.PULSE_APPLY_FILTERS=apply;
    window.PULSE_SHOPPER_INTELLIGENCE={taxonomy:TAXONOMY,evidence:allEvidence,filters:evidenceFor,apply:apply};
  }

  function init(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();}
  init();
})();