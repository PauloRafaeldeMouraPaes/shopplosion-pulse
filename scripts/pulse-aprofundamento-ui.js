(function(){
  'use strict';
  const P=window.PULSE_DEEPENING;
  if(!P)return;

  const q=s=>document.querySelector(s);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const areas=['Trade','Marketing','Insights','IM','GC','RGM'];
  const areaKey='pulse:area';

  function getArea(){
    try{
      const value=localStorage.getItem(areaKey);
      return areas.includes(value)?value:'Insights';
    }catch{
      return 'Insights';
    }
  }

  function evidenceRows(){
    const answer=window.__pulseLastAnswer;
    if(Array.isArray(answer?.evidence)&&answer.evidence.length)return answer.evidence;
    return (Array.isArray(window.__pulsePublicMatches)?window.__pulsePublicMatches:[])
      .map(row=>row.e).filter(Boolean);
  }

  function evidenceTexts(rows){
    return rows.map(e=>[
      e.fato,e.contexto,e.interpretacao,e.hipotese,e.acao,
      e.content,e.quote
    ].filter(Boolean).join(' '));
  }

  function context(query,rows){
    const privateRows=rows.filter(e=>e&&e.document_id);
    const sources=new Set(rows.map(e=>e.source_id||e.source_item_id||e.document_id||e.fonte||e.source_type).filter(Boolean));
    const normalized=String(query||'').toLowerCase();
    return {
      singleSource:sources.size===1&&rows.length>0,
      internalGap:/minha categoria|meu negócio|meu negocio|minha empresa|meu sell.?out|meu canal/.test(normalized)&&privateRows.length===0,
      baseAnswers:P.classifyQuestion(query)==='mercado'&&rows.length>0,
      divergence:/diverg|conflit|contrad/.test(String(window.__pulseLastAnswer?.answer||'').toLowerCase())
    };
  }

  function addArea(){
    const scope=q('#askScope');
    if(!scope||q('#pulseArea'))return;
    const wrapper=document.createElement('div');
    wrapper.className='pulse-area';
    wrapper.innerHTML='<label for="pulseArea">Minha área</label><select id="pulseArea" aria-label="Minha área">'+
      areas.map(area=>'<option>'+esc(area)+'</option>').join('')+
      '</select>';
    scope.closest('.askScopeSelect')?.after(wrapper);
    const select=q('#pulseArea');
    if(select)select.value=getArea();
    select?.addEventListener('change',render);
  }

  function buildBriefText(answer,rows){
    const brief=P.buildBrief({query:answer.query,evidence:rows});
    const sources=evidenceTexts(rows);
    const candidate=[
      brief.decision,brief.method,brief.audience,
      ...brief.questions,
      ...brief.hypotheses.map(item=>item.text)
    ].join(' ');
    if(P.hasUnsupportedNumbers(candidate,sources))return null;
    return {brief,text:[
      'DECISÃO DE NEGÓCIO',brief.decision,'',
      'PERGUNTAS-CHAVE',...brief.questions.map((item,index)=>(index+1)+'. '+item),'',
      'HIPÓTESES A TESTAR',...brief.hypotheses.map((item,index)=>
        (index+1)+'. '+item.text+' | Evidência: '+item.evidence+' | Fonte: '+item.source),'',
      'O PULSE JÁ SABE',...brief.whatPulseKnows.map(item=>'- '+item),'',
      'MÉTODO',brief.method+' — '+brief.why,'',
      'PÚBLICO E RECORTES','Público: '+brief.audience+' | '+brief.recortes.join(', '),'',
      'ENTREGÁVEIS',...brief.deliverables.map(item=>'- '+item),'',
      'AMOSTRA, PRAZO E CUSTO','A DEFINIR. Determinantes: '+brief.determines.join(', '),'',
      'Escopo sugerido a partir das evidências citadas. Revisar com um pesquisador antes de contratar.'
    ].join('\n')};
  }

  function renderBrief(answer,rows){
    const slot=q('#pulseResearchSlot');
    if(!slot)return;
    const built=buildBriefText(answer,rows);
    if(!built){
      slot.innerHTML='<div class="pulse-research"><h3>Escopo bloqueado</h3><p>O brief contém número fora das evidências de origem. O Pulse não libera a sugestão até a proveniência ser corrigida.</p></div>';
      return;
    }
    const {brief,text}=built;
    slot.innerHTML='<div class="pulse-research">'+
      '<h3>Escopo de pesquisa sugerido</h3>'+
      '<div class="briefGrid">'+
        '<div class="briefItem"><small>Decisão</small><strong>'+esc(brief.decision)+'</strong></div>'+
        '<div class="briefItem"><small>Método</small><strong>'+esc(brief.method)+'</strong></div>'+
        '<div class="briefItem"><small>Público</small><strong>'+esc(brief.audience)+'</strong></div>'+
        '<div class="briefItem"><small>Recortes</small><strong>'+esc(brief.recortes.join(' · '))+'</strong></div>'+
      '</div>'+
      '<p style="margin-top:10px;white-space:pre-wrap">'+esc(text)+'</p>'+
      '<div class="pulse-research-actions">'+
        '<button class="primary" id="pulseCopyBrief" type="button">Copiar brief</button>'+
        '<button id="pulseSaveBrief" type="button">Salvar</button>'+
        '<button id="pulseTalkBrief" type="button">Falar com a Shopplosion</button>'+
      '</div>'+
      '<p style="margin-top:9px">Escopo sugerido a partir das evidências citadas. Revisar com um pesquisador antes de contratar.</p>'+
    '</div>';

    q('#pulseCopyBrief')?.addEventListener('click',async()=>{
      try{
        await navigator.clipboard.writeText(text);
        q('#pulseCopyBrief').textContent='Copiado';
      }catch{
        q('#pulseCopyBrief').textContent='Copie o texto exibido';
      }
    });

    q('#pulseSaveBrief')?.addEventListener('click',async()=>{
      const button=q('#pulseSaveBrief');
      button.disabled=true;
      let saved=false;
      try{
        if(window.pulseCreateClient&&window.PULSE_SUPABASE_CONFIG){
          const db=pulseCreateClient();
          const result=await db.auth.getUser();
          const user=result.data?.user;
          if(user&&answer.industry_id){
            const now=new Date().toISOString();
            const payload={
              version:1,type:'research_scope',question:answer.query,
              scope:answer.scope||'industry',
              originating_evidence_id:answer.originating_evidence_id||null,
              status:'open',brief:text,updated_at:now
            };
            const response=await db.from('investigations').insert({
              industry_id:answer.industry_id,created_by:user.id,
              title:('Escopo: '+answer.query).slice(0,120),
              question:answer.query,scope:answer.scope||'industry',
              originating_evidence_id:answer.originating_evidence_id||null,
              status:'open',payload,last_updated_at:now
            }).select('id').single();
            saved=!response.error;
          }
        }
      }catch{}
      if(!saved){
        try{
          const request=indexedDB.open('pulse-research-briefs',1);
          request.onupgradeneeded=()=>request.result.createObjectStore('briefs',{keyPath:'id'});
          await new Promise((resolve,reject)=>{
            request.onerror=reject;
            request.onsuccess=()=>{
              const db=request.result;
              const tx=db.transaction('briefs','readwrite');
              tx.objectStore('briefs').put({
                id:Date.now(),query:answer.query,text,created_at:new Date().toISOString()
              });
              tx.oncomplete=resolve;
              tx.onerror=reject;
            };
          });
          saved=true;
        }catch{}
      }
      button.textContent=saved?'Salvo':'Não foi possível salvar';
      button.disabled=false;
    });

    q('#pulseTalkBrief')?.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(text)}catch{}
      q('#pulseTalkBrief').textContent='Brief copiado — fale com a Shopplosion pelo canal comercial disponível';
    });
  }

  function render(){
    const answerPanel=q('#answerPanel');
    if(!answerPanel||answerPanel.classList.contains('hidden'))return;
    let box=q('#pulseFollowups');
    if(!box){
      box=document.createElement('section');
      box.id='pulseFollowups';
      box.className='pulse-deepen';
      answerPanel.after(box);
    }
    const answer=window.__pulseLastAnswer;
    const rows=evidenceRows();
    if(!answer||!rows.length){box.innerHTML='';return;}

    const history=new Set();
    try{
      JSON.parse(localStorage.getItem('pulse:deepening-history')||'[]')
        .forEach(item=>history.add(item));
    }catch{}

    const questions=[];
    rows.forEach(e=>{
      P.buildQuestions(e,getArea()).forEach(question=>{
        if(questions.length<3&&!history.has(question.texto))questions.push(question);
      });
    });

    const query=answer.query||q('#query')?.value||'';
    const trigger=P.researchTrigger(query,context(query,rows));
    const questionsHtml=questions.map(question=>
      '<button class="pulse-deepen-btn" type="button" data-pulse-question="'+
      esc(question.texto)+'"><span class="pulse-deepen-meta">'+
      esc(question.tipo)+' · '+esc(question.quem)+'</span>'+
      esc(question.texto)+'</button>'
    ).join('');

    const researchHtml=trigger.trigger
      ? '<div id="pulseResearchSlot"><div class="pulse-research"><h3>O que falta para responder?</h3><p>'+
        esc(trigger.reason)+'</p><div class="pulse-research-actions"><button class="primary" id="pulseBuildBrief" type="button">Sugerir escopo de pesquisa</button></div></div></div>'
      : '<div id="pulseResearchSlot"><div class="pulse-research"><h3>Não precisa de pesquisa neste momento</h3><p>'+
        esc(trigger.reason)+'</p></div></div>';

    box.innerHTML='<h3>Aprofunde antes de decidir</h3>'+
      '<p>Escolha uma pergunta para aprofundar a evidência. O clique apenas preenche o Ask AI; nada é enviado automaticamente.</p>'+
      '<div class="pulse-deepen-list">'+questionsHtml+'</div>'+researchHtml;

    box.onclick=event=>{
      const questionButton=event.target.closest('[data-pulse-question]');
      if(questionButton){
        const text=questionButton.getAttribute('data-pulse-question')||'';
        const input=q('#query');
        if(input){input.value=text;input.focus();}
        try{
          const history=JSON.parse(localStorage.getItem('pulse:deepening-history')||'[]');
          history.push(text);
          localStorage.setItem('pulse:deepening-history',JSON.stringify(history.slice(-30)));
        }catch{}
        return;
      }
      if(event.target.id==='pulseBuildBrief')renderBrief(answer,rows);
    };
  }

  const init=()=>{
    addArea();
    ['#answer','#citations'].forEach(selector=>{
      const element=q(selector);
      if(element)new MutationObserver(render).observe(element,{subtree:true,childList:true,characterData:true});
    });
    render();
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
  window.PULSE_RENDER_DEEPENING=render;
})();