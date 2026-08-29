from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
MARKER = "<!-- PULSE_PRODUCT_V6 -->"

JS = r'''<!-- PULSE_PRODUCT_V6 -->
<script>
(()=>{
'use strict';
if(window.__PULSE_PRODUCT_V6__)return;window.__PULSE_PRODUCT_V6__=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const arr=v=>Array.isArray(v)?v:[];
const evidence=arr(window.PULSE_EVIDENCE||window.__PULSE_EVIDENCE||window.PULSE_SOURCES);
const claims=arr(window.PULSE_CLAIMS||window.__PULSE_CLAIMS);
const getText=o=>[o.title,o.name,o.claim,o.text,o.summary,o.description,o.topic,o.category,o.channel].filter(Boolean).join(' ');
const dateOf=o=>o.date||o.published_at||o.publishedAt||o.period||o.year||null;
const quality=o=>{let s=0;if(o.source||o.url||o.href)s+=25;if(o.date||o.published_at||o.period)s+=20;if(o.title||o.name)s+=15;if(o.text||o.summary||o.claim)s+=20;if(o.category||o.topic)s+=10;if(o.region||o.channel)s+=10;return Math.min(100,s)};
const tokens=s=>(String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{4,}/g)||[]);
const score=o=>{const q=quality(o),r=(o.relevance??o.relevanceScore??0);const rec=(o.recency??0);return Math.round(Math.min(100,q*.55+Math.min(25,Number(r)||0)+Math.min(20,Number(rec)||0)))};
function derive(){
 const pool=evidence.length?evidence:claims;
 const ranked=pool.map((o,i)=>({...o,__score:score(o),__quality:quality(o),__i:i,__date:dateOf(o)})).sort((a,b)=>b.__score-a.__score);
 const groups={};ranked.forEach(o=>{const k=o.category||o.topic||o.channel||'Geral';(groups[k]??=[]).push(o)});
 const opportunities=Object.entries(groups).map(([k,v])=>{const avg=Math.round(v.reduce((a,x)=>a+x.__score,0)/v.length);return{key:k,score:avg,count:v.length,best:v[0]}}).sort((a,b)=>b.score-a.score).slice(0,5);
 const periods=[...new Set(pool.map(dateOf).filter(Boolean).map(String))];
 return {pool,ranked,opportunities,periods};
}
function render(){
 const old=document.getElementById('pulse-v6-lab');if(old)old.remove();
 const d=derive();if(!d.pool.length)return;
 const el=document.createElement('section');el.id='pulse-v6-lab';el.setAttribute('aria-label','Pulse Intelligence Lab');
 el.innerHTML=`<div class="pulse-v6-head"><div><div class="pulse-v6-kicker">PULSE INTELLIGENCE LAB</div><h2>Da evidência à decisão</h2><p>Camada analítica transparente sobre as evidências disponíveis. Scores são heurísticos e não representam significância estatística.</p></div><button type="button" id="pulse-v6-print">Visão executiva</button></div><div class="pulse-v6-grid"><article><h3>Signal Score</h3>${d.ranked.slice(0,5).map((x,i)=>`<div class="pulse-v6-row"><b>${i+1}. ${esc(x.title||x.name||x.topic||'Sinal')}</b><span>${x.__score}/100</span><small>qualidade da evidência: ${x.__quality}/100</small></div>`).join('')}</article><article><h3>Oportunidades</h3>${d.opportunities.map(x=>`<div class="pulse-v6-row"><b>${esc(x.key)}</b><span>${x.score}/100</span><small>${x.count} evidência(s) · investigar antes de concluir</small></div>`).join('')}</article><article><h3>Qualidade das evidências</h3><div class="pulse-v6-quality">${d.ranked.slice(0,8).map(x=>`<span><b>${x.__quality}</b><small>${esc(x.title||x.name||x.topic||'Fonte')}</small></span>`).join('')}</div></article><article><h3>Comparação temporal</h3><p>${d.periods.length>1?`Foram identificados ${d.periods.length} períodos/recortes temporais. A comparação automática exige datas comparáveis; nenhuma tendência causal é inferida.`:'Ainda não há períodos comparáveis suficientes para afirmar mudança temporal.'}</p></article></div>`;
 document.body.appendChild(el);
 document.getElementById('pulse-v6-print')?.addEventListener('click',()=>{window.print()});
}
const css=document.createElement('style');css.textContent=`#pulse-v6-lab{margin:32px auto;max-width:1180px;padding:28px;border:1px solid rgba(20,20,20,.12);border-radius:22px;background:#fff;box-shadow:0 12px 36px rgba(0,0,0,.06);font-family:inherit}.pulse-v6-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.pulse-v6-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;opacity:.6}.pulse-v6-head h2{margin:5px 0;font-size:26px}.pulse-v6-head p{margin:0;max-width:720px;opacity:.7}.pulse-v6-head button{border:0;border-radius:12px;padding:11px 15px;font-weight:700;cursor:pointer}.pulse-v6-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:22px}.pulse-v6-grid article{border:1px solid rgba(20,20,20,.1);border-radius:16px;padding:18px}.pulse-v6-grid h3{margin:0 0 12px}.pulse-v6-row{display:grid;grid-template-columns:1fr auto;gap:3px 10px;padding:10px 0;border-top:1px solid rgba(20,20,20,.08)}.pulse-v6-row span{font-weight:800}.pulse-v6-row small{grid-column:1/-1;opacity:.62}.pulse-v6-quality{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.pulse-v6-quality span{display:flex;flex-direction:column;padding:10px;border-radius:12px;background:rgba(0,0,0,.035)}.pulse-v6-quality b{font-size:20px}.pulse-v6-quality small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.65}@media(max-width:760px){.pulse-v6-head{flex-direction:column}.pulse-v6-grid{grid-template-columns:1fr}.pulse-v6-quality{grid-template-columns:repeat(2,1fr)}}@media print{#pulse-v6-lab{box-shadow:none;border:0}#pulse-v6-print{display:none}}`;
document.head.appendChild(css);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
</script>
'''

text=INDEX.read_text(encoding='utf-8')
if MARKER in text:
    text=re.sub(r'<!-- PULSE_PRODUCT_V6 -->.*?</script>\s*',JS+'',text,flags=re.S)
else:
    pos=text.lower().rfind('</body>')
    if pos<0: raise SystemExit('index.html sem </body>')
    text=text[:pos]+JS+text[pos:]
INDEX.write_text(text,encoding='utf-8')
print('Pulse Product V6 injected')
