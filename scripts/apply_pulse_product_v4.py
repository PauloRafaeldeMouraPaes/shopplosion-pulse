from pathlib import Path

HTML = Path('index.html')
MARKER = '<!-- PULSE_PRODUCT_V4 -->'

STYLE = r'''<style id="pulse-product-v4-style">
#pulse-insight-lab{margin:24px 0;padding:20px;border:1px solid rgba(0,0,0,.10);border-radius:18px;background:linear-gradient(180deg,#fff,#fafafa);box-shadow:0 8px 30px rgba(0,0,0,.05)}
#pulse-insight-lab .p4-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}
#pulse-insight-lab h2{margin:0;font-size:1.2rem}
#pulse-insight-lab .p4-note{margin:5px 0 0;color:#666;font-size:.86rem;max-width:760px}
#pulse-insight-lab .p4-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
#pulse-insight-lab button{border:1px solid rgba(0,0,0,.14);background:#fff;border-radius:999px;padding:8px 12px;cursor:pointer;font:inherit}
#pulse-insight-lab button[aria-selected="true"]{background:#111;color:#fff}
#pulse-insight-lab .p4-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
#pulse-insight-lab .p4-card{padding:14px;border:1px solid rgba(0,0,0,.09);border-radius:14px;background:#fff}
#pulse-insight-lab .p4-card h3{font-size:.96rem;margin:0 0 7px}
#pulse-insight-lab .p4-meta{font-size:.78rem;color:#666;margin-top:8px}
#pulse-insight-lab .p4-score{font-size:1.35rem;font-weight:700;float:right}
#pulse-insight-lab .p4-empty{padding:18px;border-radius:12px;background:#f5f5f5;color:#555}
#pulse-insight-lab .p4-legend{margin-top:12px;font-size:.76rem;color:#666}
@media(max-width:640px){#pulse-insight-lab{padding:15px}.p4-head{flex-direction:column}}
@media print{#pulse-insight-lab{break-inside:avoid}}
</style>'''

SCRIPT = r'''<script id="pulse-product-v4-script">
(function(){
  'use strict';
  if(document.getElementById('pulse-insight-lab')) return;
  var evidence=Array.isArray(window.PULSE_EVIDENCE)?window.PULSE_EVIDENCE:[];
  var root=document.querySelector('main')||document.body;
  if(!root) return;
  var section=document.createElement('section');
  section.id='pulse-insight-lab';
  section.setAttribute('aria-labelledby','pulse-insight-lab-title');
  section.innerHTML='<div class="p4-head"><div><h2 id="pulse-insight-lab-title">Insight Lab</h2><p class="p4-note">Camada de decisão baseada exclusivamente nas evidências carregadas. A priorização abaixo é heurística e serve para orientar investigação, não para substituir julgamento analítico.</p></div></div><div class="p4-tabs" role="tablist" aria-label="Visões do Insight Lab"><button type="button" data-p4-tab="prioridades" role="tab" aria-selected="true">Prioridades</button><button type="button" data-p4-tab="evidencias" role="tab" aria-selected="false">Evidências recentes</button><button type="button" data-p4-tab="contradicoes" role="tab" aria-selected="false">Revisão de divergências</button></div><div id="pulse-insight-lab-content"></div><div class="p4-legend">Nota metodológica: o score combina sinais explícitos do registro (confiança, ação e recência quando disponível). Não é probabilidade, significância estatística nem causalidade.</div>';
  root.insertBefore(section,root.firstChild||null);
  var content=section.querySelector('#pulse-insight-lab-content');
  var norm=function(v){return String(v==null?'':v).trim()};
  var confidence=function(v){
    var s=norm(v).toLowerCase();
    if(/alta|high|forte/.test(s)) return 3;
    if(/media|m[eé]dia|moderada|medium/.test(s)) return 2;
    if(/baixa|low|fraca/.test(s)) return 1;
    var n=parseFloat(s.replace(',','.'));
    return isFinite(n)?(n<=1?n*3:n>=3?3:n):1.5;
  };
  var dateFrom=function(item){
    var text=norm(item.periodo||item.data||item.date||'');
    var m=text.match(/(20\\d{2})[-\\/](\\d{1,2})(?:[-\\/](\\d{1,2}))?/);
    if(!m) return null;
    var d=new Date(Date.UTC(+m[1],+m[2]-1,+(m[3]||1)));
    return isNaN(d)?null:d;
  };
  var recency=function(item){
    var d=dateFrom(item); if(!d) return 1;
    var days=Math.max(0,(Date.now()-d.getTime())/86400000);
    return days<=90?3:days<=180?2:1;
  };
  var score=function(item){
    var c=confidence(item.confianca), r=recency(item), a=norm(item.acao)?2:0, h=norm(item.hipotese)?1:0;
    return Math.round(((c/3)*45+(r/3)*30+(a/2)*15+(h/1)*10));
  };
  var esc=function(v){return norm(v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})};
  var title=function(item){return esc(item.titulo||item.tema||item.fato||item.contexto||'Evidência sem título');};
  var card=function(item,showScore){
    var html='<article class="p4-card">';
    if(showScore) html+='<span class="p4-score">'+score(item)+'</span>';
    html+='<h3>'+title(item)+'</h3>';
    if(item.fato) html+='<div>'+esc(item.fato)+'</div>';
    if(item.interpretacao) html+='<div class="p4-meta"><strong>Interpretação:</strong> '+esc(item.interpretacao)+'</div>';
    if(item.hipotese) html+='<div class="p4-meta"><strong>Hipótese:</strong> '+esc(item.hipotese)+'</div>';
    if(item.acao) html+='<div class="p4-meta"><strong>Ação:</strong> '+esc(item.acao)+'</div>';
    html+='<div class="p4-meta">Fonte: '+esc(item.fonte||'não informada')+' · Confiança: '+esc(item.confianca||'não informada')+'</div></article>';
    return html;
  };
  var hasContradiction=function(item){return /contradi|diverg|conflit|revis[aã]o/i.test(norm(item.possivel_contradicao||item.contradicao||item.flag_revisao||''));};
  var render=function(tab){
    var items=evidence.slice();
    if(!items.length){content.innerHTML='<div class="p4-empty">Nenhuma evidência estruturada disponível para esta camada.</div>';return;}
    if(tab==='prioridades'){
      items.sort(function(a,b){return score(b)-score(a);});
      content.innerHTML='<div class="p4-grid">'+items.slice(0,8).map(function(x){return card(x,true);}).join('')+'</div>';
    }else if(tab==='evidencias'){
      items.sort(function(a,b){var da=dateFrom(a),db=dateFrom(b);return (db?db.getTime():0)-(da?da.getTime():0);});
      var dated=items.filter(function(x){return dateFrom(x);});
      if(!dated.length){content.innerHTML='<div class="p4-empty">Os registros atuais não trazem datas de período em formato comparável. A interface não inventa uma evolução temporal sem dados suficientes.</div>';return;}
      content.innerHTML='<div class="p4-grid">'+dated.slice(0,8).map(function(x){return card(x,false);}).join('')+'</div>';
    }else{
      var flags=items.filter(hasContradiction);
      content.innerHTML=flags.length?'<div class="p4-grid">'+flags.map(function(x){return card(x,false);}).join('')+'</div>':'<div class="p4-empty">Nenhuma divergência foi explicitamente sinalizada nos registros atuais. Isso não prova ausência de contradições; significa apenas que não há flag estruturada para revisão.</div>';
    }
  };
  section.querySelectorAll('[data-p4-tab]').forEach(function(btn){btn.addEventListener('click',function(){section.querySelectorAll('[data-p4-tab]').forEach(function(b){b.setAttribute('aria-selected',b===btn?'true':'false');});render(btn.getAttribute('data-p4-tab'));});});
  render('prioridades');
})();
</script>'''

text=HTML.read_text(encoding='utf-8')
if MARKER in text:
    raise SystemExit('PULSE_PRODUCT_V4 already applied')
needle='</body>'
if needle not in text:
    raise SystemExit('closing body tag not found')
text=text.replace(needle, MARKER+'\n'+STYLE+'\n'+SCRIPT+'\n'+needle, 1)
HTML.write_text(text, encoding='utf-8')
print('Applied Pulse Product v4')
