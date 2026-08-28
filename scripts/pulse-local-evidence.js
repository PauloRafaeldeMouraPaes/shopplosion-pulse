/* Shopplosion Pulse — browser-local study evidence manager
 * Privacy-first: local studies stay in this browser/device and are never sent to a server.
 */
(function () {
  'use strict';
  var DB_NAME = 'shopplosion-pulse-local-evidence';
  var STORE = 'files';
  var VERSION = 1;
  var state = { items: [] };
  var el = function (s, r) { return (r || document).querySelector(s); };
  var els = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var norm = function (v) { return String(v || '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim(); };
  var esc = function (v) { return norm(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('IndexedDB indisponível neste navegador.'));
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Falha ao abrir a base local.')); };
    });
  }
  function all() { return openDb().then(function (db) { return new Promise(function (resolve, reject) { var r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll(); r.onsuccess = function () { resolve(r.result || []); }; r.onerror = function () { reject(r.error); }; }); }); }
  function put(item) { return openDb().then(function (db) { return new Promise(function (resolve, reject) { var r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(item); r.onsuccess = function () { resolve(item); }; r.onerror = function () { reject(r.error); }; }); }); }
  function del(id) { return openDb().then(function (db) { return new Promise(function (resolve, reject) { var r = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); r.onsuccess = resolve; r.onerror = function () { reject(r.error); }; }); }); }
  function clear() { return openDb().then(function (db) { return new Promise(function (resolve, reject) { var r = db.transaction(STORE, 'readwrite').objectStore(STORE).clear(); r.onsuccess = resolve; r.onerror = function () { reject(r.error); }; }); }); }
  function digest(text) { if (window.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); return Promise.resolve(String(text).length + '-' + String(text).slice(0, 64)); }
  function csvToText(text) { return text.split(/\r?\n/).filter(Boolean).slice(0, 800).map(function (row) { return row.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(function (x) { return x.replace(/^\"|\"$/g, '').replace(/\"\"/g, '\"'); }).join(' | '); }).join('\n'); }
  function extractPdfWithPdfJs(file) {
    return new Promise(function (resolve, reject) {
      if (!window.pdfjsLib) return reject(new Error('PDF.js não carregado.'));
      var reader = new FileReader();
      reader.onload = function () { var data = new Uint8Array(reader.result); window.pdfjsLib.getDocument({ data: data }).promise.then(function (pdf) { var pages = []; var p = Promise.resolve(); for (var i = 1; i <= pdf.numPages; i++) (function (n) { p = p.then(function () { return pdf.getPage(n).then(function (page) { return page.getTextContent().then(function (c) { pages.push(c.items.map(function (x) { return x.str; }).join(' ')); }); }); }); })(i); p.then(function () { resolve(pages.join('\n')); }).catch(reject); }).catch(reject); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }
  function extractSheet(file) {
    return new Promise(function (resolve, reject) {
      if (!window.XLSX) return reject(new Error('SheetJS não carregado.'));
      var reader = new FileReader();
      reader.onload = function () { try { var wb = window.XLSX.read(reader.result, { type: 'array' }); resolve(wb.SheetNames.map(function (name) { var ws = wb.Sheets[name]; return 'ABA: ' + name + '\n' + window.XLSX.utils.sheet_to_csv(ws); }).join('\n\n')); } catch (e) { reject(e); } };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }
  function extract(file) {
    var name = file.name || '', type = (file.type || '').toLowerCase();
    if (/\.pdf$/i.test(name) || type === 'application/pdf') return extractPdfWithPdfJs(file).then(function (text) { return { text: text, method: 'pdf.js' }; });
    if (/\.(xlsx|xls)$/i.test(name) || /spreadsheet|excel/.test(type)) return extractSheet(file).then(function (text) { return { text: text, method: 'SheetJS' }; });
    if (/\.(csv|tsv)$/i.test(name) || /csv|tab-separated/.test(type)) return file.text().then(function (text) { return { text: csvToText(text), method: 'FileReader/CSV' }; });
    if (/\.txt$/i.test(name) || type.indexOf('text/') === 0) return file.text().then(function (text) { return { text: text, method: 'FileReader/TXT' }; });
    return Promise.resolve({ text: '', method: 'reference-only' });
  }
  function summarize(text) {
    var clean = norm(text).slice(0, 24000), sentences = clean.split(/(?<=[.!?])\s+/).filter(function (s) { return s.length > 35; }).slice(0, 8), low = clean.toLowerCase();
    var topics = [];
    [['preço',/preço|preco|desconto|promoção|promocao/],['saudabilidade',/saúde|saude|saudável|saudavel|zero açúcar|glp-1/],['canal',/canal|varejo|atacarejo|supermercado|e-commerce|foodservice/],['shopper',/shopper|consumidor|comprador|jornada|compra/],['marca',/marca|brand|concorr/],['produto',/produto|categoria|sortimento|embalagem/],['premium',/premium|premiumização|premiumizacao/],['ocasião',/ocasião|ocasiao|momento de consumo/]].forEach(function (pair) { if (pair[1].test(low)) topics.push(pair[0]); });
    return { excerpt: clean, sentences: sentences, topics: topics, chars: clean.length };
  }
  function ensureEvidenceApi() {
    window.PULSE_LOCAL_EVIDENCE = state.items;
    window.PULSE_LOCAL_EVIDENCE_STATS = function () { return { count: state.items.length, characters: state.items.reduce(function (n, x) { return n + (x.summary ? x.summary.chars : 0); }, 0) }; };
    window.PULSE_LOCAL_EVIDENCE_CONTEXT = function () { return state.items.map(function (x, i) { return 'EVIDÊNCIA LOCAL ' + (i + 1) + '\nArquivo: ' + x.name + '\nMétodo: ' + x.method + '\nTipo: estudo fornecido pelo usuário\nConfiança: descritiva\nTópicos: ' + (x.summary.topics.join(', ') || 'não identificados') + '\nTrecho:\n' + x.summary.excerpt; }).join('\n\n').slice(0, 50000); };
  }
  function render() {
    ensureEvidenceApi();
    var list = el('#file-list'); if (!list) return;
    var local = el('#pulse-local-evidence-note');
    if (!local) { local = document.createElement('div'); local.id = 'pulse-local-evidence-note'; local.className = 'pulse-local-note'; list.parentNode.insertBefore(local, list); }
    local.innerHTML = '<strong>SUA BASE LOCAL</strong><span>Estes estudos ficam salvos apenas neste navegador — não são compartilhados com outros usuários.</span>';
    var html = state.items.length ? state.items.map(function (x) { return '<article class="pulse-local-file"><div><strong>' + esc(x.name) + '</strong><small>' + esc(x.method) + ' · ' + x.summary.chars + ' caracteres · ' + esc(x.summary.topics.join(', ') || 'tópicos não identificados') + '</small></div><button type="button" class="secondary" data-pulse-local-remove="' + esc(x.id) + '">Remover</button></article>'; }).join('') : '<span class="file-list-empty">Nenhum estudo local adicionado.</span>';
    list.innerHTML = html + '<button type="button" class="secondary pulse-local-clear" id="pulse-local-clear">Limpar toda a base local</button>';
    var clearBtn = el('#pulse-local-clear'); if (clearBtn) clearBtn.addEventListener('click', function () { clear().then(load); });
    els('[data-pulse-local-remove]').forEach(function (btn) { btn.addEventListener('click', function () { del(btn.dataset.pulseLocalRemove).then(load); }); });
  }
  function load() { return all().then(function (items) { state.items = items; render(); }); }
  function ingest(files) {
    return Array.prototype.reduce.call(files, function (chain, file) { return chain.then(function () { return extract(file).then(function (result) { if (!result.text && result.method === 'reference-only') return digest(file.name + '|' + file.size).then(function (id) { return put({ id: id, name: file.name, type: file.type || '', size: file.size, method: result.method, summary: { excerpt: 'Referência adicionada sem extração nesta fase.', sentences: [], topics: [], chars: 0 }, provenance: { sourceName: file.name, evidenceType: 'user-provided-study', extractionMethod: result.method, confidence: 'descriptive' }, processedAt: new Date().toISOString() }); }); var summary = summarize(result.text); return digest(file.name + '|' + file.size + '|' + result.text).then(function (id) { return put({ id: id, name: file.name, type: file.type || '', size: file.size, method: result.method, summary: summary, provenance: { sourceName: file.name, evidenceType: 'user-provided-study', extractionMethod: result.method, confidence: 'descriptive' }, processedAt: new Date().toISOString() }); }); }); }); }, Promise.resolve()).then(load);
  }
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'pulse-files' && e.target.files && e.target.files.length) ingest(e.target.files).catch(function (err) { console.error('[Pulse Local Evidence]', err); alert('Não foi possível processar este arquivo. ' + (err.message || 'Verifique o formato.')); }); }, true);
  window.PULSE_LOCAL_INGEST = ingest;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();