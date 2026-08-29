from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / 'index.html'
MARKER = '<!-- PULSE_PRODUCT_V6 -->'

JS = r'''<!-- PULSE_PRODUCT_V6 -->
<script>
(()=>{
'use strict';
if(window.__PULSE_PRODUCT_V6__)return;window.__PULSE_PRODUCT_V6__=true;
const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const arr=v=>Array.isArray(v)?v:[];
const evidence=arr(window.PULSE_EVIDENCE||window.__PULSE_EVIDENCE||window.PULSE_SOURCES);
const claims=arr(window.PULSE_CLAIMS||window.__PULSE_CLAIMS);
const titleOf=o=>o.title||o.name||o.topic||o.claim||'Sinal';
const dateOf=o=>o.date||o.published_at||o.publishedAt||o.period||o.year||null;
const textOf=o=>[o.title,o.name,o.topic,o.claim,o.text,o.summary,o.category,o.channel].filter(Boolean).join(' ').toLowerCase();
const quality=o=>{let s=0;if(o.source||o.url||o.href)s+=25;if(dateOf(o))s+=20;if(o.title||o.name)s+=15;if(o.text||o.summary||o.claim)s+=20;if(o.category||o.topic)s+=10;if(o.region||o.channel)s+=10;return Math.min(100,s)};
const score=o=>{const q=quality(o),r=Number(o.relevance??o.relevanceScore??0),rec=Number(o.recency??0);return Math.round(Math.min(100,q*.55+Math.min(25,Math.max(0,r))+Math.min(20,Math.max(0,rec))))};
const parseDate=v=>{if(v==null)return null;const s=String(v);const m=s.match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?/);if(m)return new Date(Date.UTC(+m[1],(+(m[2]||1))-1,+(m[3]||1)));const d=new Date(s);return Number.isNaN(d.getTime())?null:d};
const periodKey=o=>{const d=parseDate(dateOf(o));return d?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`:(dateOf(o)?String(dateOf(o)):'Sem período')};
const qualityBand=s=>s>=80?'Alta':s>=55?'Moderada':s>0?'Baixa':'Insuficiente';
function derive(){
 const pool=(evidence.length?evidence:claims).filter(Boolean);
 const ranked=pool.map((o,i)=>({...o,__score:score(o),__quality:quality(o),__i:i,__period:periodKey(o)})).sort((a,b)=>b.__score-a.__score);
 const groups={}; ranked.forEach(o=>{const k=o.category||o.topic||o.channel||'Geral';(groups[k]??=[]).push(o)});
 const opportunities=Object.entries(groups).map(([key,v])=>({key,score:Math.round(v.reduce((a,x)=>a+x.__score,0)/v.length),count:v.length,quality:Math.round(v.reduce((a,x)=>a+x.__quality,0)/v.length),top:v[0]})).sort((a,b)=>b.score-a.score).slice(0,5);
 const periods=[...new Set(pool.map(periodKey).filter(x=>x!=='Sem período'))].sort();
 const latest=periods.at(-1), previous=periods.at(-2);
 const temporal=[];
 if(latest&&previous){
   const by=o=>{const k=o.category||o.topic||o.channel||titleOf(o);return k};
   const a={},b={};pool.filter(o=>periodKey(o)===latest).forEach(o=>{const k=by(o);a[k]=(a[k]||0)+1});pool.filter(o=>periodKey(o)===previous).forEach(o=>{const k=by(o);b[k]=(b[k]||0)+1});
   [...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>({key:k,current:a[k]||0,previous:b[k]||0,delta:(a[k]||0)-(b[k]||0)})).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta)).slice(0,5).forEach(x=>temporal.push(x));
 }
 return{pool,ranked,opportunities,periods,latest,previous,temporal};
}
function render(){
 const old=document.getElementById('pulse-v6-lab');if(old)old.remove();const d=derive();if(!d.pool.length)return;
 const recommendations=d.opportunities.slice(0,3).map(x=>`<div class="pulse-v6-row"><b>${esc(x.key)}</b><small>Próximo passo: validar a oportunidade com evidências específicas, contexto da categoria e impacto potencial antes de recomendar ação.</small></div>`).join('');
 const temporal=d.temporal.length?d.temporal.map(x=>`<div class="pulse-v6-row"><b>${esc(x.key)}</b><span>${x.delta>0?'+':''}${x.delta}</span><small>${esc(d.previous)} → ${esc(d.latest)} · contagem observada: ${x.previous} → ${x.current}. Isso não implica causalidade.</small></div>`).join(''):`<p>Ainda não há dois períodos comparáveis suficientes para afirmar mudança temporal.</p>`;
 const exec=`<div class="pulse-v6-exec"><strong>Leitura executiva</strong><p>${d.opportunities.slice(0,3).map(x=>esc(x.key)).join(' · ')} são os principais focos pelo score heurístico atual. Use-os como agenda de investigação, não como conclusão causal.</p></div>`;
 const el=document.createElement('section');el.id='pulse-v6-lab';el.setAttribute('aria-label','Pulse Intelligence Lab');
 el.innerHTML=`<div class="pulse-v6-head"><div><div class="pulse-v6-kicker">PULSE INTELLIGENCE LAB · EVOLUÇÃO</div><h2>Da evidência à decisão</h2><p>Scores transparentes e heurísticos. Não representam significância estatística, causalidade ou probabilidade.</p></div><div class="pulse-v6-actions"><button type="button" id="pulse-v6-copy">Copiar leitura</button><button type="button" id="pulse-v6-print">Visão executiva</button></div></div>${exec}<div class="pulse-v6-grid"><article><h3>Signal Score</h3>${d.ranked.slice(0,5).map((x,i)=>`<div class="pulse-v6-row"><b>${i+1}. ${esc(titleOf(x))}</b><span>${x.__score}/100</span><small>qualidade: ${x.__quality}/100 · ${qualityBand(x.__quality)}</small></div>`).join('')}</article><article><h3>Oportunidades prioritárias</h3>${d.opportunities.map(x=>`<div class="pulse-v6-row"><b>${esc(x.key)}</b><span>${x.score}/100</span><small>${x.count} evidência(s) · qualidade média ${x.quality}/100</small></div>`).join('')}</article><article><h3>Qualidade das evidências</h3><p>Metadados observáveis determinam o score: fonte, data, título, conteúdo, categoria, região/canal.</p><div class="pulse-v6-quality">${['Alta','Moderada','Baixa','Insuficiente'].map(b=>`<span><b>${b}</b> ${d.ranked.filter(x=>qualityBand(x.__quality)===b).length}</span>`).join('')}</div></article><article><h3>Comparação temporal</h3>${d.previous&&d.latest?`<p><b>${esc(d.previous)} → ${esc(d.latest)}</b></p>${temporal}`:temporal}</article><article class="pulse-v6-wide"><h3>Próximas ações de investigação</h3>${recommendations}</article></div>`;
 document.body.appendChild(el);
 document.getElementById('pulse-v6-print')?.addEventListener('click',()=>window.print());
 document.getElementById('pulse-v6-copy')?.addEventListener('click',async()=>{const text=`Leitura executiva\n${d.opportunities.slice(0,3).map((x,i)=>`${i+1}. ${x.key} — ${x.score}/100`).join('\n')}\n\nScores heurísticos; validar antes de concluir.`;try{await navigator.clipboard.writeText(text);document.getElementById('pulse-v6-copy').textContent='Copiado';setTimeout(()=>document.getElementById('pulse-v6-copy').textContent='Copiar leitura',1400)}catch(e){}});
}
const css=document.createElement('style');css.textContent='#pulse-v6-lab{margin:32px auto;max-width:1180px;padding:28px;border:1px solid rgba(20,20,20,.12);border-radius:22px;background:#fff;box-shadow:0 12px 36px rgba(0,0,0,.06);font-family:inherit}.pulse-v6-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.pulse-v6-head h2{margin:5px 0;font-size:26px}.pulse-v6-head p{margin:0;opacity:.7}.pulse-v6-actions{display:flex;gap:8px;flex-wrap:wrap}.pulse-v6-actions button{border:1px solid rgba(20,20,20,.15);border-radius:10px;padding:9px 12px;background:#fff;cursor:pointer}.pulse-v6-exec{margin-top:18px;padding:16px;border-radius:14px;background:rgba(20,20,20,.045)}.pulse-v6-exec p{margin:6px 0 0}.pulse-v6-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}.pulse-v6-grid article{border:1px solid rgba(20,20,20,.1);border-radius:16px;padding:18px}.pulse-v6-grid h3{margin:0 0 12px}.pulse-v6-row{display:grid;grid-template-columns:1fr auto;gap:3px 10px;padding:10px 0;border-top:1px solid rgba(20,20,20,.08)}.pulse-v6-row span{font-weight:800}.pulse-v6-row small{grid-column:1/-1;opacity:.62}.pulse-v6-wide{grid-column:1/-1}.pulse-v6-quality{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pulse-v6-quality span{padding:10px;border-radius:10px;background:rgba(20,20,20,.045);display:flex;flex-direction:column;gap:2px}@media(max-width:760px){.pulse-v6-head{flex-direction:column}.pulse-v6-grid{grid-template-columns:1fr}.pulse-v6-wide{grid-column:auto}.pulse-v6-quality{grid-template-columns:repeat(2,1fr)}}@media print{#pulse-v6-lab{box-shadow:none;border:0}#pulse-v6-actions,#pulse-v6-copy,#pulse-v6-print{display:none}.pulse-v6-wide{grid-column:1/-1}}';document.head.appendChild(css);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
</script>
'''

def main():
    text = INDEX.read_text(encoding='utf-8')
    if MARKER in text:
        text = re.sub(r'<!-- PULSE_PRODUCT_V6 -->.*?</script>\s*', JS, text, count=1, flags=re.S)
    else:
        pos = text.lower().rfind('</body>')
        if pos < 0:
            raise RuntimeError('index.html sem </body>')
        text = text[:pos] + JS + text[pos:]
    INDEX.write_text(text, encoding='utf-8')
    print('Pulse Product V6 intelligence layer evolved')

if __name__ == '__main__':
    main()
