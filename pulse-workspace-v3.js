(()=>{if(window.__PULSE_WORKSPACE_V5__)return;window.__PULSE_WORKSPACE_V5__=true;
'use strict';
/* Compatibility contract: legacy single-file consumers keep their public registries,
   while the canonical workspace owns all visible UI and navigation. */
window.PULSE_LOCAL_EVIDENCE = Array.isArray(window.PULSE_LOCAL_EVIDENCE) ? window.PULSE_LOCAL_EVIDENCE : [];
window.serie_historica = Array.isArray(window.serie_historica) ? window.serie_historica : [];
window.papel_ideal = Array.isArray(window.papel_ideal) ? window.papel_ideal : [];
window.PULSE_NEXT_LEVEL = window.PULSE_NEXT_LEVEL || {};
/* PULSE_NEXT_LEVEL_CONTRACT_START
   Next-level data contract (serie_historica, papel_ideal, PULSE_LOCAL_EVIDENCE, executive synthesis).
   Dependency-free: no DOM access inside this block, so scripts/test-pulse-next-level-contract.js can
   evaluate it under Node. Rules: never invent values, keep provenance, separate observation from
   interpretation, never declare causality (every comparison carries causal:false). */
(()=>{
  const api=window.PULSE_NEXT_LEVEL;
  const clean=v=>String(v??'').trim();
  const arr=v=>Array.isArray(v)?v:[];
  const norm=v=>clean(v).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ');
  const UNDECLARED='[A DEFINIR]';
  const CONTRACT_VERSION='2026-10-31';
  const PERIOD_RE=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
  const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  const fingerprint=s=>{let h=5381;const t=norm(s);for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return (h>>>0).toString(36)};
  /* Period parsing: granularity is explicit so a year is never compared with a month. */
  const parsePeriod=v=>{const m=PERIOD_RE.exec(clean(v));if(!m)return null;const y=+m[1],mo=m[2]?+m[2]:null,d=m[3]?+m[3]:null;if(mo!==null&&(mo<1||mo>12))return null;if(d!==null){const dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null}return {text:clean(v),year:y,month:mo,day:d,granularity:d!==null?'day':mo!==null?'month':'year'}};
  const periodIndex=p=>p.granularity==='year'?p.year:p.granularity==='month'?p.year*12+(p.month-1):Math.round(Date.UTC(p.year,p.month-1,p.day)/86400000);
  /* Strict numeric parsing: a number, or a plain decimal string with '.' or ',' as separator. Whitespace-only,
     booleans, arrays, hex, exponents and anything else are not values (absent or invalid, never zero). */
  const NUMBER_RE=/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
  const numberValue=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string')return null;const t=v.trim();if(!NUMBER_RE.test(t))return null;const n=Number(t.replace(',','.'));return Number.isFinite(n)?n:null};
  const requireFields=(row,fields)=>fields.filter(f=>!clean(row&&row[f]));
  const rejected=(reason,extra)=>Object.assign({status:'rejected',reason,causal:false},extra||{});

  /* Pure comparison of two numeric values. Zero is a value; null/undefined/NaN is an absence. */
  api.compareSeries=(current,previous)=>{
    const x=numberValue(current),y=numberValue(previous);
    if(x===null||y===null)return {status:'unavailable',reason:x===null&&y===null?'both_values_missing':x===null?'current_value_missing':'previous_value_missing',delta:null,deltaPct:null,direction:null,causal:false};
    const delta=x-y;
    return {status:'observed_change',delta,deltaPct:y===0?null:delta/Math.abs(y)*100,deltaPctReason:y===0?'previous_value_is_zero':null,direction:delta>0?'up':delta<0?'down':'no_change',causal:false};
  };

  /* B.1 Historical series */
  api.validateHistoricalObservation=row=>{
    if(!row||typeof row!=='object')return rejected('invalid',{missing:[],invalid:['row']});
    const missing=requireFields(row,['period','source','geography','metric','provenance']);
    const invalid=[];
    const period=parsePeriod(row.period);
    if(clean(row.period)&&!period)invalid.push('period');
    const hasValue=typeof row.value==='number'||(typeof row.value==='string'&&clean(row.value)!=='');
    if(!hasValue)missing.push('value');else if(numberValue(row.value)===null)invalid.push('value');
    if(missing.length)return rejected('incomplete',{missing,invalid});
    if(invalid.length)return rejected('invalid',{missing,invalid});
    return {status:'valid',period,value:numberValue(row.value)};
  };
  const observationKey=i=>[i.metric,i.geography,i.unit,i.source,i.methodology||UNDECLARED,i.period].map(norm).join('|');
  api.addHistoricalObservation=row=>{
    const check=api.validateHistoricalObservation(row);
    if(check.status!=='valid')return check;
    const item={
      id:'',period:check.period.text,granularity:check.period.granularity,value:check.value,
      metric:clean(row.metric),unit:clean(row.unit)||UNDECLARED,geography:clean(row.geography),
      source:clean(row.source),methodology:clean(row.methodology)||UNDECLARED,provenance:clean(row.provenance),
      url:clean(row.url)||null,limitations:arr(row.limitations).map(clean).filter(Boolean),status:'valid',
      evidenceId:clean(row.evidenceId)||null
    };
    item.id='sh-'+fingerprint(observationKey(item));
    const existing=window.serie_historica.find(x=>observationKey(x)===observationKey(item));
    if(existing){
      if(existing.value===item.value)return {status:'duplicate',item:existing,causal:false};
      return {status:'conflict',reason:'same_period_metric_geography_source_unit_methodology_with_different_value',item,existing,causal:false};
    }
    window.serie_historica.push(item);
    return {status:'added',item,causal:false};
  };
  const comparabilityKey=i=>[i.metric,i.geography,i.unit,i.source,i.methodology,i.granularity].map(norm).join('|');
  const periodsAdjacent=(a,b)=>periodIndex(b)-periodIndex(a)===1;
  const sameMonthPreviousYear=(cur,rows)=>{if(cur.granularity!=='month')return null;const p=parsePeriod(cur.period);return rows.find(r=>{const q=parsePeriod(r.period);return q&&q.month===p.month&&q.year===p.year-1})||null};
  api.historicalSummary=(metric,geography,options)=>{
    const opt=options||{};
    const rows=window.serie_historica.filter(x=>x&&x.status==='valid'&&(!metric||norm(x.metric)===norm(metric))&&(!geography||norm(x.geography)===norm(geography))&&(!opt.source||norm(x.source)===norm(opt.source))&&(!opt.unit||norm(x.unit)===norm(opt.unit)));
    const base={metric:metric||null,geography:geography||null,count:rows.length,causal:false,interpretation:null};
    if(rows.length<2)return Object.assign(base,{status:'insufficient',reason:'too_few_observations',message:'São necessários pelo menos dois períodos com a mesma métrica, geografia, unidade, fonte e granularidade.'});
    const groups=new Map();rows.forEach(x=>{const k=comparabilityKey(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});
    const latestIndex=g=>Math.max(...g.map(x=>periodIndex(parsePeriod(x.period))));
    const candidates=[...groups.values()].filter(g=>g.length>=2).sort((a,b)=>b.length-a.length||latestIndex(b)-latestIndex(a));
    const comparable=candidates[0];
    if(!comparable){
      const dims=['unit','source','methodology','granularity'].filter(d=>new Set(rows.map(r=>norm(r[d]))).size>1);
      return Object.assign(base,{status:'not_comparable',reason:'mixed_'+(dims[0]||'dimensions'),mixedDimensions:dims,groups:groups.size,message:'As observações existem, mas diferem em '+(dims.length?dims.join(', '):'dimensões de comparabilidade')+'. O Pulse não compara séries com unidade, fonte, metodologia ou granularidade diferentes.'});
    }
    comparable.sort((a,b)=>periodIndex(parsePeriod(a.period))-periodIndex(parsePeriod(b.period)));
    const current=comparable[comparable.length-1],previous=comparable[comparable.length-2];
    const cmp=api.compareSeries(current.value,previous.value);
    const pa=parsePeriod(previous.period),pc=parsePeriod(current.period);
    const consecutive=periodsAdjacent(pa,pc);
    const limitations=[];
    if(!consecutive)limitations.push('Os períodos comparados não são consecutivos ('+previous.period+' → '+current.period+'); há lacuna na série.');
    if(current.unit===UNDECLARED)limitations.push('Unidade não declarada na série; a comparação assume a mesma unidade em todas as observações.');
    if(current.methodology===UNDECLARED)limitations.push('Metodologia não declarada; mudanças de método entre períodos não podem ser excluídas.');
    if(comparable.length<3)limitations.push('Apenas '+comparable.length+' observações comparáveis; não há base para falar em tendência.');
    const excluded=rows.length-comparable.length;
    if(excluded>0){const dims=['unit','source','methodology','granularity'].filter(d=>new Set(rows.map(r=>norm(r[d]))).size>1);limitations.push(excluded+(excluded===1?' observação':' observações')+' com outra '+(dims.length?dims.map(d=>({unit:'unidade',source:'fonte',methodology:'metodologia',granularity:'granularidade'})[d]).join('/'):'dimensão')+' não entram nesta comparação; o maior grupo comparável foi usado'+(candidates.length>1&&candidates[1].length===comparable.length?' (empate resolvido pelo período mais recente)':'')+'.')}
    limitations.push('Fonte única ('+current.source+'); a variação não foi corroborada por fonte independente.');
    const yoyRow=sameMonthPreviousYear(current,comparable.slice(0,-1));
    const yearOverYear=yoyRow?Object.assign({previous:yoyRow},api.compareSeries(current.value,yoyRow.value)):null;
    const fmt=v=>String(v).replace('.',',');
    const observation=cmp.direction==='no_change'
      ?'Sem variação observada em '+current.metric+' ('+current.geography+'): '+fmt(previous.value)+' em '+previous.period+' e '+fmt(current.value)+' em '+current.period+(current.unit!==UNDECLARED?' '+current.unit:'')+'.'
      :'Variação observada em '+current.metric+' ('+current.geography+'): de '+fmt(previous.value)+' em '+previous.period+' para '+fmt(current.value)+' em '+current.period+(current.unit!==UNDECLARED?' '+current.unit:'')+(cmp.deltaPct!==null?' ('+(cmp.deltaPct>0?'+':'')+fmt(cmp.deltaPct.toFixed(1))+'%)':'')+'.';
    return Object.assign(base,{status:cmp.status,current,previous,delta:cmp.delta,deltaPct:cmp.deltaPct,deltaPctReason:cmp.deltaPctReason,direction:cmp.direction,consecutive,comparedAgainst:'previous_period',yearOverYear,count:comparable.length,excluded,groups:groups.size,source:current.source,unit:current.unit,methodology:current.methodology,granularity:current.granularity,limitations,observation,message:'Variação observada, não explicada. O contrato não atribui causa.'});
  };

  /* B.2 Category role: always a heuristic. */
  api.setCategoryRole=(category,role,evidence,options)=>{
    const opt=options||{};
    if(!clean(category)||!clean(role))return rejected('incomplete',{missing:['category','role'].filter(f=>!clean(f==='category'?category:role))});
    const refs=arr(evidence).map(e=>typeof e==='object'&&e?{id:clean(e.id)||null,source:clean(e.source||e.fonte)||null,provenance:clean(e.provenance||e.fonte_primaria)||null,quality:clean(e.quality)||null}:{id:clean(e)||null,source:null,provenance:null,quality:null}).filter(e=>e.id||e.source);
    const withProvenance=refs.filter(e=>e.provenance).length;
    const AUTO=/^(Nenhuma evidência registrada para este papel|\d+ de \d+ evidências sem proveniência declarada)/;
    const limitations=arr(opt.limitations).map(clean).filter(x=>x&&!AUTO.test(x));
    if(!refs.length)limitations.unshift('Nenhuma evidência registrada para este papel; trata-se de hipótese sem sustentação.');
    else if(withProvenance<refs.length)limitations.unshift((refs.length-withProvenance)+' de '+refs.length+' evidências sem proveniência declarada.');
    const confIn=opt.confidence&&typeof opt.confidence==='object'?opt.confidence:{level:opt.confidence,basis:opt.confidenceBasis};
    const confidenceBasis=clean(confIn.basis);
    const declared=clean(confIn.level)&&clean(confIn.level)!=='não declarada'&&confidenceBasis&&!/^Grau de confiança só é registrado/.test(confidenceBasis);
    const confidence=declared?{level:clean(confIn.level),basis:confidenceBasis}:{level:'não declarada',basis:'Grau de confiança só é registrado quando acompanhado da justificativa metodológica.'};
    const item={
      category:clean(category),role:clean(role),status:'heuristic',
      provenance:'heurística; não é fato de mercado',
      evidence:refs,evidenceCount:refs.length,evidenceWithProvenance:withProvenance,
      evidenceQuality:refs.length?(withProvenance===refs.length?'proveniência completa':withProvenance?'proveniência parcial':'sem proveniência'):'sem evidência',
      confidence,limitations,
      competingHypotheses:arr(opt.competingHypotheses).map(clean).filter(Boolean),
      reviewConditions:arr(opt.reviewConditions).map(clean).filter(Boolean),
      recordedAt:clean(opt.recordedAt)||null
    };
    if(!item.reviewConditions.length)item.reviewConditions.push('Revisar quando surgir evidência específica da categoria que contradiga o papel proposto.');
    window.papel_ideal=window.papel_ideal.filter(x=>norm(x.category)!==norm(item.category));
    window.papel_ideal.push(item);
    return {status:'added',item,causal:false};
  };

  /* B.3 Local evidence: same vocabulary as PULSE_EVIDENCE so the Inspector can read it. */
  const localFingerprint=r=>fingerprint([r.claim,r.source,r.geography,r.date].map(clean).join('|'));
  api.validateLocalEvidence=row=>{
    if(!row||typeof row!=='object')return {status:'rejected',reason:'invalid',missing:[],invalid:['row']};
    const missing=requireFields(row,['claim','source','geography','date','provenance']);
    const invalid=[];
    if(clean(row.date)&&!DATE_RE.test(clean(row.date))&&!PERIOD_RE.test(clean(row.date)))invalid.push('date');
    if(missing.length)return {status:'incomplete',missing,invalid};
    if(invalid.length)return {status:'rejected',reason:'invalid',missing,invalid};
    return {status:'valid',missing:[],invalid:[]};
  };
  api.addLocalEvidence=row=>{
    const check=api.validateLocalEvidence(row);
    if(check.status!=='valid')return Object.assign({status:'rejected',reason:check.status==='incomplete'?'incomplete':check.reason},{missing:check.missing,invalid:check.invalid});
    const fp=localFingerprint(row);
    const item={
      id:clean(row.id)||'local-'+fp,fingerprint:fp,claim:clean(row.claim),source:clean(row.source),geography:clean(row.geography),date:clean(row.date),
      provenance:clean(row.provenance),url:clean(row.url)||null,natureza:clean(row.natureza)||UNDECLARED,universo_observado:clean(row.universo_observado)||clean(row.geography),
      limitations:arr(row.limitations).map(clean).filter(Boolean),status:'valid',evidenceType:'local'
    };
    /* Duplicates are decided by the normalised content, not by the 32-bit fingerprint, which only names the id. */
    const sameContent=x=>['claim','source','geography','date'].every(f=>norm(x[f])===norm(item[f]));
    const existing=window.PULSE_LOCAL_EVIDENCE.find(x=>x&&(x.id===item.id||sameContent(x)));
    if(existing)return {status:'duplicate',item:existing,matchedBy:existing.id===item.id?'id':'content'};
    window.PULSE_LOCAL_EVIDENCE.push(item);
    return {status:'added',item};
  };
  api.localEvidenceAsEvidence=item=>({
    id:item.id,categoria:clean(item.categoria)||'evidência local',tipo:'evidência local',fato:item.claim,contexto:'Evidência local registrada pelo workspace. Limitações: '+(arr(item.limitations).length?item.limitations.join('; '):'não declaradas')+'.',
    interpretacao:'',hipotese:'',acao:'Validar a evidência local contra uma fonte independente antes de usá-la em decisão.',fonte:item.source,url:item.url||'',periodo:item.date,
    natureza:item.natureza,universo_observado:item.universo_observado,fonte_primaria:item.provenance,fato_verificado_na_fonte:UNDECLARED,representa:UNDECLARED,nao_representa:'Não representa o mercado fora do universo local observado.',alcance_para_pergunta:UNDECLARED
  });
  api.loadLocalEvidence=rows=>{const r={added:0,duplicate:0,rejected:0,results:[]};arr(rows).forEach(x=>{const out=api.addLocalEvidence(x);r[out.status==='added'?'added':out.status==='duplicate'?'duplicate':'rejected']++;r.results.push(out)});return r};
  api.loadHistoricalObservations=rows=>{const r={added:0,duplicate:0,conflict:0,rejected:0,results:[]};arr(rows).forEach(x=>{const out=api.addHistoricalObservation(x);r[out.status in r?out.status:'rejected']++;r.results.push(out)});return r};
  /* Public evidence items may declare an explicit numeric series block; free-text periods are never parsed. */
  api.loadFromEvidence=items=>api.loadHistoricalObservations(arr(items).flatMap(e=>arr(e&&e.serie_historica).map(s=>Object.assign({source:e.fonte,url:e.url,provenance:e.fonte_primaria&&e.fonte_primaria!==UNDECLARED?e.fonte_primaria:e.fonte,geography:e.universo_observado||e.universo},s,{evidenceId:e.id}))));

  /* B.4 Executive synthesis: five explicit sections, recommendations tied to observed evidence. */
  const SECTIONS=['observed','interpretation','hypothesis','implication','action'];
  api.executiveSummary=(items,options)=>{
    const opt=options||{},limit=Number(opt.limit)||3;
    const rows=arr(items).filter(x=>x&&typeof x==='object'&&clean(x.text)).map(x=>({id:clean(x.id)||null,type:clean(x.type),text:clean(x.text),basis:arr(x.basis).map(clean).filter(Boolean),confidence:clean(x.confidence)||null}));
    const take=k=>rows.filter(x=>x.type===k);
    const observed=take('observed'),interpretations=take('interpretation'),hypotheses=take('hypothesis'),implications=take('implication');
    const observedIds=new Set(observed.flatMap(x=>x.basis.concat(x.id?[x.id]:[])));
    const warnings=[];
    rows.filter(x=>!SECTIONS.includes(x.type)).forEach(x=>warnings.push('Item ignorado: tipo desconhecido "'+x.type+'".'));
    const actions=take('action').map(a=>{const supported=a.basis.length>0&&a.basis.some(b=>observedIds.has(b));if(!a.basis.length)warnings.push('Ação sem evidência vinculada: "'+a.text+'".');else if(!supported)warnings.push('Ação com base que não aponta para evidência observada: "'+a.text+'".');return Object.assign({},a,{supported})});
    const pick=l=>l.slice(0,limit).map(x=>x.text);
    const out={status:observed.length?'available':'insufficient',contractVersion:CONTRACT_VERSION,causal:false,
      evidence:pick(observed),interpretations:pick(interpretations),hypotheses:pick(hypotheses),implications:pick(implications),
      actions:observed.length?pick(actions.filter(a=>a.supported)):[],unsupportedActions:actions.filter(a=>!a.supported||!observed.length).map(a=>a.text),
      counts:{observed:observed.length,interpretations:interpretations.length,hypotheses:hypotheses.length,implications:implications.length,actions:actions.length},warnings};
    out.observed=out.evidence;
    if(!observed.length){out.message='Evidência observada insuficiente para síntese executiva. Nenhuma recomendação é emitida sem evidência.';out.confidence='insufficient';}
    else{out.confidence=observed.length>=2?'limited':'single_observation';out.message=observed.length>=2?'Síntese baseada em '+observed.length+' observações; interpretações e hipóteses permanecem separadas da evidência.':'Síntese baseada em uma única observação; confiança limitada.';}
    return out;
  };

  /* Persistence is opt-in and never silent about failures. Observations that came from a public evidence
     item (evidenceId) are not persisted: they are rebuilt from the dataset on every load, so a revised
     series replaces the previous values instead of colliding with a stale local copy. */
  const STORAGE_KEY='pulse:next-level:v1';
  api.persist=storage=>{try{const s=storage||window.localStorage;s.setItem(STORAGE_KEY,JSON.stringify({version:CONTRACT_VERSION,serie_historica:window.serie_historica.filter(x=>x&&!x.evidenceId),papel_ideal:window.papel_ideal,local_evidence:window.PULSE_LOCAL_EVIDENCE}));return {status:'saved'}}catch(e){return {status:'storage_error',message:String(e&&e.message||e)}}};
  api.restore=storage=>{let raw=null;try{raw=(storage||window.localStorage).getItem(STORAGE_KEY)}catch(e){return {status:'storage_error',message:String(e&&e.message||e)}}if(!raw)return {status:'empty'};let data=null;try{data=JSON.parse(raw)}catch(e){return {status:'source_error',message:'Registro local corrompido; nada foi restaurado.'}}if(!data||typeof data!=='object')return {status:'source_error',message:'Registro local inválido; nada foi restaurado.'};const h=api.loadHistoricalObservations(data.serie_historica),l=api.loadLocalEvidence(data.local_evidence);arr(data.papel_ideal).forEach(r=>r&&api.setCategoryRole(r.category,r.role,r.evidence,r));return {status:'restored',historical:h,local:l,roles:arr(data.papel_ideal).length}};
  api.reset=options=>{window.serie_historica.length=0;window.papel_ideal.length=0;window.PULSE_LOCAL_EVIDENCE.length=0;const opt=options||{};if(opt.storage||opt.clearStorage){try{(opt.storage||window.localStorage).removeItem(STORAGE_KEY);return {status:'reset',storage:'cleared'}}catch(e){return {status:'reset',storage:'storage_error',message:String(e&&e.message||e)}}}return {status:'reset',storage:'kept'}};
  api.state=()=>({contractVersion:CONTRACT_VERSION,historical:window.serie_historica.length,roles:window.papel_ideal.length,local:window.PULSE_LOCAL_EVIDENCE.length});
  api.CONTRACT_VERSION=CONTRACT_VERSION;api.UNDECLARED=UNDECLARED;api.parsePeriod=parsePeriod;api.norm=norm;
})();
/* PULSE_NEXT_LEVEL_CONTRACT_END */
window.PULSE_SINGLE_FILE_READY = true;
window.pulseMatchEvidence = window.pulseMatchEvidence || ((query,items)=>{const q=String(query||'').toLowerCase();return (Array.isArray(items)?items:[]).filter(x=>JSON.stringify(x).toLowerCase().includes(q));});
window.pulseRankEvidence = window.pulseRankEvidence || ((items)=>Array.isArray(items)?items.slice():[]);
// Canonical Pulse workspace runtime: one shell, one navigation system, one inspector.
// Single-file Universe mirrors this exact runtime.
// HTML structure is validated before publication.
const path=location.pathname.split('/').pop()||'index.html', hash=location.hash.replace(/^#/,'');
if(location.pathname.endsWith('/')&&hash===''){location.replace('./intelligence.html?v=20260922.18');}
const staleSelectors=['.pulse-rail','.pulse-mainbar','.pulse-command-menu','.pv4-rail','.pv4-top','.pv4-mobile-scope','.pv4-command-menu','#pv4-inspector','#pulse-app-shell'];staleSelectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>el.remove()));document.body.classList.add('pv3-active');
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
window.PULSE_EVIDENCE_MODEL=(()=>{const n=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();const byType={'IPCA':'preço','PMC':'volume do varejo','Radar Scanntech':'transação do varejo alimentar','AbrasMercado':'preço/cesta','Consumo nos Lares Brasileiros':'consumo domiciliar','Brand Footprint 2026':'compra registrada em painel','Copa do Mundo 2026':'declaração','Private Label Adoption Report':'declaração'};const terms={'preço':['preço','preços','inflação','cesta','custo'],'volume do varejo':['volume','vendas','varejo','cresceu','crescimento','queda','recuo'],'transação do varejo alimentar':['unidades','faturamento','mesmas lojas','transação'],'compra registrada em painel':['compra','penetração','lares','marcas'],'declaração':['consumidor','shopper','pretendem','dizem','percepção','opinião'],'consumo domiciliar':['consumo','lares','abastecimento']};function inferNature(e={}){return e.natureza||byType[String(e.tipo||'')]||'[A DEFINIR]'}function inferUniverse(e={}){if(e.universo_observado)return e.universo_observado;const c=String(e.contexto||'');if(/11\.300 lares|sete regiões|82% da população domiciliar/i.test(c))return'Alcance: Brasil, 11.300 lares, sete regiões e 82% da população domiciliar';if(/mesmas lojas/i.test(c))return'Canal: varejo alimentar. Base: mesmas lojas';if(/35 produtos/i.test(c))return'Alcance: Brasil, 35 produtos de largo consumo';if(/branded in-store/i.test(c))return'Alcance: Brasil. Métrica: branded in-store. Exclui private label';if(/estudo global|global/i.test(c))return'Global';if(/São Paulo|Unidade da Federação/i.test(c))return'Localidade: São Paulo, UF';if(/Brasil/i.test(c))return'Brasil';return'[A DEFINIR]'}function assess(e={},q=''){const natureza=inferNature(e),universo_observado=inferUniverse(e),query=n(q),cat=n(e.categoria),tipo=n(e.tipo);let alcance='só contexto';if(query&&((cat&&cat!=='geral'&&query.includes(cat))||(tipo&&query.includes(tipo))))alcance='direto';else if(query&&terms[natureza]?.some(t=>query.includes(n(t))))alcance='indireto';return{natureza,universo_observado,cobertura:e.cobertura||'[A DEFINIR]',representa:e.representa||'[A DEFINIR]',nao_representa:e.nao_representa||'Não representa automaticamente uma categoria, canal, região ou negócio fora do universo observado.',fonte_primaria:e.fonte_primaria||'[A DEFINIR]',fato_verificado_na_fonte:e.fato_verificado_na_fonte||'[A DEFINIR]',alcance_para_pergunta:alcance}}return{assess}})();
const routes={hoje:'./intelligence.html?v=20260922.18',universo:'./index.html?v=20260922.18#overview',base:'./base.html?v=20260922.18#documents',investigacao:'./ask.html?v=20260922.18',analises:'./app.html?v=20260922.18#analyses'};
const scopeKey='pulse:scope';const scopeLabels={public:'Público',industry:'Minha indústria',both:'Ambos'};
let privateEvidence=[];
async function preloadPrivateEvidence(){privateEvidence=[];const scope=getScope();if(scope==='public'||!window.pulseCreateClient||!window.PULSE_SUPABASE_CONFIG)return;try{const client=pulseCreateClient();const {data,error}=await client.from('saved_evidence').select('id,evidence_id,title,category,fact,source,context,interpretation,hypothesis,action,period,created_at').order('created_at',{ascending:false}).limit(40);if(error)return;privateEvidence=(data||[]).map(e=>({id:'saved-'+e.id,categoria:e.category||'guardada',tipo:'Evidência guardada',fato:e.fact||e.title||'Evidência guardada',contexto:e.context||'',interpretacao:e.interpretation||'',hipotese:e.hypothesis||'',acao:e.action||'Reutilizar em investigação',fonte:e.source||'Base privada',url:'./app.html?v=20260922.18',periodo:e.period||e.created_at,natureza:'[A DEFINIR]',universo_observado:'[A DEFINIR]',representa:'[A DEFINIR]',nao_representa:'[A DEFINIR]',fonte_primaria:'[A DEFINIR]',fato_verificado_na_fonte:'[A DEFINIR]',alcance_para_pergunta:'[A DEFINIR]',saved:true,evidence_id:e.evidence_id}))}catch(e){privateEvidence=[]}}
const getScope=()=>{try{return localStorage.getItem(scopeKey)||'public'}catch{return'public'}};
const setScope=v=>{try{localStorage.setItem(scopeKey,v)}catch{};const name=document.getElementById('pv3-scope-name');if(name)name.textContent=scopeLabels[v]||scopeLabels.public;const mobile=document.getElementById('pv3-mobile-scope');if(mobile)mobile.value=v;};
const goScope=v=>{setScope(v);document.dispatchEvent(new CustomEvent('pulse:scope-change',{detail:{scope:v}}));location.reload();};
function active(){if(path==='intelligence.html')return'hoje';if(path==='ask.html')return'investigacao';if(path==='base.html')return'base';if(path==='app.html')return hash==='analyses'||hash.startsWith('analysis=')?'analises':'base';if(path==='index.html'&&hash==='')return'hoje';return'universo'}
function legacy(){qa('main,body>header,.layout,.shell>.top,.pulse-rail,.pulse-mainbar,.pulse-shell-sidebar,.pulse-shell-topbar,#pulse-v6-lab,.legacy-shell,.legacy-workspace').forEach(x=>{if(!x.classList.contains('pv4-app'))x.classList.add('pv4-hidden')})}
function nav(){if(q('.pv4-rail'))return;
const a=active(),n=document.createElement('aside');n.className='pv4-rail pv3-shell-nav';n.innerHTML='<div class="pv4-logo"><strong translate="no">Pulse</strong><img class="pv4-shopplosion-logo" src="./shopplosion-logo.png?v=20260923.logo-fix" alt="Logotipo da Shopplosion" width="120" height="48" translate="no"></div><div class="pv4-scope"><small>ESCOPO</small><span class="pv4-scope-region">Escopo: Brasil, CPG</span><b id="pv3-scope-name">'+esc(scopeLabels[getScope()]||scopeLabels.public)+'</b><select id="pv3-scope-select" name="scope" autocomplete="off" aria-label="Escopo ativo"><option value="public">Público</option><option value="industry">Minha indústria</option><option value="both">Ambos</option></select><span>O escopo controla quais evidências podem ser usadas.</span></div><nav>'+[['hoje','01','Hoje'],['universo','02','Universo'],['base','03','Base'],['investigacao','04','Investigação'],['analises','05','Análises']].map(x=>'<a data-nav="'+x[0]+'" href="'+routes[x[0]]+'"'+(x[0]===a?' aria-current="page"':'')+'><i>'+x[1]+'</i><span>'+x[2]+'</span></a>').join('')+'</nav><button class="pv4-command pv3-command-trigger" type="button"><span>Buscar, ir ou perguntar</span><kbd>⌘K</kbd></button><div class="pv4-rail-foot"><span class="pv4-dot"></span><span>Workspace ativo</span></div>';document.body.appendChild(n);
const top=document.createElement('header');top.className='pv4-top';top.innerHTML='<div class="pv4-crumb"><span>Pulse</span><b>/</b><strong>'+({hoje:'Hoje',universo:'Universo',base:'Base',investigacao:'Investigação',analises:'Análises'}[a])+'</strong></div><div class="pv4-top-actions"><button class="pv4-top-command" type="button" aria-label="Abrir busca e comandos">⌘K</button></div>';document.body.appendChild(top);top.style.setProperty('left',innerWidth<=640?'0px':innerWidth<=1023?'64px':'240px','important');
const scope=document.createElement('div');scope.className='pv4-mobile-scope pv3-scope-header';scope.innerHTML='<select id="pv3-mobile-scope" name="scope" autocomplete="off" aria-label="Escopo ativo"><option value="public">Público</option><option value="industry">Minha indústria</option><option value="both">Ambos</option></select>';document.body.appendChild(scope);
const transition=(href,ev)=>{if(ev&&(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey||ev.button!==0))return;ev?.preventDefault();document.documentElement.classList.add('pv3-leaving');setTimeout(()=>{location.href=href},120)};
const scopeValue=getScope();q('#pv3-scope-select',n).value=scopeValue;q('#pv3-scope-select',n).addEventListener('change',e=>goScope(e.target.value));q('#pv3-mobile-scope',scope).value=scopeValue;q('#pv3-mobile-scope',scope).addEventListener('change',e=>goScope(e.target.value));qa('[data-nav]').forEach(a=>a.addEventListener('click',e=>transition(a.href,e)));
const cmd=document.createElement('div');cmd.className='pv4-command-menu pv3-command-menu';cmd.innerHTML='<div class="pv4-command-head"><b>Buscar, ir ou perguntar</b><button type="button">Esc</button></div><input type="search" name="command" autocomplete="off" aria-label="Buscar, ir ou perguntar" placeholder="Digite uma ação ou destino…"><div class="pv4-command-list">'+[['Hoje',routes.hoje],['Universo',routes.universo],['Base',routes.base],['Investigação',routes.investigacao],['Análises',routes.analises]].map(x=>'<a href="'+x[1]+'"><strong>'+x[0]+'</strong><span>Ir para '+x[0]+'</span></a>').join('')+'</div>';document.body.appendChild(cmd);
const open=()=>{cmd.classList.add('open');q('input',cmd).focus()},close=()=>cmd.classList.remove('open');[q('.pv4-command',n),q('.pv4-top-command',top)].forEach(b=>b.onclick=open);q('button',cmd).onclick=close;q('input',cmd).oninput=e=>qa('a',cmd).forEach(x=>x.style.display=x.textContent.toLowerCase().includes(e.target.value.toLowerCase())?'':'none');qa('a',cmd).forEach(a=>a.addEventListener('click',e=>transition(a.href,e)));document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}if(e.key==='Escape')close()})}
function head(kicker,title,sub,next){const crumb=kicker==='VISÃO EXECUTIVA'?'Hoje':kicker;const eyebrow='';return '<div class="pv4-head pv3-head"><div class="pv3-breadcrumb"><span>Pulse</span><span>/</span><strong>'+esc(crumb)+'</strong></div><div>'+eyebrow+'<h1>'+title+'</h1><p>'+sub+'</p></div>'+(next?'<a class="pv4-next" href="'+next[1]+'"><small>PRÓXIMO PASSO</small><b>'+next[0]+'</b></a>':'')+'</div>'}
function mount(html){const m=document.getElementById('pulse-app-shell')||document.createElement('main');m.className='pv4-app';m.setAttribute('aria-label','Workspace Pulse');m.innerHTML='<div class="pv4-frame">'+html+'</div>';if(!m.isConnected)document.body.appendChild(m);return m}
function publicEvidence(){
  const valid=v=>v&&typeof v==='object'&&String(v.id??'').trim();
  if(Array.isArray(window.PULSE_EVIDENCE)&&window.PULSE_EVIDENCE.some(valid)) return window.PULSE_EVIDENCE.filter(valid);
  try{
    const n=document.getElementById('pulse-public-evidence-json');
    const v=n?JSON.parse(n.textContent||'[]'):[];
    if(Array.isArray(v)&&v.some(valid)){window.PULSE_EVIDENCE=v.filter(valid);return window.PULSE_EVIDENCE}
  }catch(e){}
  return [];
}
function evidence(){
  const publicRows=publicEvidence();
  const scope=getScope();
  if(scope==='industry') return privateEvidence;
  if(scope==='both') return publicRows.concat(privateEvidence);
  return publicRows;
}
function evidenceMeta(e,question=''){return PULSE_EVIDENCE_MODEL.assess(e,question)}
function categoryKey(e){return String(e?.categoria??'').trim().toLocaleLowerCase('pt-BR')}
function evidenceMetrics(ev){const clean=Array.isArray(ev)?ev.filter(e=>e&&typeof e==='object'):[];return {count:clean.length,categories:new Set(clean.map(categoryKey).filter(Boolean)).size,natureDeclared:clean.filter(e=>evidenceMeta(e).natureza!=='[A DEFINIR]').length}}
function inspector(e){let p=q('#pv4-inspector');if(!p){p=document.createElement('aside');p.id='pv3-inspector';p.className='pv4-inspector pv3-inspector';document.body.appendChild(p)}const meta=evidenceMeta(e,window.__PULSE_CURRENT_QUESTION||'');const value=typeof e.valor==='object'?Object.entries(e.valor).map(([k,v])=>esc(k)+': '+esc(v)+'%').join(', '):esc(e.valor||': ');const comparison=esc(e.comparacao||': '),classification=esc(e.classificacao||': ');p.innerHTML='<div class="pv4-inspector-head"><div><small>INSPECTOR DE EVIDÊNCIA</small><h2>'+esc(e.fato||e.title||'Evidência')+'</h2></div><button type="button" aria-label="Fechar">×</button></div><div class="pv4-inspector-body">'+[['FATO',e.fato],['ORIGEM',e.fonte||e.source],['PERÍODO',e.periodo],['INDICADOR',e.indicador||e.tipo],['NATUREZA',meta.natureza],['UNIVERSO OBSERVADO',meta.universo_observado],['COBERTURA',meta.cobertura],['FATO VERIFICADO NA FONTE',meta.fato_verificado_na_fonte],['ALCANCE PARA A PERGUNTA',meta.alcance_para_pergunta],['REPRESENTA',meta.representa],['NÃO REPRESENTA',meta.nao_representa],['FONTE PRIMÁRIA',meta.fonte_primaria],['COMPARAÇÃO',comparison],['CONTEXTO',e.contexto],['CLASSIFICAÇÃO',classification],['INTERPRETAÇÃO',e.interpretacao],['HIPÓTESE',e.hipotese],['PRÓXIMA AÇÃO',e.acao]].map(x=>'<section><label>'+x[0]+'</label><p>'+esc(x[1]||'Não registrado')+'</p></section>').join('')+'<dl><div><dt>Valor</dt><dd>'+value+'</dd></div><div><dt>ID</dt><dd>'+esc(e.id||': ')+'</dd></div></dl><div class="pv4-inspector-actions"><button data-action="ask">Perguntar</button><button data-action="save">Guardar</button><button data-action="analysis">Usar na análise</button></div></div>';p.classList.add('open');q('button',p).focus();q('button',p).onclick=()=>p.classList.remove('open');qa('[data-action]',p).forEach(b=>b.onclick=()=>{if(b.dataset.action==='ask')location.href=routes.investigacao+'?evidence='+encodeURIComponent(e.id||'');else if(b.dataset.action==='analysis')location.href=routes.analises+'?evidence='+encodeURIComponent(e.id||'');else{location.href=routes.investigacao+'?saveEvidence='+encodeURIComponent(e.id||'')}})}
function bindEvidence(root){qa('[data-evidence-id]',root).forEach(card=>{card.onclick=ev=>{if(ev.target.closest('button,a'))return;const e=evidence().find(x=>String(x.id)===card.dataset.evidenceId);if(e)inspector(e)};let b=card.querySelector('.pv4-inspect');if(!b){b=document.createElement('button');b.className='pv4-inspect';b.textContent='Ver evidência';card.appendChild(b);b.onclick=()=>{const e=evidence().find(x=>String(x.id)===card.dataset.evidenceId);if(e)inspector(e)}}})}
function signalCard(e,i){const meta=evidenceMeta(e,'');return '<article class="pv4-evidence" data-evidence-id="'+esc(e.id)+'"><div class="pv4-evidence-top"><span class="pv4-index">'+String(i+1).padStart(2,'0')+'</span><span class="pv4-tag">'+esc(e.categoria||'geral')+'</span><span class="pv4-nature">'+esc(meta.natureza)+'</span></div><h3>'+esc(e.fato||'Sinal')+'</h3><p>'+esc(e.interpretacao||e.contexto||'Evidência disponível para investigação.')+'</p><div class="pv4-evidence-meta"><span><strong>Fonte:</strong> <a href="'+esc(e.url||'#')+'" target="_blank" rel="noopener noreferrer" class="pv4-source-link">'+esc(e.fonte||'Fonte não informada')+' ↗</a></span><span><strong>Período:</strong> '+esc(e.periodo||'Não informado')+'</span></div><div class="evidenceScope"><span><strong>Fato verificado na fonte:</strong> '+esc(meta.fato_verificado_na_fonte)+'</span><span><strong>Alcance para a pergunta:</strong> '+esc(meta.alcance_para_pergunta)+'</span></div></article>'}
function featuredEvidence(items,limit=6){
  const rows=Array.isArray(items)?items.filter(x=>x&&typeof x==='object'):[];
  const seen=new Set(),picked=[];
  for(let i=rows.length-1;i>=0;i--){
    const e=rows[i];
    const key=String(e.tipo||'geral')+'|'+String(e.categoria||'geral');
    if(seen.has(key))continue;
    seen.add(key);picked.unshift(e);
  }
  return picked.slice(-limit);
}function evidenceSeries(items){const map=new Map();for(const e of Array.isArray(items)?items:[]){const key=String(e.tipo||'geral')+'|'+String(e.categoria||'geral');if(!map.has(key))map.set(key,[]);map.get(key).push(e)}return [...map.entries()].map(([key,rows])=>({key,rows:rows.slice().sort((a,b)=>String(a.periodo||'').localeCompare(String(b.periodo||''))),latest:rows[rows.length-1]})).sort((a,b)=>String(b.latest?.periodo||'').localeCompare(String(a.latest?.periodo||'')))}
function seriesCard(s){const e=s.latest||{},periods=s.rows.map(x=>x.periodo).filter(Boolean);return '<article class="pv4-series-card"><div><small>'+esc(e.tipo||'SÉRIE')+'</small><b>'+esc(e.categoria||'geral')+'</b></div><strong>'+esc(e.fato||'Sem fato registrado')+'</strong><span>Observações: '+s.rows.length+'. Período: '+esc(periods[0]||': ')+(periods.length>1?' - '+esc(periods[periods.length-1]):'')+'</span><button type="button" data-series-key="'+esc(s.key)+'">Ver série</button></article>'}


/* Next-level panel on the Hoje canvas. It only reads the PULSE_NEXT_LEVEL registries; every state is
   explicit (loading, available, empty, insufficient, not comparable, rejected, source error) and no record
   is rendered as market data. IDs are new and namespaced (pv4-nl-*); nothing existing is renamed. */
const NL_SOURCE_NOTE='Fonte de série histórica não conectada: as observações vêm de registro manual neste navegador ou de evidências públicas que declarem um bloco serie_historica.';
function nlApi(){return window.PULSE_NEXT_LEVEL||null}
function nlFmt(v){return typeof v==='number'?String(Math.round(v*100)/100).replace('.',','):esc(v)}
function nlPct(v){return (v>0?'+':'')+String(Math.round(v*10)/10).replace('.',',')+'%'}
function nlList(items,empty){const rows=(Array.isArray(items)?items:[]).filter(Boolean);return rows.length?'<ul class="pv4-nl-list">'+rows.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="pv4-nl-muted">'+esc(empty)+'</p>'}
function nlState(kind,title,body){return '<div class="pv4-nl-state" data-state="'+esc(kind)+'"><b>'+esc(title)+'</b><span>'+esc(body)+'</span></div>'}
/* One block per metric and geography, each with its own explicit state, so a series that came from public
   evidence never hides the state of a series the user registered by hand (and vice versa). */
function nlSeriesBlock(api,metric,geography){
  const s=api.historicalSummary(metric,geography);
  const head='<div class="pv4-nl-series-head"><b>'+esc(metric)+'</b><span>'+esc(geography)+'</span></div>';
  let body;
  if(s.status==='insufficient')body=nlState('insufficient','Dados insuficientes',s.count+(s.count===1?' observação registrada. ':' observações registradas. ')+s.message);
  else if(s.status==='not_comparable')body=nlState('not_comparable','Sem comparabilidade suficiente',s.message);
  else if(s.status!=='observed_change')body=nlState('unavailable','Comparação indisponível',s.message||'Valores ausentes impedem a comparação.');
  else{
    const yoy=s.yearOverYear&&s.yearOverYear.status==='observed_change'?'<p class="pv4-nl-muted">Mesmo mês do ano anterior ('+esc(s.yearOverYear.previous.period)+'): '+nlFmt(s.yearOverYear.previous.value)+' → '+nlFmt(s.current.value)+(s.yearOverYear.deltaPct!==null?' ('+nlPct(s.yearOverYear.deltaPct)+')':'')+'. Cálculo do Pulse sobre esta série'+(s.methodology&&s.methodology!==api.UNDECLARED?' ('+esc(s.methodology)+')':'')+'; não é a variação interanual publicada pela fonte.</p>':'';
    const origin=s.current.evidenceId?' <button type="button" class="pv4-nl-open-evidence" data-evidence-id="'+esc(s.current.evidenceId)+'">Ver evidência de origem</button>':'';
    body='<div class="pv4-nl-state" data-state="available"><b>Variação observada, não explicada</b><span>'+esc(s.observation)+'</span></div>'+yoy+'<p class="pv4-nl-muted">Fonte: '+esc(s.source)+'. Observações comparáveis: '+s.count+'. Causalidade: não atribuída.'+origin+'</p><details class="pv4-nl-details"><summary>Limitações ('+s.limitations.length+')</summary>'+nlList(s.limitations,'Sem limitações declaradas.')+'</details>';
  }
  return '<div class="pv4-nl-series" data-series-metric="'+esc(metric)+'" data-series-geography="'+esc(geography)+'" data-series-state="'+esc(s.status==='observed_change'?'available':s.status)+'">'+head+body+'</div>';
}
function nlSeriesView(){
  const api=nlApi();if(!api)return nlState('unavailable','Contrato indisponível','O runtime não expôs PULSE_NEXT_LEVEL.');
  const rows=window.serie_historica||[];
  if(!rows.length)return nlState('empty','Nenhuma observação registrada',NL_SOURCE_NOTE);
  const groups=new Map();
  rows.forEach(r=>{const k=api.norm(r.metric)+'|'+api.norm(r.geography);if(!groups.has(k))groups.set(k,{metric:r.metric,geography:r.geography})});
  return [...groups.values()].map(g=>nlSeriesBlock(api,g.metric,g.geography)).join('');
}
function nlRoleView(){
  const rows=window.papel_ideal||[];
  if(!rows.length)return nlState('empty','Nenhum papel registrado','O papel de uma categoria só aparece aqui como heurística auditável, nunca como fato de mercado.');
  return rows.map(r=>'<div class="pv4-nl-state" data-state="heuristic"><b>'+esc(r.category)+': '+esc(r.role)+'</b><span>Heurística. Evidências: '+r.evidenceCount+' ('+esc(r.evidenceQuality)+'). Confiança: '+esc(r.confidence&&r.confidence.level||'não declarada')+'.</span></div><details class="pv4-nl-details"><summary>Limitações, hipóteses concorrentes e revisão</summary>'+nlList(r.limitations,'Sem limitações declaradas.')+nlList(r.competingHypotheses,'Nenhuma hipótese concorrente registrada.')+nlList(r.reviewConditions,'Sem condição de revisão.')+'</details>').join('');
}
function nlLocalView(){
  const rows=window.PULSE_LOCAL_EVIDENCE||[];
  if(!rows.length)return nlState('empty','Nenhuma evidência local','Registros locais exigem afirmação, fonte, geografia, data e proveniência. Eles ficam separados da base pública.');
  return '<ul class="pv4-nl-local">'+rows.map(r=>'<li><button type="button" class="pv4-nl-open" data-local-id="'+esc(r.id)+'">'+esc(r.claim)+'</button><span>'+esc(r.source)+'. '+esc(r.geography)+'. '+esc(r.date)+'. Proveniência: '+esc(r.provenance)+'.</span></li>').join('')+'</ul>';
}
function nlField(id,label,attrs){return '<label for="'+id+'">'+label+'<input id="'+id+'" name="'+id.replace('pv4-nl-','')+'" '+(attrs||'')+'></label>'}
function nextLevelSection(){
  return '<section id="pv4-next-level" class="pv4-next-level" aria-labelledby="pv4-nl-title"><div class="pv4-canvas-head"><div><small>REGISTRO PRÓPRIO</small><h2 id="pv4-nl-title">Série histórica, papel da categoria e evidência local</h2><p>Contratos auditáveis do workspace. Cada bloco mostra o seu estado real: sem dados, insuficiente, sem comparabilidade ou disponível. Nada aqui é dado de mercado até que a origem e a proveniência estejam declaradas.</p></div><span class="pv4-view" id="pv4-nl-status">Carregando registros locais</span></div>'+
  '<div class="pv4-nl-grid">'+
  '<article class="pv4-nl-card" id="pv4-nl-series"><h3>Série histórica</h3><div class="pv4-nl-body" data-view="series">'+nlState('loading','Carregando','Restaurando observações deste navegador.')+'</div><details class="pv4-nl-form"><summary>Registrar observação</summary><form id="pv4-nl-series-form" novalidate><div class="pv4-nl-fields">'+nlField('pv4-nl-period','Período (AAAA, AAAA-MM ou AAAA-MM-DD)','required placeholder="2026-07"')+nlField('pv4-nl-value','Valor','required inputmode="decimal" placeholder="0"')+nlField('pv4-nl-unit','Unidade','placeholder="mil unidades"')+nlField('pv4-nl-metric','Métrica','required placeholder="volume"')+nlField('pv4-nl-geography','Geografia','required placeholder="Brasil"')+nlField('pv4-nl-source','Fonte','required placeholder="nome da fonte"')+nlField('pv4-nl-provenance','Proveniência (onde o número foi verificado)','required placeholder="URL ou documento"')+'</div><div class="pv4-nl-actions"><button type="submit">Registrar</button></div><p class="pv4-nl-feedback" id="pv4-nl-series-feedback" role="status" aria-live="polite"></p></form></details></article>'+
  '<article class="pv4-nl-card" id="pv4-nl-role"><h3>Papel da categoria</h3><div class="pv4-nl-body" data-view="role">'+nlState('loading','Carregando','Restaurando registros deste navegador.')+'</div><details class="pv4-nl-form"><summary>Registrar papel (heurística)</summary><form id="pv4-nl-role-form" novalidate><div class="pv4-nl-fields">'+nlField('pv4-nl-role-category','Categoria','required placeholder="chocolate"')+nlField('pv4-nl-role-role','Papel proposto','required placeholder="destino, rotina, conveniência"')+nlField('pv4-nl-role-limitation','Limitação conhecida','placeholder="o que esta leitura não cobre"')+nlField('pv4-nl-role-competing','Hipótese concorrente','placeholder="outro papel possível"')+'</div><div class="pv4-nl-actions"><button type="submit">Registrar</button></div><p class="pv4-nl-feedback" id="pv4-nl-role-feedback" role="status" aria-live="polite"></p></form></details></article>'+
  '<article class="pv4-nl-card" id="pv4-nl-local"><h3>Evidência local</h3><div class="pv4-nl-body" data-view="local">'+nlState('loading','Carregando','Restaurando registros deste navegador.')+'</div><details class="pv4-nl-form"><summary>Registrar evidência local</summary><form id="pv4-nl-local-form" novalidate><div class="pv4-nl-fields">'+nlField('pv4-nl-local-claim','Afirmação observável','required placeholder="o que foi observado"')+nlField('pv4-nl-local-source','Fonte','required placeholder="quem observou"')+nlField('pv4-nl-local-geography','Geografia','required placeholder="cidade, canal ou loja"')+nlField('pv4-nl-local-date','Data (AAAA-MM-DD)','required placeholder="2026-10-31"')+nlField('pv4-nl-local-provenance','Proveniência','required placeholder="foto, planilha, visita"')+'</div><div class="pv4-nl-actions"><button type="submit">Registrar</button></div><p class="pv4-nl-feedback" id="pv4-nl-local-feedback" role="status" aria-live="polite"></p></form></details></article>'+
  '</div><div class="pv4-canvas-footer"><span>Estados: sem dados → insuficiente → sem comparabilidade → disponível. Variação observada nunca vira causa.</span><a href="'+routes.investigacao+'">Investigar</a></div></section>';
}
function nlFeedback(root,id,result){
  const box=q('#'+id,root);if(!box)return;
  const labels={period:'período',value:'valor',source:'fonte',geography:'geografia',metric:'métrica',provenance:'proveniência',claim:'afirmação',date:'data',category:'categoria',role:'papel'};
  const names=l=>(l||[]).map(k=>labels[k]||k).join(', ');
  box.dataset.status=result.status;
  if(result.status==='added')box.textContent='Registro aceito.';
  else if(result.status==='duplicate')box.textContent='Registro já existente; nada foi duplicado.';
  else if(result.status==='conflict')box.textContent='Conflito: o mesmo ponto já existe com outro valor ('+nlFmt(result.existing.value)+'). Nada foi sobrescrito.';
  else if(result.status==='rejected'&&result.reason==='incomplete')box.textContent='Registro rejeitado por estar incompleto. Falta: '+names(result.missing)+'.';
  else if(result.status==='rejected')box.textContent='Registro rejeitado por campo inválido: '+names(result.invalid)+'.';
  else box.textContent='Registro não aceito ('+esc(result.status)+').';
}
function nlRefresh(root){
  const api=nlApi();
  const set=(view,html)=>{const el=q('.pv4-nl-body[data-view="'+view+'"]',root);if(el)el.innerHTML=html};
  set('series',nlSeriesView());set('role',nlRoleView());set('local',nlLocalView());
  const status=q('#pv4-nl-status',root);
  if(status&&api){const st=api.state();const fromPublic=(window.serie_historica||[]).filter(x=>x&&x.evidenceId).length;status.textContent=st.historical+' observações ('+fromPublic+' do dataset público, '+(st.historical-fromPublic)+' registradas neste navegador). '+st.roles+' papéis. '+st.local+' evidências locais.'}
  qa('.pv4-nl-open',root).forEach(b=>b.onclick=()=>{const item=(window.PULSE_LOCAL_EVIDENCE||[]).find(x=>x.id===b.dataset.localId);if(item&&api)inspector(api.localEvidenceAsEvidence(item))});
  qa('.pv4-nl-open-evidence',root).forEach(b=>b.onclick=()=>{const e=evidence().find(x=>String(x.id)===b.dataset.evidenceId);if(e)inspector(e)});
}
function bindNextLevel(root){
  const api=nlApi();const section=q('#pv4-next-level',root);if(!section||!api)return;
  const fromEvidence=api.loadFromEvidence(publicEvidence());
  const restored=api.restore();
  if(restored.status==='source_error'||restored.status==='storage_error'){
    const el=q('.pv4-nl-body[data-view="series"]',section);
    if(el)el.insertAdjacentHTML('afterbegin',nlState('source_error','Erro de origem',restored.message+' Os registros abaixo refletem apenas esta sessão.'));
  }
  section.dataset.restore=restored.status;section.dataset.fromEvidence=String(fromEvidence.added);
  const notRestored=restored.status==='restored'?[].concat((restored.historical&&restored.historical.results||[]).filter(r=>r.status==='conflict'||r.status==='rejected').map(r=>r.status==='conflict'?'Observação local '+r.item.period+' ('+esc(r.item.metric)+', valor '+nlFmt(r.item.value)+') conflita com o valor '+nlFmt(r.existing.value)+(r.existing.evidenceId?' do dataset público':' já registrado')+' e não foi restaurada.':'Observação local rejeitada na restauração ('+esc(r.reason||'inválida')+').'),(restored.local&&restored.local.results||[]).filter(r=>r.status==='rejected').map(()=>'Evidência local rejeitada na restauração.')):[];
  section.dataset.notRestored=String(notRestored.length);
  if(notRestored.length){const el=q('.pv4-nl-body[data-view="series"]',section);if(el)el.insertAdjacentHTML('afterbegin',nlState('conflict','Registros locais não restaurados ('+notRestored.length+')',notRestored.join(' ')+' O valor com proveniência pública prevalece; registre a observação local com outra fonte ou metodologia se ela for distinta.'))}
  const persist=()=>{const r=api.persist();section.dataset.persist=r.status;return r};
  const value=id=>{const el=q('#'+id,section);return el?el.value:''};
  const form=(id,handler)=>{const f=q('#'+id,section);if(!f)return;f.addEventListener('submit',ev=>{ev.preventDefault();const result=handler();const feedbackId=id.replace('-form','-feedback');nlFeedback(section,feedbackId,result);if(result.status==='added'){const saved=persist();if(saved.status!=='saved'){const box=q('#'+feedbackId,section);if(box){box.textContent+=' Não foi salvo neste navegador ('+saved.status+'): o registro vale só para esta sessão.';box.dataset.persist=saved.status}}nlRefresh(section);f.reset()}})};
  form('pv4-nl-series-form',()=>api.addHistoricalObservation({period:value('pv4-nl-period'),value:value('pv4-nl-value'),unit:value('pv4-nl-unit'),metric:value('pv4-nl-metric'),geography:value('pv4-nl-geography'),source:value('pv4-nl-source'),provenance:value('pv4-nl-provenance')}));
  form('pv4-nl-role-form',()=>api.setCategoryRole(value('pv4-nl-role-category'),value('pv4-nl-role-role'),[],{limitations:[value('pv4-nl-role-limitation')],competingHypotheses:[value('pv4-nl-role-competing')]}));
  form('pv4-nl-local-form',()=>api.addLocalEvidence({claim:value('pv4-nl-local-claim'),source:value('pv4-nl-local-source'),geography:value('pv4-nl-local-geography'),date:value('pv4-nl-local-date'),provenance:value('pv4-nl-local-provenance')}));
  if(restored.status==='source_error'||notRestored.length){const el=q('.pv4-nl-body[data-view="series"]',section);const keep=el?el.firstElementChild:null;nlRefresh(section);if(keep&&el)el.insertAdjacentElement('afterbegin',keep)}else nlRefresh(section);
  window.PULSE_NEXT_LEVEL_UI={refresh:()=>nlRefresh(section)};
}
function hoje(){legacy();const ev=evidence();const universeEvidence=publicEvidence();const metrics=evidenceMetrics(universeEvidence);const m=mount(head('VISÃO EXECUTIVA','O que importa agora?','Comece pelo movimento, abra a evidência, entenda o contexto e só então avance para a oportunidade.',['Investigar',routes.investigacao])+'<div class="pv4-section-title"><div><small>COMECE AQUI</small><h2>Leitura do mercado</h2></div><span>Atualizado em 11 out 2026</span></div><section class="pv4-hero-grid"><article class="pv4-story"><span class="pv4-label">MOVIMENTO OBSERVÁVEL</span><h2>'+esc(ev.length?'Há sinais públicos disponíveis para investigação agora.':'Ainda não há evidências públicas carregadas.')+'</h2><p>O Pulse não transforma uma narrativa em fato. Comece pelo sinal, abra a origem e use a investigação para testar o que ele pode significar.</p><div class="pv4-story-foot"><span>'+esc(universeEvidence.slice(0,3).map(x=>x.categoria).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ')||'Campos disponíveis: evidência, fonte e período')+'</span><a href="#signals">Ver evidências</a></div></article><aside class="pv4-at-a-glance"><small>AGORA</small><div><b>'+ev.length+'</b><span>evidências no universo</span></div><div><b>'+new Set(ev.map(x=>x.categoria)).size+'</b><span>categorias com sinais</span></div><div><b>'+ev.filter(x=>evidenceMeta(x).natureza!=='[A DEFINIR]').length+'</b><span>com natureza declarada</span></div></aside></section><section class="pv4-case" style="margin-top:16px"><div class="pv4-canvas-head"><div><small>Categoria: alimentos. Atualizado em: 11 out 2026</small><h2>O que os sinais recentes dizem e o que ainda não sabemos?</h2><p>Comece pelo IAV-IDV de julho: +1,7% nominal e −2,8% real. É um sinal de mercado, não uma prova de mudança de comportamento do shopper.</p></div><div class="pv4-real-actions"><button class="pv4-primary" type="button" data-case-evidence="idv-julho-2026">Abrir evidência</button><a class="pv4-secondary" href="./ask.html?v=20260922.18&evidence=idv-julho-2026">Investigar</a></div></div></section><section class="pv4-case-steps" style="margin-top:12px"><div class="pv4-canvas-head"><div><small>PRÓXIMOS PASSOS: REDUZIR DESCONHECIDOS</small><h3>O que precisamos descobrir agora?</h3><p>O case não pede uma conclusão antecipada. Ele transforma cada desconhecido em uma pergunta de investigação e indica qual evidência deve ser procurada.</p></div></div><div class="pv4-diagnostic-cols"><article><b>PREÇO × VENDAS</b><span>Cruzar IPCA de alimentos, PMC e IAV-IDV para separar efeito de preço de movimento real.</span></article><article><b>QUANTIDADE</b><span>Buscar volume, unidades ou consumo físico para testar se houve mudança na quantidade comprada.</span></article><article><b>CESTA × CANAL</b><span>Investigar categoria, mix, embalagem, marca, frequência, missão e canal para localizar o mecanismo.</span></article><article><b>ATUALIZAR</b><span>Quando chegar nova evidência, reabrir a investigação, testar a hipótese e atualizar o conhecimento.</span></article></div></section><section class="pv4-case pv4-case-critical" style="margin-top:12px"><div class="pv4-canvas-head"><div><small>CONTRADIÇÃO: ALIMENTOS</small><h2>Se o varejo alimentar cresce, o que está realmente crescendo?</h2><p>Os dados não contam uma única história: o PMC mostra +2,9% no varejo alimentar contra julho de 2025, enquanto a Scanntech registra +1,8% em valor nas mesmas lojas, −2,1% em unidades e +4,0% em preço por unidade. O consumo nos lares da ABRAS cresceu 3,28% em termos reais. O desafio agora é explicar a diferença entre valor, volume, fluxo e consumo, sem atribuir isso automaticamente ao comportamento do shopper.</p></div><div class="pv4-real-actions"><button class="pv4-primary" type="button" data-case-evidence="scanntech-julho">Abrir sinal-chave</button><a class="pv4-secondary pv4-secondary-action" href="./ask.html?v=20260922.18&evidence=scanntech-julho"><span>Investigar</span></a></div></div><div class="pv4-case-contrast"><article><small>O QUE SABEMOS</small><b>Valor pode crescer enquanto unidades e fluxo recuam.</b><span>Scanntech: +1,8% valor, −2,1% unidades, +4,0% preço/unidade.</span></article><article><small>O QUE NÃO SABEMOS</small><b>Qual mecanismo explica a diferença?</b><span>Preço, mix, embalagem, frequência, canal, ocasião ou combinação desses fatores; o dado disponível não permite atribuir a queda de unidades a uma única causa.</span></article><article><small>PRÓXIMO TESTE</small><b>Não misturar universos.</b><span>Cruzar PMC, ABRAS, Scanntech, IPCA e IAV-IDV preservando definição, período e cobertura de cada indicador.</span></article></div></section><section id="signals" class="pv4-canvas"><div class="pv4-canvas-head"><div><small>MAPA DE EVIDÊNCIAS</small><h2>Sinais que merecem atenção</h2><p>O mapa destaca um sinal recente por série recorrente; a série histórica continua disponível no Universo.</p></div><span class="pv4-view">+'+ev.length+' sinais</span></div><div class="pv4-evidence-grid">'+featuredEvidence(ev,6).map(signalCard).join('')+'</div><div class="pv4-canvas-footer"><span>3 estados: sinal → diagnóstico → oportunidade</span><a href="'+routes.investigacao+'">Investigar</a></div></section>'+nextLevelSection()+'<section class="pv4-opportunity"><div><small>PONTOS PARA INVESTIGAR</small><h2>Opportunity Canvas</h2><p>As oportunidades abaixo são derivadas dos sinais disponíveis e continuam sendo hipóteses até serem investigadas.</p></div><div class="pv4-op-grid">'+ev.slice(0,2).map((e,i)=>'<article><span>HIPÓTESE '+String(i+1).padStart(2,'0')+'</span><h3>'+esc(e.hipotese||e.interpretacao||e.fato||'Sinal para investigação')+'</h3><p>'+esc(e.acao||'Abrir investigação e testar com evidência adicional.')+'</p><b>Natureza: '+esc(evidenceMeta(e).natureza)+'</b></article>').join('')+'</div></section>');bindEvidence(m);bindNextLevel(m);qa('[data-case-evidence]',m).forEach(btn=>btn.onclick=()=>{const ce=evidence().find(x=>String(x.id)===btn.dataset.caseEvidence);if(ce)inspector(ce)});return m}
function universo(){legacy();const ev=evidence();const metrics=evidenceMetrics(ev);const m=mount(head('UNIVERSO','Leia antes de decidir.','O espaço público do Pulse organiza o mercado em sinal, diagnóstico e oportunidade. A evidência permanece rastreável.',['Investigar',routes.investigacao])+'<section class="pv4-story"><span class="pv4-label">MOVIMENTO</span><h2>O mercado muda em sinais observáveis antes de virar decisão.</h2><p>Comece pelo fato, veja a fonte e o período, abra o Inspector e só então avance para diagnóstico e oportunidade.</p><div class="pv4-story-foot"><span>Fato, contexto e próximo teste</span><a href="#signals">Ver sinais</a></div></section>'+'<aside class="pv4-at-a-glance"><small>AGORA</small><div><b>'+metrics.count+'</b><span>evidências no universo</span></div><div><b>'+metrics.categories+'</b><span>categorias com sinais</span></div><div><b>'+metrics.natureDeclared+'</b><span>com natureza declarada</span></div></aside>'+'<div class="pv4-filter"><label>Categoria <select id="pv3-category"><option value="">Todas</option>'+[...new Set(ev.map(x=>x.categoria).filter(Boolean))].map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></label><span>Evidências: '+metrics.count+'. Categorias: '+metrics.categories+'. Natureza declarada: '+metrics.natureDeclared+'</span></div><section id="signals" class="pv4-canvas"><div class="pv4-canvas-head"><div><small>SINAL: DADOS REAIS</small><h2>O que mudou</h2><p>Dados públicos oficiais, com fonte e período visíveis. Selecione um sinal para abrir sua ficha de evidência.</p></div></div><div id="pv3-signals" class="pv4-evidence-grid"></div></section><section class="pv4-series-section"><div class="pv4-canvas-head"><div><small>TRAJETÓRIAS: NÃO CONFUNDIR SÉRIE COM SINAL NOVO</small><h2>O que se repete e o que realmente mudou?</h2><p>Indicadores recorrentes aparecem aqui como séries. O ponto mais recente recebe destaque; o histórico continua disponível nos sinais abaixo.</p></div></div><div class="pv4-series-grid">'+evidenceSeries(ev).map(seriesCard).join('')+'</div></section><section class="pv4-diagnostic"><div><small>DIAGNÓSTICO</small><h2>Por que mudou?</h2><p>Preço, volume, canal e comportamento precisam ser cruzados antes de uma leitura.</p></div><div class="pv4-diagnostic-cols"><article><b>Movimento</b><span>Frequência e ocasião de compra</span></article><article><b>Drivers</b><span>Preço, canal e disponibilidade</span></article><article><b>O que falta</b><span>Confirmação por categoria e período</span></article></div></section><section class="pv4-opportunity"><div><small>OPORTUNIDADE</small><h2>Onde crescer</h2><p>Transforme uma hipótese em uma investigação concreta.</p></div><a class="pv4-primary" href="'+routes.investigacao+'">Investigar</a></section>');const render=f=>{q('#pv3-signals',m).innerHTML=(f?ev.filter(x=>x.categoria===f):ev).map(signalCard).join('')||'<div class="pv4-empty">Nenhuma evidência neste filtro.</div>';bindEvidence(m)};qa('[data-series-key]',m).forEach(btn=>btn.onclick=()=>{const rows=evidenceSeries(ev).find(s=>s.key===btn.dataset.seriesKey)?.rows||[];q('#pv3-signals',m).innerHTML=rows.map(signalCard).join('')||'<div class="pv4-empty">Nenhum ponto nesta série.</div>';bindEvidence(m);location.hash='signals'});q('#pv3-category',m).onchange=e=>render(e.target.value);render('');return m}
function basePage(analyses){legacy();const m=mount(head(analyses?'ANÁLISES':'BASE',analyses?'Análises preservadas, não apenas respostas.':'Sua base de evidências, com estado de ingestão, proveniência e uso.','O workspace separa o que está disponível, o que ainda está sendo extraído e o que já pode sustentar uma leitura.',[analyses?'Abrir Base':'Investigar',analyses?routes.base:routes.investigacao])+'<section class="pv4-base-hero"><div><small>'+ (analyses?'ARTEFATOS':'REPOSITÓRIO DE EVIDÊNCIAS')+'</small><h2>'+ (analyses?'O que já virou conhecimento de trabalho?':'A evidência começa aqui.')+'</h2><p>'+ (analyses?'Cada análise preserva pergunta, leitura, evidências e o que ainda não sabemos.':'Documentos entram como Pendente, Extraindo ou Disponível. Só o estado Disponível alimenta a investigação.')+'</p></div><div class="pv4-status-legend"><span><i class="pending"></i>Pendente</span><span><i class="extracting"></i>Extraindo</span><span><i class="available"></i>Disponível</span></div></section><section class="pv4-canvas"><div class="pv4-canvas-head"><div><small>'+ (analyses?'ANÁLISES SALVAS':'DOCUMENTOS PRIVADOS')+'</small><h2>'+ (analyses?'Artefatos finais':'Sua base')+'</h2></div></div><div id="pv4-base-list" class="pv4-list"></div></section>');const src=q(analyses?'#analyses':'#documents');const list=q('#pv4-base-list',m);const render=()=>{const items=src?qa('.analysisRow,.row',src):[];list.innerHTML=items.length?items.map(x=>{const t=x.querySelector('strong,b')?.textContent||'Documento';const status=x.querySelector('.status')?.textContent||'';return '<article class="pv4-list-row"><div><span class="pv4-row-index">'+(status||'EVIDÊNCIA')+'</span><h3>'+esc(t.trim())+'</h3><p>'+esc(x.textContent.replace(/\s+/g,' ').trim())+'</p></div><span>→</span></article>'}).join(''):'<div class="pv4-empty">'+(analyses?'Nenhuma análise salva ainda.':'Nenhum documento disponível no escopo atual.')+'</div>'};render();const mo=new MutationObserver(()=>render());if(src)mo.observe(src,{subtree:true,childList:true,characterData:true});setTimeout(()=>mo.disconnect(),120000);return m}
function bindInvestigationShellActions(){
  if(window.__PULSE_INVESTIGATION_SHELL_BOUND__)return;
  window.__PULSE_INVESTIGATION_SHELL_BOUND__=true;
  document.addEventListener('pulse:ask-status',function(ev){const box=document.getElementById('pv4-shell-status');const d=ev.detail||{};if(box){box.textContent=d.text||'';box.className='pv4-shell-status show '+(d.type||'ok')}});document.addEventListener('click',function(ev){
    const btn=ev.target?.closest?.('.pv4-real-actions button');
    if(!btn)return;
    if(btn.closest('#pv4-ask-proxy'))return;
    ev.preventDefault();
    ev.stopPropagation();
    if(btn.dataset.caseEvidence)return;
    const buttons=qa('.pv4-real-actions button');
    const index=buttons.indexOf(btn);
    if(index===0 && typeof window.__pulseAskSearch==='function'){
      window.__pulseAskSearch().catch(err=>console.error('pulse-shell-search',err));
    }else if(index===1 && typeof window.__pulseAskGenerate==='function'){
      window.__pulseAskGenerate().catch(err=>console.error('pulse-shell-generate',err));
    }else{
      const legacyButton=index===0?q('#search'):q('#generate');
      if(legacyButton){legacyButton.click()}else{const box=document.getElementById('pv4-shell-status');if(box){box.textContent='O mecanismo de investigação ainda não foi carregado. Recarregue esta página.';box.className='pv4-shell-status show error'}}
    }
  },true);
}
function investigar(){legacy();const m=mount(head('INVESTIGAÇÃO','Pergunte ao Pulse.','Defina o escopo, fixe o contexto, recupere evidência, leia a resposta e salve o que merece virar análise.',null)+'<section class="pv4-investigation"><div class="pv4-ask-card"><div class="pv4-ask-context"><span>ESCOPO</span><b id="pv3-investigation-scope">'+esc(scopeLabels[getScope()]||scopeLabels.public)+'</b><small>Escopo ativo nesta investigação</small></div><h2>O que você quer descobrir?</h2><p>Comece por uma pergunta de negócio. O Pulse mostra a evidência antes da interpretação.</p><div id="pv4-ask-proxy"></div><div id="pv4-shell-status" class="pv4-shell-status" role="status" aria-live="polite"></div><div class="pv4-progress"><span class="active">01 Recuperar</span><span>02 Ler</span><span>03 Escrever</span></div></div><div class="pv4-response-card"><small>RESPOSTA</small><h2>Resposta + evidências</h2><div id="pv4-response">Aguardando uma pergunta.</div><div class="pv4-citation-line">As citações aparecem junto da resposta quando houver evidência suficiente.</div></div></section><section class="pv4-canvas"><div class="pv4-canvas-head"><div><small>EVIDÊNCIAS RECUPERADAS</small><h2>O que sustenta a resposta</h2></div></div><div id="pv4-results" class="pv4-evidence-grid"><div class="pv4-empty">Faça uma pergunta para começar.</div></div></section>');const input=q('#query'),search=q('#search'),gen=q('#generate'),ans=q('#answer'),cit=q('#citations'),res=q('#results');if(input){const p=document.createElement('div');p.innerHTML='<label class="pv4-question-label">PERGUNTA<input class="pv4-real-input" type="text" name="question" inputmode="text" autocomplete="off" placeholder="Ex.: mudanças de consumo nos meus documentos…"></label><div class="pv4-real-actions"><button type="button">Buscar evidências</button><button type="button">Gerar resposta</button></div>';q('#pv4-ask-proxy',m).appendChild(p);const i=q('input',p),bs=qa('button',p);const activeScope=getScope();const hiddenScope=q('#askScope');if(hiddenScope)hiddenScope.value=activeScope==='public'?'universe':activeScope;i.value=input.value;i.oninput=e=>input.value=e.target.value;bs[0].onclick=async()=>{const status=document.getElementById('pv4-shell-status');try{if(status){status.textContent='Recuperando evidências…';status.className='pv4-shell-status show ok'}if(typeof window.__pulseAskSearch==='function')return await window.__pulseAskSearch();if(search)return search.click();throw new Error('ask_search_unavailable')}catch(error){if(status){status.textContent=error?.message||'Não foi possível iniciar a busca.';status.className='pv4-shell-status show error'}console.error('pulse-shell-search',error)}};bs[1].onclick=async()=>{const status=document.getElementById('pv4-shell-status');try{if(status){status.textContent='Gerando leitura…';status.className='pv4-shell-status show ok'}if(typeof window.__pulseAskGenerate==='function')return await window.__pulseAskGenerate();if(gen)return gen.click();throw new Error('ask_generate_unavailable')}catch(error){if(status){status.textContent=error?.message||'Não foi possível gerar a leitura.';status.className='pv4-shell-status show error'}console.error('pulse-shell-generate',error)}};input.style.display='none';if(search)search.style.display='none';if(gen)gen.style.display='none'}const scopeEl=q('#pv3-investigation-scope',m);const syncScope=()=>{if(scopeEl)scopeEl.textContent=scopeLabels[getScope()]||scopeLabels.public};document.addEventListener('pulse:scope-change',syncScope);syncScope();const sync=()=>{if(ans&&ans.textContent.trim())q('#pv4-response',m).innerHTML=ans.innerHTML;if(res&&res.textContent.trim())q('#pv4-results',m).innerHTML=res.innerHTML;if(cit&&cit.textContent.trim())q('.pv4-citation-line',m).innerHTML=cit.innerHTML;};sync();const source=document.querySelector('#query')?.closest('main')||document.querySelector('body');if(source){const mo=new MutationObserver(()=>sync());mo.observe(source,{subtree:true,childList:true,characterData:true});setTimeout(()=>mo.disconnect(),120000);}return m}
async function init(){nav();setScope(getScope());const a=active();if(a==='hoje')hoje();else if(a==='universo')universo();else if(a==='base')basePage(false);else if(a==='analises')basePage(true);else {investigar();bindInvestigationShellActions();}preloadPrivateEvidence().catch(()=>{privateEvidence=[]});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else requestAnimationFrame(init);
})();