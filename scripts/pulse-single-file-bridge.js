/* Shopplosion Pulse — single-file UX bridge */
(function () {
  'use strict';
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim(); };
  var labels = { chocolates: 'Chocolates', bebidas: 'Bebidas', saude: 'Saúde & bem-estar', 'saude-bem-estar': 'Saúde & bem-estar', geral: 'Visão transversal', 'visao-transversal': 'Visão transversal' };
  function injectStyles() {
    if (q('#pulse-single-file-styles')) return;
    var s = document.createElement('style'); s.id = 'pulse-single-file-styles';
    s.textContent = '.journey-step.is-current b{color:#fff!important}.pulse-local-note{display:grid;gap:3px;margin:10px 0;padding:10px 12px;border:1px solid #d6e4ff;border-radius:10px;background:#f5f8ff;color:#344054;font-size:12px}.pulse-local-note strong{color:#315efb;font-size:10px;letter-spacing:.06em}.pulse-local-file{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eef0f4}.pulse-local-file small{display:block;color:#667085;margin-top:3px}.pulse-local-clear{margin-top:10px}.pulse-local-file .secondary,.pulse-local-clear{cursor:pointer}.pulse-source-local{display:inline-flex!important;align-items:center;gap:5px;padding:3px 7px;border-radius:999px;background:#315efb!important;color:#fff!important;font-weight:900;text-decoration:none!important}.pulse-progressive{display:none}.pulse-category-picker.is-hidden{display:none!important}@media(max-width:800px){.pulse-local-file{align-items:flex-start}.pulse-local-file .secondary{white-space:nowrap}.pulse-category-context{font-size:11px}}';
    document.head.appendChild(s);
  }
  function updateCategoryOptions() {
    var select = q('#pulse-category-select'); if (!select) return;
    var counts = {}, source = Array.isArray(window.PULSE_EVIDENCE) ? window.PULSE_EVIDENCE : [];
    source.forEach(function (item) { var c = item.category || item.cat || item.pulseCategory; if (c) { c = c === 'saude-bem-estar' ? 'saude' : c; counts[c] = (counts[c] || 0) + 1; } });
    qa('[data-evidence-id]').forEach(function (card) { var c = card.dataset.pulseCategory || card.dataset.category; if (c) counts[c] = (counts[c] || 0) + 1; });
    var preferred = ['chocolates','bebidas','saude','geral'];
    var keys = preferred.filter(function (k) { return (counts[k] || 0) > 0; });
    var current = select.value || 'all';
    var next = ['all'].concat(keys);
    if (Array.prototype.map.call(select.options, function (o) { return o.value; }).join('|') !== next.join('|')) {
      select.innerHTML = '<option value="all">Todas as categorias</option>' + keys.map(function (k) { var n = counts[k] || 0; return '<option value="' + k + '">' + labels[k] + (n <= 2 ? ' (' + n + ')' : '') + '</option>'; }).join('');
    }
    if (keys.indexOf(current) >= 0 || current === 'all') select.value = current; else select.value = 'all';
  }
  function categoryVisibility() {
    var hash = location.hash || '#overview', picker = q('.pulse-category-picker') || (q('#pulse-category-select') ? q('#pulse-category-select').parentElement : null);
    if (picker) picker.classList.toggle('is-hidden', hash === '#overview');
  }
  function progressiveReveal() {
    qa('.screen').forEach(function (screen) {
      var blocks = qa('.box,.chart-box,.row,.chain,.nearby,.history', screen);
      if (blocks.length > 9) blocks.slice(9).forEach(function (b) { b.classList.add('pulse-progressive'); });
    });
  }
  function smoothAnswerScroll() {
    var hash = location.hash || ''; if (hash.indexOf('#answer-') !== 0) return;
    setTimeout(function () { var target = q(hash) || q('#investigate'); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }
  function fixPrimaryJourneyCTA() {
    qa('a[href="#diagnostic"],button[data-target="#diagnostic"]').forEach(function (el) { var text = norm(el.textContent); if (text.indexOf('entender o movimento') >= 0) { if (el.tagName === 'A') el.setAttribute('href', '#signals'); else el.dataset.target = '#signals'; } });
  }
  function enrichEvidenceSearch() {
    function tokens(text) { return norm(text).split(' ').filter(function (x) { return x.length >= 3; }); }
    function score(question, item) {
      var qTokens = tokens(question), hay = norm([item.id, item.fato, item.contexto, item.interpretacao, item.title, item.text, (item.keywords || []).join(' ')].join(' '));
      var score = 0; qTokens.forEach(function (t) { if (hay.indexOf(t) >= 0) score += t.length >= 6 ? 2 : 1; }); return score;
    }
    window.pulseRankEvidence = function (question) {
      var all = (Array.isArray(window.PULSE_EVIDENCE) ? window.PULSE_EVIDENCE.map(function (x) { return { item: x, local: false }; }) : []).concat((Array.isArray(window.PULSE_LOCAL_EVIDENCE) ? window.PULSE_LOCAL_EVIDENCE.map(function (x) { return { item: { id: 'local-' + x.id, fato: x.summary.excerpt, contexto: x.summary.excerpt, interpretacao: '', keywords: x.summary.topics, sourceName: x.name, fonte: x.name, periodo: 'Base local', provenance: x.provenance, localStudy: true, title: x.name, text: x.summary.excerpt }, local: true }; }) : []));
      return all.map(function (x) { return { item: x.item, local: x.local, score: score(question, x.item) }; }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    };
    window.pulseMatchEvidence = function (question) { var ranked = window.pulseRankEvidence(question); return ranked.length ? ranked[0].item : null; };
    window.PULSE_SEARCH_EVIDENCE = function (question) { return window.pulseRankEvidence(question); };
  }
  function installSuggestionHandler() {
    var suggestions = qa('.pulse-suggestion'), input = q('#pulse-question'), submit = q('#pulse-ask-submit');
    if (!suggestions.length || !input || !submit) return;
    suggestions.forEach(function (a) {
      var clone = a.cloneNode(true); a.parentNode.replaceChild(clone, a);
      clone.addEventListener('click', function (e) { e.preventDefault(); qa('.pulse-suggestion').forEach(function (s) { s.classList.remove('selected'); }); clone.classList.add('selected'); input.value = clone.dataset.question || ''; input.focus(); submit.setAttribute('href', clone.dataset.target || '#answer-custom'); });
    });
  }
  function init() {
    injectStyles(); updateCategoryOptions(); categoryVisibility(); progressiveReveal(); fixPrimaryJourneyCTA(); enrichEvidenceSearch(); installSuggestionHandler(); smoothAnswerScroll();
    window.addEventListener('hashchange', function () { categoryVisibility(); fixPrimaryJourneyCTA(); smoothAnswerScroll(); });
    document.addEventListener('pulse:category-change', updateCategoryOptions);
    window.PULSE_SINGLE_FILE_READY = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();