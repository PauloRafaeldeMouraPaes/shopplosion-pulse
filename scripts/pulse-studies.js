/* Shopplosion Pulse — study intelligence v3
 * Client-side, privacy-first processing. Files stay in the browser.
 * Produces provenance-rich, claim-oriented evidence blocks for Ask AI.
 */
(() => {
  'use strict';
  const DB = 'shopplosion-pulse-studies';
  const STORE = 'studies';
  const MAX_CHARS = 18000;
  const state = { studies: [], ready: false };

  const openDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
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
  const csvToText = text => text.split(/\r?\n/).filter(Boolean).slice(0, 400)
    .map(r => r.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(x => x.replace(/^\"|\"$/g, '').replace(/\"\"/g, '\"')).join(' | ')).join('\n');
  const pdfText = bytes => {
    const raw = new TextDecoder('latin1').decode(bytes), strings = [], re = /\((?:\\.|[^()\\])*\)/g;
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
  const STOP = new Set('sobre entre todos todas foram pelos pelas para como mais muito muito esta este esse essa seus suas uma umas dos das que com sem por nos nas pelos pela from that which their there these those and the with this have has para porque quando onde sobre também ainda sendo foram eram'.split(' '));
  const topicRules = [
    ['preço', /preço|preco|promoção|promocao|desconto|barato|caro/],
    ['canal', /canal|varejo|atacarejo|supermercado|e-commerce|ecommerce/],
    ['shopper', /shopper|consumidor|compra|comprador|jornada/],
    ['marca', /marca|brand|concorr/],
    ['produto', /produto|categoria|sortimento|embalagem/]
  ];
  const detectTopics = clean => topicRules.filter(([,re]) => re.test(clean.toLowerCase())).map(([x]) => x);
  const claimPolarity = sentence => {
    const s = sentence.toLowerCase();
    if (/(não|nao|menor|queda|caiu|cai|reduz|redução|reducao|fraco|negativo|não valoriz|nao valoriz|não influencia|nao influencia)/.test(s)) return 'negative';
    if (/(aument|cresce|cresceu|crescimento|maior|forte|positivo|valoriza|valorizam|influencia|preferem|preferência|preferencia)/.test(s)) return 'positive';
    return 'neutral';
  };
  const extractClaims = (sentences, topics) => sentences.slice(0, 8).map((text, index) => ({
    id: `claim-${index + 1}`,
    text,
    topics: topics.filter(topic => topicRules.find(([name]) => name === topic)?.[1].test(text.toLowerCase())),
    polarity: claimPolarity(text),
    type: 'observed-text',
    support: 'user-provided-study'
  }));
  const summarize = text => {
    const clean = normalize(text).slice(0, MAX_CHARS);
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 35).slice(0, 10);
    const words = (clean.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).filter(w => !STOP.has(w));
    const counts = new Map();
    for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
    const keywords = [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 30).map(([w]) => w);
    const topics = detectTopics(clean);
    return { excerpt: clean, sentences, keywords, topics, claims: extractClaims(sentences, topics), chars: clean.length, extraction: clean ? 'textual' : 'empty' };
  };
  const fingerprint = async (name, size, lastModified, text) => hash([name, size, lastModified, text].join('|'));

  const findContradictions = () => {
    const claims = state.studies.flatMap(s => (s.summary?.claims || []).map(c => ({ ...c, source: s.name })));
    const pairs = [];
    for (let i = 0; i < claims.length; i++) for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.source === b.source || a.polarity === 'neutral' || b.polarity === 'neutral' || a.polarity === b.polarity) continue;
      const shared = (a.topics || []).filter(t => (b.topics || []).includes(t));
      if (shared.length) pairs.push({ topic: shared[0], left: a, right: b, type: 'potential-contradiction' });
    }
    return pairs.slice(0, 12);
  };

  const ensurePanel = () => {
    let panel = document.querySelector('#pulse-study-intelligence');
    if (panel) return panel;
    panel = document.createElement('aside'); panel.id = 'pulse-study-intelligence'; panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;font:13px/1.45 system-ui,sans-serif;';
    const target = document.querySelector('#file-list') || document.querySelector('#pulse-files')?.parentElement;
    if (target?.parentElement) target.parentElement.insertBefore(panel, target.nextSibling); else document.body.appendChild(panel);
    return panel;
  };
  const render = () => {
    const panel = ensurePanel(), n = state.studies.length, contradictions = findContradictions();
    panel.innerHTML = `<strong>Inteligência dos estudos</strong><div style="margin-top:4px">${n ? `${n} estudo(s) processado(s) localmente e disponível(is) para o Ask AI.` : 'Nenhum estudo processado. As perguntas usam apenas a base padrão do Pulse.'}</div>` +
      (n ? `<ul style="margin:8px 0 0;padding-left:18px">${state.studies.map(s => `<li><b>${esc(s.name)}</b> — ${esc(s.summary.sentences[0] || s.summary.excerpt.slice(0, 180) || 'conteúdo extraído')}<br><small>Tópicos: ${esc((s.summary.topics || []).join(', ') || 'não identificados')} · ${s.summary.claims?.length || 0} achados estruturados · ${s.summary.chars} caracteres</small></li>`).join('')}</ul>` : '') +
      (contradictions.length ? `<div style="margin-top:10px"><b>Possíveis divergências entre estudos</b><ul style="margin:6px 0 0;padding-left:18px">${contradictions.map(c => `<li><small><b>${esc(c.topic)}</b>: ${esc(c.left.source)} ↔ ${esc(c.right.source)} — requer revisão humana.</small></li>`).join('')}</ul></div>` : '');
  };
  const load = async () => { state.studies = await all(); state.ready = true; render(); window.PULSE_STUDIES = state.studies; };

  const processFiles = async files => {
    const existing = new Set(state.studies.map(s => s.id));
    for (const file of files) {
      const text = await extract(file), summary = summarize(text);
      if (!summary.excerpt) continue;
      const id = await fingerprint(file.name, file.size, file.lastModified, text);
      if (existing.has(id)) continue;
      await put({ id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, lastModified: file.lastModified, summary, processedAt: new Date().toISOString(), provenance: { sourceName: file.name, extractionMethod: summary.extraction, evidenceType: 'user-provided-study', confidence: 'descriptive' } });
      existing.add(id);
    }
    await load();
  };

  const studyContext = () => state.studies.map((s, i) => {
    const topic = (s.summary.topics || []).join(', ') || 'não identificado';
    const claims = (s.summary.claims || []).map(c => `- ${c.text} [${c.polarity}; ${(c.topics || []).join(', ') || 'sem tópico'}]`).join('\n');
    return `EVIDÊNCIA ${i + 1}\nFonte: ${s.name}\nTipo: estudo fornecido pelo usuário\nExtração: ${s.provenance?.extractionMethod || 'textual'}\nConfiança: descritiva (não implica validade estatística)\nTópicos detectados: ${topic}\nAchados estruturados:\n${claims || '- nenhum achado estruturado'}\nTrecho extraído:\n${s.summary.excerpt}`;
  }).join('\n\n').slice(0, 40000);

  const getAskField = () => [...document.querySelectorAll('textarea,input[type="text"]')].filter(el => el.offsetParent !== null)
    .sort((a,b) => (b.value || '').length - (a.value || '').length)[0];
  const augmentAsk = () => {
    if (!state.studies.length) return;
    const field = getAskField();
    if (!field || !field.value.trim()) return;
    field.dataset.pulseStudyContext = studyContext();
    field.dispatchEvent(new Event('input', { bubbles: true }));
    window.PULSE_ACTIVE_STUDY_CONTEXT = studyContext();
  };

  document.addEventListener('change', async e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'pulse-files') return;
    if (!input.files?.length) { await removeAll(); await load(); window.PULSE_ACTIVE_STUDY_CONTEXT = ''; return; }
    try { await processFiles([...input.files]); } catch (err) { console.error('[Pulse Studies] processamento falhou', err); }
  }, true);
  document.addEventListener('click', e => {
    const el = e.target.closest('button,[role="button"],input[type="submit"]');
    if (!el) return;
    const label = normalize(el.textContent || el.value || '').toLowerCase();
    if (/(ask ai|perguntar|pergunta|investigar|analisar|ask)/i.test(label)) augmentAsk();
  }, true);
  window.PULSE_STUDY_CONTEXT = studyContext;
  window.PULSE_STUDY_CLAIMS = () => state.studies.flatMap(s => (s.summary?.claims || []).map(c => ({ ...c, source: s.name })));
  window.PULSE_STUDY_CONTRADICTIONS = findContradictions;
  window.PULSE_CLEAR_STUDIES = async () => { await removeAll(); await load(); window.PULSE_ACTIVE_STUDY_CONTEXT = ''; };
  window.PULSE_STUDY_STATS = () => ({ count: state.studies.length, characters: state.studies.reduce((n,s) => n + (s.summary?.chars || 0), 0), claims: state.studies.reduce((n,s) => n + (s.summary?.claims?.length || 0), 0), topics: [...new Set(state.studies.flatMap(s => s.summary?.topics || []))], contradictions: findContradictions().length });
  load().catch(err => console.error('[Pulse Studies] inicialização falhou', err));
})();
