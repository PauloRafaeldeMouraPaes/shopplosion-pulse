/* Shopplosion Pulse — study intelligence layer
 * Client-side, privacy-first processing: files remain in the browser and are persisted in IndexedDB.
 */
(() => {
  'use strict';
  const DB = 'shopplosion-pulse-studies';
  const STORE = 'studies';
  const MAX_CHARS = 12000;
  const state = { studies: [], ready: false };

  const openDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const s = t.objectStore(STORE);
      let result;
      try { result = fn(s); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
    });
  };
  const put = item => tx('readwrite', s => s.put(item));
  const removeAll = () => tx('readwrite', s => s.clear());
  const all = () => new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    } catch (e) { reject(e); }
  });

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = s => String(s || '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
  const hash = async text => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const csvToText = text => {
    const rows = text.split(/\r?\n/).filter(Boolean).slice(0, 200);
    return rows.map(r => r.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(x => x.replace(/^\"|\"$/g, '').replace(/\"\"/g, '\"')).join(' | ')).join('\n');
  };
  const pdfText = bytes => {
    const raw = new TextDecoder('latin1').decode(bytes);
    const strings = [];
    const re = /\((?:\\.|[^()\\])*\)/g;
    for (const m of raw.matchAll(re)) {
      const v = m[0].slice(1, -1).replace(/\\([\\()])/g, '$1').replace(/\\[nrt]/g, ' ');
      if (/[A-Za-zÀ-ÿ]{3,}/.test(v)) strings.push(v);
    }
    return strings.join(' ');
  };
  const extract = async file => {
    const type = (file.type || '').toLowerCase();
    if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) return pdfText(await file.arrayBuffer());
    const raw = await file.text();
    if (type.includes('json') || /\.json$/i.test(file.name)) {
      try { return JSON.stringify(JSON.parse(raw), null, 2); } catch (_) { return raw; }
    }
    if (type.includes('csv') || /\.(csv|tsv)$/i.test(file.name)) return csvToText(raw);
    return raw;
  };
  const summarize = text => {
    const clean = normalize(text).slice(0, MAX_CHARS);
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 40).slice(0, 8);
    const keywords = [...new Set((clean.toLowerCase().match(/[a-zà-ÿ]{5,}/g) || []))]
      .filter(w => !/^(sobre|entre|todos|todas|foram|pelos|pelas|that|which|their|there|these|those)$/.test(w))
      .slice(0, 25);
    return { excerpt: clean, sentences, keywords };
  };
  const fingerprint = async (name, size, lastModified, text) => hash([name, size, lastModified, text].join('|'));

  const ensurePanel = () => {
    let panel = document.querySelector('#pulse-study-intelligence');
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.id = 'pulse-study-intelligence';
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;font:13px/1.45 system-ui,sans-serif;';
    const target = document.querySelector('#file-list') || document.querySelector('#pulse-files')?.parentElement;
    if (target?.parentElement) target.parentElement.insertBefore(panel, target.nextSibling);
    else document.body.appendChild(panel);
    return panel;
  };
  const render = () => {
    const panel = ensurePanel();
    const n = state.studies.length;
    panel.innerHTML = `<strong>Inteligência dos estudos</strong><div style="margin-top:4px">${n ? `${n} estudo(s) processado(s) localmente e disponível(is) para o Ask AI.` : 'Nenhum estudo processado. As perguntas usam apenas a base padrão do Pulse.'}</div>` +
      (n ? `<ul style="margin:8px 0 0;padding-left:18px">${state.studies.map(s => `<li><b>${esc(s.name)}</b> — ${esc(s.summary.sentences[0] || s.summary.excerpt.slice(0, 180) || 'conteúdo extraído')}</li>`).join('')}</ul>` : '');
  };
  const load = async () => { state.studies = await all(); state.ready = true; render(); window.PULSE_STUDIES = state.studies; };

  const processFiles = async files => {
    for (const file of files) {
      const text = await extract(file);
      const summary = summarize(text);
      const id = await fingerprint(file.name, file.size, file.lastModified, text);
      await put({ id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, summary, processedAt: new Date().toISOString() });
    }
    await load();
  };

  const studyContext = () => state.studies.map((s, i) => `ESTUDO ${i + 1}: ${s.name}\nEvidência extraída: ${s.summary.excerpt}\nSinais/termos recorrentes: ${s.summary.keywords.join(', ')}`).join('\n\n').slice(0, 30000);
  const augmentAsk = () => {
    if (!state.studies.length) return;
    const fields = [...document.querySelectorAll('textarea,input[type="text"]')].filter(el => el.offsetParent !== null);
    const field = fields.sort((a, b) => (b.value || '').length - (a.value || '').length)[0];
    if (!field || !field.value.trim() || field.dataset.pulseStudyAugmented === '1') return;
    const original = field.value.trim();
    field.value = `${original}\n\n[CONTEXTO DOS ESTUDOS ANEXADOS — use somente como evidência adicional, diferencie fato de inferência]\n${studyContext()}`;
    field.dataset.pulseStudyAugmented = '1';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };

  document.addEventListener('change', async e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'pulse-files') return;
    if (!input.files?.length) { await removeAll(); await load(); return; }
    try { await processFiles([...input.files]); }
    catch (err) { console.error('[Pulse Studies] processamento falhou', err); }
  }, true);
  document.addEventListener('click', e => {
    const el = e.target.closest('button,[role="button"],input[type="submit"]');
    if (!el) return;
    const label = normalize(el.textContent || el.value || '').toLowerCase();
    if (/(ask ai|perguntar|pergunta|investigar|analisar|ask)/i.test(label)) augmentAsk();
  }, true);
  window.PULSE_STUDY_CONTEXT = studyContext;
  window.PULSE_CLEAR_STUDIES = async () => { await removeAll(); await load(); };
  load().catch(err => console.error('[Pulse Studies] inicialização falhou', err));
})();
