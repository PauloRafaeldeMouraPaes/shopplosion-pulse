/* Shopplosion Pulse — local evidence answer rendering */
(function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function install() {
    var original = window.pulseRenderCustomAnswer;
    if (typeof original !== 'function' || original.__pulseLocalWrapped) return;
    function wrapped() {
      var box = document.getElementById('pulse-question'), body = document.getElementById('pulse-custom-body'), title = document.getElementById('pulse-custom-title'), subtitle = document.getElementById('pulse-custom-subtitle');
      var question = box ? box.value : '', match = typeof window.pulseMatchEvidence === 'function' ? window.pulseMatchEvidence(question) : null;
      if (!match || !match.localStudy) return original();
      if (title) title.textContent = 'Fato → Contexto → Interpretação → Hipótese → Ação';
      if (subtitle) subtitle.textContent = 'Resposta composta com evidência da sua base local para: “' + esc(question) + '”';
      if (!body) return;
      var source = match.fonte || match.sourceName || 'Arquivo local';
      var period = match.periodo || 'Base local';
      body.innerHTML = '<div class="box"><span class="confidence pulse-source-local">SUA BASE LOCAL · DESCRITIVA</span><h2>FATO</h2><p>' + esc(match.fato) + '</p><div class="source-line">Fonte: ' + esc(source) + ' · Período: ' + esc(period) + ' · Confiança: descritiva</div></div>' +
        '<div class="box"><h2>CONTEXTO</h2><p>' + esc(match.contexto) + '</p></div>' +
        '<div class="box"><h2>INTERPRETAÇÃO</h2><p>O trecho foi extraído do arquivo local e não recebe uma interpretação automática apresentada como fato.</p></div>' +
        '<div class="hypo"><b>HIPÓTESE A VALIDAR</b><p>Valide esta leitura contra outras evidências, metodologia do estudo e contexto da categoria antes de tomar uma decisão.</p></div>' +
        '<div class="box"><h2>AÇÃO SUGERIDA</h2><p>Use o estudo como evidência proprietária e compare-o com a base pública do Pulse para investigar convergências e divergências.</p></div>';
    }
    wrapped.__pulseLocalWrapped = true;
    window.pulseRenderCustomAnswer = wrapped;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(install, 0); }); else setTimeout(install, 0);
})();