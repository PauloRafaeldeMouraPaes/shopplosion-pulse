/* Shopplosion Pulse — next-level intelligence runtime
 * No invented market values. Historical series and category roles are explicit, auditable and provenance-aware.
 */
(function(w,d){'use strict';
  var PERIOD_KEY='serie_historica', ROLE_KEY='papel_ideal', LOCAL_KEY='PULSE_LOCAL_EVIDENCE';
  var safeArray=function(v){return Array.isArray(v)?v:[]};
  var finite=function(v){return Number.isFinite(Number(v))};
  var clean=function(v){return String(v==null?'':v).trim()};
  var series=safeArray(w[PERIOD_KEY]);
  var roles=safeArray(w[ROLE_KEY]);
  w[PERIOD_KEY]=series;
  w[ROLE_KEY]=roles;
  w.PULSE_NEXT_LEVEL=w.PULSE_NEXT_LEVEL||{};
  function addSeries(row){
    if(!row || !clean(row.period) || !finite(row.value)) return null;
    var item={period:clean(row.period),value:Number(row.value),source:clean(row.source)||null,geography:clean(row.geography)||null,metric:clean(row.metric)||null,provenance:clean(row.provenance)||'evidência fornecida'};
    series.push(item); return item;
  }
  function compare(a,b){
    if(!finite(a)||!finite(b)) return {status:'unavailable',delta:null,deltaPct:null,causal:false};
    var x=Number(a),y=Number(b),delta=x-y; return {status:'observed_change',delta:delta,deltaPct:y===0?null:delta/Math.abs(y)*100,causal:false};
  }
  function setRole(category,role,evidence){
    var item={category:clean(category)||null,role:clean(role)||'heuristic',evidenceCount:safeArray(evidence).length,provenance:'heurística; validar antes de decisão'};
    roles.push(item); return item;
  }
  function executive(items){
    var arr=safeArray(items).filter(function(x){return x&&clean(x.claim)}).slice(0,4);
    if(!arr.length) return {status:'insufficient',text:'Evidência insuficiente para síntese executiva.'};
    return {status:'observed',text:arr.map(function(x){return clean(x.claim)}).join(' · ')};
  }
  function historicalSummary(){
    if(series.length<2) return {status:'insufficient',message:'Adicione pelo menos dois períodos comparáveis.'};
    var ordered=series.slice().sort(function(a,b){return String(a.period).localeCompare(String(b.period))});
    var prev=ordered[ordered.length-2],cur=ordered[ordered.length-1];
    var c=compare(cur.value,prev.value); return {status:c.status,current:cur,previous:prev,delta:c.delta,deltaPct:c.deltaPct,causal:false};
  }
  w.PULSE_NEXT_LEVEL.addHistoricalObservation=addSeries;
  w.PULSE_NEXT_LEVEL.compareSeries=compare;
  w.PULSE_NEXT_LEVEL.setCategoryRole=setRole;
  w.PULSE_NEXT_LEVEL.executiveSummary=executive;
  w.PULSE_NEXT_LEVEL.historicalSummary=historicalSummary;
  w.PULSE_NEXT_LEVEL.contracts={serie_historica:'historical observations with period/value/source provenance',papel_ideal:'auditable heuristic only',PULSE_LOCAL_EVIDENCE:'browser-local provenance-rich studies'};
  function mount(){
    if(d.getElementById('pulse-next-level-intelligence')) return;
    var host=d.querySelector('#intelligence-lab,#intelligenceLab,[data-section="intelligence-lab"]')||d.querySelector('main')||d.body;
    var s=d.createElement('section');s.id='pulse-next-level-intelligence';s.className='pulse-card';
    s.innerHTML='<div class="pulse-card-head"><div><small>NEXT-LEVEL</small><h3>Tendência, papel e síntese</h3></div><span class="confidence">Sem causalidade</span></div><div class="pulse-grid"><div><b>Série histórica</b><p id="pulse-history-status">'+(series.length?series.length+' observação(ões)':'Sem série histórica fornecida')+'</p></div><div><b>Papel ideal</b><p id="pulse-role-status">'+(roles.length?roles.length+' papel(is) heurístico(s)':'Heurística ainda não definida')+'</p></div><div><b>Base local</b><p id="pulse-local-status">'+(safeArray(w[LOCAL_KEY]).length)+' estudo(s) local(is)</p></div></div><div class="pulse-executive" id="pulse-executive-summary"><b>Síntese executiva</b><p>Separar evidência observada, interpretação, hipótese e próxima ação.</p></div></div>';
    host.appendChild(s);
    var h=historicalSummary(); if(h.status==='observed_change'){var p=d.getElementById('pulse-history-status');if(p)p.textContent='Última variação observada: '+(h.deltaPct==null?'n/d':h.deltaPct.toFixed(1)+'%')+' · causalidade não inferida';}
  }
  if(d.readyState==='loading') d.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})(window,document);