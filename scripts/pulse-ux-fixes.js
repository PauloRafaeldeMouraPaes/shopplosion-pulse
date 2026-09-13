(function(){
  'use strict';
  var NAV={'#overview':'#overview','#signals':'#signals','#diagnostic':'#diagnostic','#opportunities':'#opportunities','#investigate':'#investigate','#answer-custom':'#investigate','#answer-channel':'#investigate','#answer-occasion':'#investigate','#answer-pack':'#investigate','#answer-premium':'#investigate'};
  function qs(s,r){return(r||document).querySelector(s)} function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function normalizeHash(h){var v=h||'#overview';return NAV[v]?v:'#overview'} function getActiveNav(h){return NAV[h]||'#overview'}
  function setJourney(step){var labels={1:'Comece aqui',2:'O que mudou?',3:'Por que mudou?',4:'Onde crescer?',5:'Investigar'},current=document.getElementById('journey-current-step'),label=document.getElementById('journey-current-label');if(current)current.textContent=String(step).padStart(2,'0');if(label)label.textContent=labels[step];qsa('.journey-map-global .journey-step').forEach(function(el){var n=Number(el.dataset.step);el.classList.toggle('is-current',n===step);el.classList.toggle('is-complete',n<step);if(n===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')})}
  function route(hash,replace){hash=normalizeHash(hash);var target=getActiveNav(hash);qsa('main .screen').forEach(function(screen){var active=screen.id===target.slice(1);if(hash==='#answer-custom')active=screen.id==='answer-custom'||screen.id==='investigate';if(hash==='#answer-channel')active=screen.id==='answer-channel';if(hash==='#answer-occasion')active=screen.id==='answer-occasion';if(hash==='#answer-pack')active=screen.id==='answer-pack';if(hash==='#answer-premium')active=screen.id==='answer-premium';screen.style.display=active?'block':'none';screen.setAttribute('aria-hidden',active?'false':'true')});qsa('aside .nav').forEach(function(link){var href=link.getAttribute('href')||'#overview',active=getActiveNav(hash)===href;link.classList.toggle('active',active);link.classList.toggle('is-active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});var stepMap={'#overview':1,'#signals':2,'#diagnostic':3,'#opportunities':4,'#investigate':5,'#answer-custom':5,'#answer-channel':5,'#answer-occasion':5,'#answer-pack':5,'#answer-premium':5};setJourney(stepMap[hash]||1);if(replace)history.replaceState(null,'',hash);else if(location.hash!==hash)history.pushState(null,'',hash);window.scrollTo({top:0,behavior:'smooth'});if(hash==='#answer-custom'&&typeof window.pulseRenderCustomAnswer==='function')window.pulseRenderCustomAnswer()}
  function bindNavigation(){qsa('a[href^="#"]').forEach(function(link){var href=link.getAttribute('href');if(!NAV[href])return;link.addEventListener('click',function(event){event.preventDefault();route(href,false)})});window.addEventListener('hashchange',function(){route(location.hash,true)});window.addEventListener('popstate',function(){route(location.hash,true)})}
  function addStyles(){if(document.getElementById('pulse-ux-fixes-styles'))return;var style=document.createElement('style');style.id='pulse-ux-fixes-styles';style.textContent='aside .nav.is-active,aside .nav.active{background:#1f3b6d!important;color:#fff!important;font-weight:900!important;border-radius:10px!important;}aside .nav.is-active .nav-sub,aside .nav.active .nav-sub{color:#dbe7ff!important;}.journey-map-global .journey-step{transition:all .18s ease;border-color:#e4e7ec!important}.journey-map-global .journey-step.is-current{border-color:#e51b67!important;background:#fff0f6!important;box-shadow:0 0 0 2px rgba(229,27,103,.10)!important}.journey-map-global .journey-step.is-current .step-number{color:#e51b67!important;font-weight:900!important}.journey-map-global .journey-step.is-complete{opacity:.86}[data-evidence-id].pulse-category-hidden{display:none!important}[data-evidence-id].pulse-category-match{border-color:#e51b67!important;box-shadow:0 0 0 2px rgba(229,27,103,.08)!important}.pulse-category-badge{display:inline-flex;margin:0 0 7px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.04em;background:#eef2f6;color:#667085}.pulse-category-badge.is-specific{background:#fde7f0;color:#b4235a}.pulse-category-empty{display:grid;gap:5px;margin:12px 0;padding:14px;border:1px dashed #d0d5dd;border-radius:10px;background:#f8f9fc;color:#475467}.pulse-category-empty[hidden]{display:none!important}.pulse-category-empty strong{font-size:13px;color:#101828}.pulse-category-empty span{font-size:12px;line-height:1.45}';document.head.appendChild(style)}
  function init(){addStyles();bindNavigation();route(location.hash||'#overview',true)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.PULSE_NAV_SECTIONS=NAV;
})();

/* Pulse visual shell: thin trend line using only explicit series/trend values or observed evidence periods. */
(function(){
  'use strict';
  function qsa(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
  function nums(v){return Array.isArray(v)?v.map(Number).filter(Number.isFinite):String(v||'').split(/[,;\s]+/).map(Number).filter(Number.isFinite)}
  function cardSeries(card){
    var attrs=['data-series','data-trend','data-sparkline'];
    for(var i=0;i<attrs.length;i++){
      var raw=card.getAttribute(attrs[i]);
      if(raw){try{var parsed=JSON.parse(raw);var values=nums(parsed);if(values.length>=2)return values}catch(e){var fallback=nums(raw);if(fallback.length>=2)return fallback}}
    }
    var pool=window.PULSE_EVIDENCE||window.__PULSE_EVIDENCE||window.PULSE_SOURCES||[];
    if(!Array.isArray(pool)||pool.length<2)return [];
    var label=(card.querySelector('h3,h4,strong,[data-label],.label,.metric-label,.kpi-label')||{}).textContent||'';
    var words=label.toLowerCase().split(/\W+/).filter(function(w){return w.length>3});
    var matched=pool.filter(function(o){var text=[o.category,o.topic,o.channel,o.name,o.title].filter(Boolean).join(' ').toLowerCase();return words.some(function(w){return text.indexOf(w)>=0})});
    if(matched.length<2)matched=pool;
    var periods={};matched.forEach(function(o){var p=o.date||o.published_at||o.publishedAt||o.period||o.year;if(p)periods[String(p)]=(periods[String(p)]||0)+1});
    var keys=Object.keys(periods).sort().slice(-8);if(keys.length<2)return [];
    var out=keys.map(function(k){return periods[k]});return out.some(function(v){return v!==out[0]})?out:[];
  }
  function draw(card){
    if(card.querySelector('.pulse-indicator-sparkline-wrap'))return;
    var values=cardSeries(card);if(values.length<2)return;
    var width=180,height=28,min=Math.min.apply(Math,values),span=Math.max.apply(Math,values)-min||1;
    var path=values.map(function(v,i){var x=i/(values.length-1)*width,y=height-3-(v-min)/span*(height-7);return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}).join(' ');
    var wrap=document.createElement('div');wrap.className='pulse-indicator-sparkline-wrap';wrap.setAttribute('aria-label','Tendência histórica observada');
    wrap.innerHTML='<svg class="pulse-indicator-sparkline" viewBox="0 0 180 28" preserveAspectRatio="none" role="img"><path class="baseline" d="M0 25 H180"></path><path d="'+path+'"></path></svg>';
    card.appendChild(wrap);
  }
  function run(){
    var seen=[];['[data-indicator-card]','.indicator-card','.metric-card','.kpi-card','.stat-card','.pulse-kpi','.pulse-indicator'].forEach(function(sel){qsa(sel).forEach(function(card){if(seen.indexOf(card)<0){seen.push(card);draw(card)}})});
  }
  function init(){
    if(document.getElementById('pulse-indicator-sparkline-styles'))return;
    var style=document.createElement('style');style.id='pulse-indicator-sparkline-styles';style.textContent='.pulse-indicator-sparkline-wrap{margin-top:10px}.pulse-indicator-sparkline{display:block;width:100%;height:28px;overflow:visible}.pulse-indicator-sparkline path{fill:none;stroke:var(--pink,#E51B67);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.pulse-indicator-sparkline .baseline{stroke:rgba(20,19,27,.08);stroke-width:1}';document.head.appendChild(style);run();new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
