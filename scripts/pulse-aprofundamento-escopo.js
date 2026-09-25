(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.PULSE_DEEPENING=factory();
})(typeof window!=='undefined'?window:globalThis,function(){
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const areaPriority={
    Trade:['Recorte','Contraprova','Decisão','Dado interno'],
    Marketing:['Tendência','Porquê do shopper','Recorte','Decisão'],
    Insights:['Dado interno','Porquê do shopper','Contraprova','Recorte'],
    IM:['Recorte','Tendência','Contraprova','Dado interno'],
    GC:['Porquê do shopper','Recorte','Dado interno','Decisão'],
    RGM:['Recorte','Contraprova','Dado interno','Decisão']
  };
  const templates={
    Recorte:()=>({tipo:'Recorte',quem:'Seus dados',texto:'Na minha categoria, como esse movimento se comporta por canal, região, faixa de preço ou pack?'}),
    Contraprova:()=>({tipo:'Contraprova',quem:'Seus dados',texto:'Que evidência no meu negócio poderia invalidar esta leitura?'}),
    'Dado interno':()=>({tipo:'Dado interno',quem:'Seus dados',texto:'O que o sell-out, painel ou estudo da minha empresa mostra sobre esta evidência?'}),
    Tendência:()=>({tipo:'Tendência',quem:'Base Pulse',texto:'Esse movimento é pontual ou aparece no mesmo período de outros ciclos?'}),
    'Porquê do shopper':()=>({tipo:'Porquê do shopper',quem:'Pesquisa',texto:'O que explica essa escolha do shopper na minha categoria, missão ou ocasião de compra?'}),
    Decisão:()=>({tipo:'Decisão',quem:'Seus dados',texto:'Se esta hipótese se confirmar, qual decisão de preço, pack, promoção, mix, canal ou execução muda?'})
  };
  function buildQuestions(evidence,area){
    const e=evidence||{}; const id=String(e.id||e.document_id||'sem-id');
    const conf=String(e.confidence??e.confianca??'').toLowerCase();
    const sourceCount=Number(e.source_count||e.sources_count||0);
    const priority=areaPriority[area]||['Recorte','Contraprova','Dado interno','Tendência','Porquê do shopper','Decisão'];
    const ordered=(conf.includes('baixo')||conf.includes('low')||sourceCount===1)?['Contraprova','Dado interno',...priority]:priority;
    const out=[]; const seen=new Set();
    ordered.forEach(type=>{if(out.length>=6||seen.has(type))return;const t=templates[type];if(!t)return;const q=t(e),key=normalize(q.texto);if(!seen.has(key)){seen.add(key);out.push({...q,evidenceId:id});}});
    return out.slice(0,6);
  }
  function researchTrigger(query,ctx={}){
    const s=normalize(query);
    if(ctx.baseAnswers===true) return {trigger:false,reason:'A base disponível já responde à pergunta.'};
    if(ctx.divergence===true) return {trigger:true,reason:'Há divergência entre evidências ou estudos.'};
    if(ctx.internalGap===true) return {trigger:true,reason:'A lacuna depende de dado interno que ainda não foi fornecido.'};
    if(/shopper.*(por que|troca|escolh|motiva|percepc)|motiv|percepc|decisao.*pdv|gondola|missao.*compra|ocasiao.*compra|aceita pagar|sensibilidade.*preco|hierarquia.*escolha|troca.*marca/.test(s)) return {trigger:true,reason:'A pergunta pede motivação, percepção ou decisão do shopper, que dado de mercado sozinho não responde.'};
    if((ctx.lowConfidence===true||ctx.singleSource===true)&&/decis|estrateg|preco|pack|promoc|sortimento|mix|canal|portifolio/.test(s)) return {trigger:true,reason:'A decisão está apoiada em evidência de baixa confiança ou fonte única.'};
    return {trigger:false,reason:'A pergunta é respondível pela base disponível sem pesquisa primária.'};
  }
  function methodFor(query){
    const s=normalize(query);
    if(/efeito.*ativ|ativacao.*loja|material.*pdv|ponto extra|ruptura|decisao.*gondola|gondola/.test(s)) return {method:'Campo',why:'Observação ou entrevista de saída captura comportamento no contexto real de compra.',techniques:['entrevista de saída','observação','acompanhamento de compra']};
    if(/sensibilidade.*preco|faixa.*preco|preco.*aceit|willingness|preco/.test(s)) return {method:'Online quantitativo',why:'Permite dimensionar resposta a faixas e pontos de preço.',techniques:['Van Westendorp','Gabor-Granger','escolha discreta']};
    if(/hierarquia|marca.*pack|pack.*preco|sabor/.test(s)) return {method:'Online quantitativo + checagem qualitativa',why:'Quantifica a ordem de escolha e usa qualitativo para entender o mecanismo.',techniques:['árvore de decisão','checagem qualitativa']};
    if(/missao|ocasiao/.test(s)) return {method:'Online quantitativo',why:'Dimensiona missões e ocasiões; campo entra quando o contexto do canal é determinante.',techniques:['questionário estruturado','campo por canal, se necessário']};
    if(/atacarejo|transformador|classes d.?e|regiao.*especific|publico.*dificil/.test(s)) return {method:'Campo',why:'O público ou contexto é mais difícil de alcançar ou depende do ambiente de compra.',techniques:['entrevista de saída','abordagem dirigida']};
    if(/shopper.*(por que|troca|escolh|motiva|percepc)|troca.*marca|explor|sem hipotese|nao sabemos|o que esta por tras/.test(s)) return {method:'Qualitativo antes do quantitativo',why:'Primeiro é necessário descobrir linguagem, hipóteses e mecanismos; depois dimensionar.',techniques:['entrevistas em profundidade','grupos/mini-grupos','follow-up quantitativo']};
    if(/quantos|frequencia|perfil|percentual|tamanho.*publico|dimension/.test(s)) return {method:'Online quantitativo',why:'É adequado para dimensionar comportamento, frequência e perfil.',techniques:['questionário estruturado']};
    return {method:'A DEFINIR',why:'A decisão e o contexto ainda não determinam um método com segurança.',techniques:[]};
  }
  function extractNumbers(text){return (String(text||'').match(/(?:R\$\s*)?\b\d+(?:[.,]\d+)?(?:\s*%|\s*p\.p\.)?/g)||[]).map(x=>normalize(x).replace(/\s+/g,''));}
  function hasUnsupportedNumbers(text,evidenceTexts){
    const allowed=new Set(evidenceTexts.flatMap(extractNumbers));
    return extractNumbers(text).some(n=>!allowed.has(n));
  }
  function buildBrief(input={}){
    const q=String(input.query||'').trim(),ev=Array.isArray(input.evidence)?input.evidence:[],m=methodFor(q);
    return {decision:q||'[A DEFINIR]',questions:[q||'[A DEFINIR]'],hypotheses:ev.slice(0,5).map((e,i)=>({text:e.hypotese||e.hypothesis||'[A DEFINIR]',evidence:e.id||e.document_id||'E'+(i+1),source:e.fonte||e.source_title||e.source_type||'[A DEFINIR]'})),whatPulseKnows:ev.map(e=>e.fato||e.content||e.quote||'').filter(Boolean).slice(0,8),method:m.method,why:m.why,audience:'[A DEFINIR]',recortes:['canal','região','classe','varejista'],deliverables:['brief de pesquisa','base de leitura por recorte','limitações do método'],sample:'[A DEFINIR]',deadline:'[A DEFINIR]',cost:'[A DEFINIR]',determines:['quantidade de recortes','incidência do público','margem de erro desejada']};
  }
  return {buildQuestions,areaPriority,researchTrigger,methodFor,hasUnsupportedNumbers,buildBrief};
});