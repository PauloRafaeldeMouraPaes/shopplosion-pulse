(function(){
  'use strict';

  var NAV = {
    '#overview': '#overview',
    '#signals': '#signals',
    '#diagnostic': '#diagnostic',
    '#opportunities': '#opportunities',
    '#investigate': '#investigate',
    '#answer-custom': '#investigate',
    '#answer-channel': '#investigate',
    '#answer-occasion': '#investigate',
    '#answer-pack': '#investigate',
    '#answer-premium': '#investigate'
  };

  var CATEGORY_META = {
    chocolates: { label: 'Chocolates', ids: ['premium', 'indulgencia-seletiva'] },
    bebidas: { label: 'Bebidas', ids: ['ocasiao'] },
    saude: { label: 'Saúde & bem-estar', ids: ['saude-bemestar'] },
    geral: { label: 'Visão transversal', ids: ['canal', 'pack', 'promocao', 'frequencia', 'confianca-financeira', 'varejo-geral', 'scanntech-radar'] }
  };

  function qs(selector, root){ return (root || document).querySelector(selector); }
  function qsa(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function normalizeHash(hash){ var value = hash || '#overview'; return NAV[value] ? value : '#overview'; }
  function getActiveNav(hash){ return NAV[hash] || '#overview'; }

  function setJourney(step){
    var labels = {1:'Comece aqui',2:'O que mudou?',3:'Por que mudou?',4:'Onde crescer?',5:'Investigar'};
    var current = document.getElementById('journey-current-step');
    var label = document.getElementById('journey-current-label');
    if(current) current.textContent = String(step).padStart(2,'0');
    if(label) label.textContent = labels[step];
    qsa('.journey-map-global .journey-step').forEach(function(el){
      var n = Number(el.dataset.step);
      el.classList.toggle('is-current', n === step);
      el.classList.toggle('is-complete', n < step);
      if(n === step) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current');
    });
  }

  function route(hash, replace){
    hash = normalizeHash(hash);
    var targetHash = getActiveNav(hash);
    qsa('main .screen').forEach(function(screen){
      var active = screen.id === targetHash.slice(1);
      if(hash === '#answer-custom') active = screen.id === 'answer-custom' || screen.id === 'investigate';
      if(hash === '#answer-channel') active = screen.id === 'answer-channel';
      if(hash === '#answer-occasion') active = screen.id === 'answer-occasion';
      if(hash === '#answer-pack') active = screen.id === 'answer-pack';
      if(hash === '#answer-premium') active = screen.id === 'answer-premium';
      screen.style.display = active ? 'block' : 'none';
      screen.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    qsa('aside .nav').forEach(function(link){
      var href = link.getAttribute('href') || '#overview';
      var active = getActiveNav(hash) === href;
      link.classList.toggle('active', active);
      link.classList.toggle('is-active', active);
      if(active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });

    var stepMap = {'#overview':1,'#signals':2,'#diagnostic':3,'#opportunities':4,'#investigate':5,'#answer-custom':5,'#answer-channel':5,'#answer-occasion':5,'#answer-pack':5,'#answer-premium':5};
    setJourney(stepMap[hash] || 1);
    if(replace) history.replaceState(null,'',hash); else if(location.hash !== hash) history.pushState(null,'',hash);
    window.scrollTo({top:0, behavior:'smooth'});
    if(hash === '#answer-custom' && typeof window.pulseRenderCustomAnswer === 'function') window.pulseRenderCustomAnswer();
  }

  function bindNavigation(){
    qsa('a[href^="#"]').forEach(function(link){
      var href = link.getAttribute('href');
      if(!NAV[href]) return;
      link.addEventListener('click', function(event){ event.preventDefault(); route(href, false); });
    });
    window.addEventListener('hashchange', function(){ route(location.hash, true); });
    window.addEventListener('popstate', function(){ route(location.hash, true); });
  }

  function classify(id){
    for(var key in CATEGORY_META){ if(CATEGORY_META[key].ids.indexOf(id) !== -1) return key; }
    return 'geral';
  }

  function setupCategoryFilter(){
    var select = document.getElementById('pulse-category-select');
    if(!select) return;
    var desired = [['all','Todas as categorias'],['chocolates','Chocolates'],['bebidas','Bebidas'],['saude','Saúde & bem-estar'],['geral','Visão transversal']];
    select.innerHTML = desired.map(function(item){ return '<option value="'+item[0]+'">'+item[1]+'</option>'; }).join('');
    try{ var saved = localStorage.getItem('pulsePrimaryCategory'); if(saved && desired.some(function(item){ return item[0] === saved; })) select.value = saved; }catch(e){}

    function apply(){
      var chosen = select.value || 'all';
      try{ localStorage.setItem('pulsePrimaryCategory', chosen); }catch(e){}
      ['#signals .rows', '#opportunities .opp'].forEach(function(rootSelector){
        var root = qs(rootSelector); if(!root) return;
        qsa('[data-evidence-id]', root).forEach(function(card, index){
          if(!card.dataset.pulseUxOrder) card.dataset.pulseUxOrder = String(index);
          var category = classify(card.dataset.evidenceId);
          var specific = chosen === 'all' || category === chosen;
          card.classList.toggle('pulse-category-hidden', !specific);
          card.classList.toggle('pulse-category-match', chosen !== 'all' && category === chosen);
          card.dataset.pulseCategory = category;
          var badge = card.querySelector(':scope > .pulse-category-badge');
          if(!badge){ badge = document.createElement('span'); badge.className = 'pulse-category-badge'; card.insertBefore(badge, card.firstChild); }
          badge.textContent = chosen !== 'all' && category === chosen ? 'DA SUA CATEGORIA' : (category === 'geral' ? 'VISÃO TRANSVERSAL' : CATEGORY_META[category].label.toUpperCase());
          badge.classList.toggle('is-specific', chosen !== 'all' && category === chosen);
          badge.classList.toggle('is-general', chosen === 'all' || category === 'geral');
        });
      });
      qsa('[data-filter-summary="signals"]').forEach(function(el){ el.textContent = qsa('#signals .rows [data-evidence-id]:not(.pulse-category-hidden)').length + ' sinais exibidos'; });
      qsa('[data-filter-summary="opportunities"]').forEach(function(el){ el.textContent = qsa('#opportunities .opp [data-evidence-id]:not(.pulse-category-hidden)').length + ' oportunidades exibidas'; });
    }
    select.addEventListener('change', apply);
    apply();
  }

  function addStyles(){
    if(document.getElementById('pulse-ux-fixes-styles')) return;
    var style = document.createElement('style'); style.id = 'pulse-ux-fixes-styles';
    style.textContent = '\n'
      + 'aside .nav.is-active,aside .nav.active{background:#1f3b6d!important;color:#fff!important;font-weight:900!important;border-radius:10px!important;}\n'
      + 'aside .nav.is-active .nav-sub,aside .nav.active .nav-sub{color:#dbe7ff!important;}\n'
      + '.journey-map-global .journey-step{transition:all .18s ease;border-color:#e4e7ec!important;}\n'
      + '.journey-map-global .journey-step.is-current{border-color:#e51b67!important;background:#fff0f6!important;box-shadow:0 0 0 2px rgba(229,27,103,.10)!important;}\n'
      + '.journey-map-global .journey-step.is-current .step-number{color:#e51b67!important;font-weight:900!important;}\n'
      + '.journey-map-global .journey-step.is-complete{opacity:.86;}\n'
      + '[data-evidence-id].pulse-category-hidden{display:none!important;}\n'
      + '[data-evidence-id].pulse-category-match{border-color:#e51b67!important;box-shadow:0 0 0 2px rgba(229,27,103,.08)!important;}\n'
      + '.pulse-category-badge{display:inline-flex;margin:0 0 7px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.04em;background:#eef2f6;color:#667085;}\n'
      + '.pulse-category-badge.is-specific{background:#fde7f0;color:#b4235a;}\n';
    document.head.appendChild(style);
  }

  function init(){ addStyles(); bindNavigation(); setupCategoryFilter(); route(location.hash || '#overview', true); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.PULSE_NAV_SECTIONS = NAV;
  window.PULSE_CATEGORY_TAXONOMY = CATEGORY_META;
})();
