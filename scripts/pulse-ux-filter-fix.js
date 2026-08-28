(function () {
  'use strict';

  var TAXONOMY = {
    all: 'Todas as categorias',
    bebidas: 'Bebidas',
    chocolates: 'Chocolates',
    saude: 'Saúde & bem-estar',
    geral: 'Visão transversal'
  };

  var BEVERAGES = [
    { id:'bev-fora-lar', category:'bebidas', themes:['ocasiao','consumo','canal','conveniencia'], channels:['foodservice','multicanal'], period:'2025', title:'Consumo fora do lar está mais frequente e fragmentado', kpi:'+29% na frequência', fact:'Entre janeiro e junho de 2025, a frequência de visitas aumentou 29%; nas classes DE, o avanço foi de 35%, enquanto volume por viagem e tíquete médio caíram 4%.', source:'Kantar / Worldpanel by Numerator', periodLabel:'jan.-jun. 2025', url:'https://www.kantar.com/brazil/inspiration/consumo/2025/comportamento-consumo-fora-de-casa' },
    { id:'bev-nao-alcoolicas', category:'bebidas', themes:['saudabilidade','ocasiao','consumo'], channels:['foodservice','varejo','multicanal'], period:'2025', title:'Bebidas não alcoólicas ganham espaço', kpi:'+11% em unidades', fact:'Até junho de 2025, bebidas não alcoólicas cresceram 11% em unidades no consumo fora do lar.', source:'Kantar / Worldpanel by Numerator', periodLabel:'até jun. 2025', url:'https://www.kantar.com/brazil/inspiration/consumo/2025/comportamento-consumo-fora-de-casa' },
    { id:'bev-cerveja', category:'bebidas', themes:['ocasiao','canal','consumo'], channels:['foodservice','multicanal'], period:'2025', title:'Cerveja perde consumidores, mas ganha ocasiões', kpi:'+20% em ocasiões', fact:'63% dos brasileiros ainda consomem cerveja fora do lar; houve 1,1 milhão de consumidores a menos, mas as ocasiões cresceram 20%, para mais de 41,4 milhões.', source:'Kantar / Worldpanel by Numerator', periodLabel:'Brand Footprint Brasil 2025', url:'https://www.kantar.com/brazil/Inspiration/Consumo/2025/Comportamento-consumo-cerveja-brasil' },
    { id:'bev-alcoolicas', category:'bebidas', themes:['ocasiao','consumo','saudabilidade'], channels:['foodservice','multicanal'], period:'2025', title:'Bebidas alcoólicas sofrem pressão de penetração', kpi:'-34% na penetração', fact:'No primeiro trimestre de 2025, a penetração de bebidas alcoólicas caiu 34% e as ocasiões recuaram 24%, segundo a Kantar.', source:'Kantar / Worldpanel by Numerator', periodLabel:'1º tri. 2025', url:'https://www.kantar.com/brazil/Inspiration/Consumo/2025/queda-bebidas-alcoolicas-geracoes' },
    { id:'bev-zero', category:'bebidas', themes:['saudabilidade','ocasiao','consumo'], channels:['varejo','multicanal'], period:'2026', title:'Zero açúcar ganha força na intenção de consumo', kpi:'+10,3 p.p. não alcoólicas', fact:'Na pesquisa NIQ para a Copa de 2026, a intenção de consumo de bebidas não alcoólicas cresceu 10,3 p.p., enquanto a de alcoólicas caiu 2,1 p.p.; refrigerantes sem açúcar e energéticos zero foram destaques.', source:'NielsenIQ', periodLabel:'1º tri. 2026', url:'https://nielseniq.com/global/pt/insights/analysis/2026/geracao-z-sazonalidade-saudabilidade-e-consumo-no-lar-moldam-as-tendencias-da-copa-em-2026/' }
  ];

  var THEMES = [
    ['all','Todos os temas'],['preco','Preço & valor'],['promocao','Promoção'],['premium','Premiumização'],['pack','Pack & tamanho'],
    ['saudabilidade','Saudabilidade'],['conveniencia','Conveniência'],['ocasiao','Ocasião'],['consumo','Consumo'],['frequencia','Frequência'],
    ['canal','Canal'],['macro','Macro/varejo'],['financeiro','Pressão financeira'],['indulgencia','Indulgência']
  ];
  var CHANNELS = [['all','Todos os canais'],['varejo','Varejo alimentar'],['atacarejo','Atacarejo'],['supermercado','Supermercado'],['ecommerce','E-commerce'],['foodservice','Fora do lar'],['multicanal','Multicanal']];
  var PERIODS = [['all','Todos os períodos'],['2024','2024'],['2025','2025'],['2026','2026']];
  var REGIONS = [['all','Brasil'],['Norte/Nordeste','Norte/Nordeste'],['São Paulo','São Paulo'],['Rio de Janeiro','Rio de Janeiro']];

  var MAP = {
    promocao:{category:'geral',theme:'promocao',channel:'multicanal',period:'2025'},
    premium:{category:'chocolates',theme:'premium',channel:'multicanal',period:'2025'},
    pack:{category:'geral',theme:'pack',channel:'varejo',period:'2025'},
    frequencia:{category:'geral',theme:'frequencia',channel:'multicanal',period:'2025'},
    ocasiao:{category:'geral',theme:'ocasiao',channel:'multicanal',period:'2025'},
    promocao:{category:'geral',theme:'promocao',channel:'multicanal',period:'2025'},
    'confianca-financeira':{category:'geral',theme:'financeiro',channel:'multicanal',period:'2026'},
    'varejo-geral':{category:'geral',theme:'macro',channel:'varejo',period:'2026'},
    'saude-bem-estar':{category:'saude',theme:'saudabilidade',channel:'multicanal',period:'2025'},
    'indulgencia-seletiva':{category:'chocolates',theme:'indulgencia',channel:'multicanal',period:'2025'},
    'scanntech-radar':{category:'geral',theme:'macro',channel:'varejo',period:'2026'},
    canal:{category:'geral',theme:'canal',channel:'varejo',period:'2024'}
  };

  function q(selector, root) { return (root || document).querySelector(selector); }
  function qa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function optionize(select, values) {
    if (!select) return;
    var current = select.value || 'all';
    select.innerHTML = values.map(function (item) {
      return '<option value="' + item[0] + '">' + item[1] + '</option>';
    }).join('');
    select.value = values.some(function (item) { return item[0] === current; }) ? current : 'all';
  }

  function currentFilters(root) {
    var filters = { category:'all', theme:'all', channel:'all', period:'all', region:'all' };
    qa('[data-filter]', root).forEach(function (select) {
      filters[select.getAttribute('data-filter')] = select.value || 'all';
    });
    var category = q('#pulse-category-select');
    if (category && category.value !== 'all') filters.category = category.value;
    return filters;
  }

  function domEvidence() {
    var items = [];
    qa('#signals .row[data-evidence-id]').forEach(function (card) {
      var id = card.getAttribute('data-evidence-id');
      var map = MAP[id] || {};
      var category = card.getAttribute('data-pulse-category') || map.category || 'geral';
      var theme = card.getAttribute('data-theme') || map.theme || 'macro';
      items.push({
        id:id,
        category:category,
        themes:[theme],
        channels:[card.getAttribute('data-channel') || map.channel || 'varejo'],
        period:card.getAttribute('data-period') || map.period || '2025',
        title:(q('b', card) || {}).textContent || id,
        kpi:(q('.big-num', card) || {}).textContent || '',
        fact:(q('p', card) || {}).textContent || '',
        source:'Base publicada do Pulse',
        periodLabel:card.getAttribute('data-period') || ''
      });
    });
    return items;
  }

  function allEvidence() { return domEvidence().concat(BEVERAGES); }

  function matches(item, filters) {
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.theme !== 'all' && item.themes.indexOf(filters.theme) < 0) return false;
    if (filters.channel !== 'all' && item.channels.indexOf(filters.channel) < 0) return false;
    if (filters.period !== 'all' && String(item.period) !== String(filters.period)) return false;
    return true;
  }

  function render(scope) {
    var root = q('[data-filter-scope="' + scope + '"]');
    if (!root) return;
    var filters = currentFilters(root);
    var items = allEvidence().filter(function (item) { return matches(item, filters); });
    var panel = q('#pulse-intelligence-' + scope);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'pulse-intelligence-' + scope;
      panel.className = 'pulse-intelligence-panel';
      var summary = q('[data-filter-summary="' + scope + '"]');
      if (summary && summary.parentNode) summary.parentNode.insertBefore(panel, summary.nextSibling);
      else root.parentNode.appendChild(panel);
    }
    var categoryLabel = TAXONOMY[filters.category] || TAXONOMY.all;
    var themeLabel = THEMES.filter(function (item) { return item[0] === filters.theme; }).map(function (item) { return item[1]; })[0];
    panel.innerHTML = '<div class="pulse-intel-head"><div><span class="eyebrow">LENTE DE SHOPPER INTELLIGENCE</span><h2>' + categoryLabel + '</h2><p>' + (themeLabel && filters.theme !== 'all' ? 'Driver: <strong>' + themeLabel + '</strong>. ' : '') + 'Evidência compatível com categoria, tema, canal e período selecionados.</p></div><strong>' + items.length + ' evidência' + (items.length === 1 ? '' : 's') + '</strong></div>' + (items.length ? '<div class="pulse-intel-grid">' + items.slice(0,6).map(function (item) {
      return '<article class="pulse-intel-card"><div class="pulse-intel-meta"><span>' + (TAXONOMY[item.category] || item.category) + '</span><span>EVIDÊNCIA</span></div><h3>' + item.title + '</h3>' + (item.kpi ? '<strong class="pulse-intel-kpi">' + item.kpi + '</strong>' : '') + '<p>' + item.fact + '</p><div class="pulse-intel-footer"><span>' + item.source + ' · ' + item.periodLabel + '</span></div>' + (item.url ? '<a class="pulse-intel-source" href="' + item.url + '" target="_blank" rel="noopener">Fonte ↗</a>' : '') + '</article>';
    }).join('') + '</div>' : '<div class="pulse-intel-empty"><strong>Nenhuma evidência compatível</strong><span>Não há evidência publicada para esta combinação. Reduza os filtros ou limpe a seleção.</span><button type="button" class="secondary" data-intel-reset>Limpar filtros</button></div>');
    var reset = panel.querySelector('[data-intel-reset]');
    if (reset) reset.addEventListener('click', function () {
      qa('[data-filter]', root).forEach(function (select) { select.value = 'all'; });
      var category = q('#pulse-category-select');
      if (category) category.value = 'all';
      render(scope);
    });
  }

  function init() {
    try {
      qa('[data-filter-scope]').forEach(function (root) {
        optionize(q('[data-filter="theme"]', root), THEMES);
        optionize(q('[data-filter="channel"]', root), CHANNELS);
        optionize(q('[data-filter="period"]', root), PERIODS);
        optionize(q('[data-filter="region"]', root), REGIONS);
        qa('[data-filter]', root).forEach(function (select) {
          select.addEventListener('change', function () { render(root.getAttribute('data-filter-scope')); });
        });
        render(root.getAttribute('data-filter-scope'));
      });
      var category = q('#pulse-category-select');
      if (category) category.addEventListener('change', function () {
        qa('[data-filter-scope]').forEach(function (root) { render(root.getAttribute('data-filter-scope')); });
      });
      document.addEventListener('pulse:category-change', function () {
        qa('[data-filter-scope]').forEach(function (root) { render(root.getAttribute('data-filter-scope')); });
      });
      window.PULSE_SHOPPER_INTELLIGENCE = { taxonomy:TAXONOMY, evidence:allEvidence, render:render };
      window.PULSE_FILTER_FIX_READY = true;
    } catch (error) {
      window.PULSE_FILTER_FIX_ERROR = String(error && error.message || error);
      console.error('Pulse filter runtime error', error);
    }
  }

  function styles() {
    if (q('#pulse-intelligence-style')) return;
    var style = document.createElement('style');
    style.id = 'pulse-intelligence-style';
    style.textContent = '.pulse-intelligence-panel{margin:18px 0 24px;padding:20px;border:1px solid #eadfe5;border-radius:18px;background:#fff}.pulse-intel-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:15px}.pulse-intel-head h2{margin:4px 0;font-size:24px}.pulse-intel-head p{margin:0;color:#667085}.pulse-intel-head>strong{color:#e51b67;white-space:nowrap}.pulse-intel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pulse-intel-card{padding:15px;border:1px solid #ece5e9;border-radius:14px}.pulse-intel-card h3{font-size:17px;line-height:1.25;margin:7px 0}.pulse-intel-card p{color:#596273;line-height:1.5}.pulse-intel-meta,.pulse-intel-footer{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#7a8495}.pulse-intel-kpi{display:block;font-size:21px}.pulse-intel-source{display:block;margin-top:8px;color:#b4235a;font-size:11px}.pulse-intel-empty{padding:18px;border:1px dashed #cfd5df;border-radius:14px;display:grid;gap:7px}.pulse-intel-empty span{color:#667085}@media(max-width:800px){.pulse-intel-head{display:block}.pulse-intel-grid{grid-template-columns:1fr}.pulse-intelligence-panel{padding:14px}}
';
    document.head.appendChild(style);
  }

  function boot() {
    styles();
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();