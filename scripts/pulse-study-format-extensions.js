/* Shopplosion Pulse — study format extensions v1
 * Keeps study upload local and single-file compatible.
 * Adds real PPTX text extraction without third-party runtime dependencies.
 * Images are retained as visual evidence with metadata; OCR is intentionally not claimed
 * unless a browser OCR engine is available.
 */
(() => {
  'use strict';
  const DB = 'shopplosion-pulse-studies';
  const STORE = 'studies';
  const MAX_CHARS = 18000;
  const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
  const isPptx = file => /\.pptx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const isImage = file => IMAGE_TYPES.has((file.type || '').toLowerCase()) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  const normalize = s => String(s || '').replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hash = async text => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const openDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const put = async item => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  };
  const getAll = async () => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  };
  const clearPanelRefresh = () => {
    window.PULSE_STUDIES?.length;
    window.PULSE_STUDY_REFRESH?.();
    window.dispatchEvent(new CustomEvent('pulse:studies-updated'));
  };
  const decodeUtf8 = bytes => new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const u16 = (v, o) => v.getUint16(o, true);
  const u32 = (v, o) => v.getUint32(o, true);
  async function unzipPptx(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), files = [];
    const sig = 0x04034b50;
    for (let o = 0; o + 30 <= bytes.length;) {
      if (u32(view, o) !== sig) { o++; continue; }
      const method = u16(view, o + 8), compSize = u32(view, o + 18), nameLen = u16(view, o + 26), extraLen = u16(view, o + 28);
      const name = decodeUtf8(bytes.subarray(o + 30, o + 30 + nameLen));
      const start = o + 30 + nameLen + extraLen, end = start + compSize;
      if (end > bytes.length) break;
      files.push({ name, method, data: bytes.slice(start, end) });
      o = end;
    }
    const out = new Map();
    for (const f of files) {
      if (f.method === 0) out.set(f.name, f.data);
      else if (f.method === 8 && 'DecompressionStream' in window) {
        const ds = new DecompressionStream('deflate-raw');
        const stream = new Blob([f.data]).stream().pipeThrough(ds);
        out.set(f.name, new Uint8Array(await new Response(stream).arrayBuffer()));
      }
    }
    return out;
  }
  const xmlText = bytes => decodeUtf8(bytes).replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi, (_, t) => ` ${t.replace(/<[^>]+>/g, ' ')} `).replace(/<[^>]+>/g, ' '));
  const extractPptx = async file => {
    const zip = await unzipPptx(await file.arrayBuffer());
    const slides = [...zip.keys()].filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n)).sort((a,b) => {
      const na = +(a.match(/slide(\d+)/i)?.[1] || 0), nb = +(b.match(/slide(\d+)/i)?.[1] || 0); return na - nb;
    });
    const chunks = slides.map((name, i) => `Slide ${i + 1}: ${normalize(xmlText(zip.get(name)))}`).filter(Boolean);
    return normalize(chunks.join('\n'));
  };
  const imageDescriptor = async file => {
    const buffer = await file.arrayBuffer();
    const digest = await hash(new TextDecoder('latin1').decode(new Uint8Array(buffer).slice(0, Math.min(buffer.byteLength, 65536))));
    let dimensions = '';
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      dimensions = `${img.naturalWidth}×${img.naturalHeight}`;
      URL.revokeObjectURL(url);
    } catch (_) {}
    return `Imagem fornecida pelo usuário. Dimensões: ${dimensions || 'não identificadas'}. Evidência visual armazenada localmente; OCR não executado neste ambiente. Fingerprint: ${digest}`;
  };
  const makeStudy = async (file, text, extractionMethod, evidenceType) => {
    const clean = normalize(text).slice(0, MAX_CHARS);
    const id = await hash([file.name, file.size, clean].join('|'));
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 35).slice(0, 8);
    const summary = {
      excerpt: clean,
      sentences,
      keywords: [],
      topics: [],
      claims: sentences.map((text, i) => ({ id: `claim-${i + 1}`, text, topics: [], polarity: 'neutral', type: 'observed-text', support: evidenceType })),
      chars: clean.length,
      extraction: extractionMethod
    };
    return { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, lastModified: file.lastModified, summary, processedAt: new Date().toISOString(), provenance: { sourceName: file.name, extractionMethod, evidenceType, confidence: extractionMethod === 'pptx-text' ? 'descriptive' : 'visual-reference' } };
  };
  const renderNotice = (file, method) => {
    const host = document.querySelector('#pulse-study-intelligence');
    if (!host) return;
    const msg = method === 'pptx-text'
      ? `PPTX processado localmente: texto das lâminas foi extraído sem envio externo.`
      : `Imagem processada como evidência visual local. OCR não está disponível neste runtime; nenhum texto foi inventado.`;
    const node = document.createElement('div');
    node.style.cssText = 'margin-top:8px;padding:8px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;';
    node.innerHTML = `<b>${esc(file.name)}</b> — ${esc(msg)}`;
    host.appendChild(node);
  };
  const processSpecial = async file => {
    const pptx = isPptx(file), image = isImage(file);
    if (!pptx && !image) return false;
    try {
      const text = pptx ? await extractPptx(file) : await imageDescriptor(file);
      const study = await makeStudy(file, text, pptx ? 'pptx-text' : 'visual-reference', pptx ? 'user-provided-study' : 'user-provided-image');
      await put(study);
      const all = await getAll();
      window.PULSE_STUDIES = all;
      window.PULSE_ACTIVE_STUDY_CONTEXT = typeof window.PULSE_STUDY_CONTEXT === 'function' ? window.PULSE_STUDY_CONTEXT() : '';
      renderNotice(file, pptx ? 'pptx-text' : 'visual-reference');
      clearPanelRefresh();
      return true;
    } catch (err) {
      console.error('[Pulse Study Formats] processamento falhou', err);
      return false;
    }
  };
  window.addEventListener('change', async e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.id !== 'pulse-files' || !input.files?.length) return;
    const special = [...input.files].filter(f => isPptx(f) || isImage(f));
    if (!special.length) return;
    // Run before the document-level study listener so unsupported binary formats are not misread as text.
    e.stopImmediatePropagation();
    e.preventDefault();
    for (const file of special) await processSpecial(file);
  }, true);
  window.PULSE_STUDY_FORMATS = { pptx: true, imageVisualReference: true, ocr: false };
})();
