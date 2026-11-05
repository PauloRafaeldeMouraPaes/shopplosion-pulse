const { test, expect } = require('@playwright/test');

/* The Supabase SDK is loaded from jsDelivr with a pinned version, explicit file path and Subresource
   Integrity. If the served bytes ever differ from the recorded hash the browser refuses to execute the
   script, so this test proves, with real network access to the CDN, that every page still gets a
   working client. It needs outbound HTTPS to cdn.jsdelivr.net; when the CDN is unreachable the test
   reports that instead of claiming the integrity check passed. */
const pages = ['/auth.html', '/index.html', '/app.html', '/ask.html', '/sources.html', '/intelligence.html', '/documento.html'];
/* dist/umd/supabase.js is the file shipped inside the npm tarball (already minified; SHA-256 84ee9bf4...). The
   .min.js path on jsDelivr is generated on demand with a banner that says "Do NOT use SRI with dynamically
   generated files", so it must never be the integrity-checked target. */
const expectedSrc = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js';
const expectedIntegrity = 'sha384-iLddHTLokph6Omwoyid4XKxHaWa6w41BnoEj0q5oOrzmYPpHIKt1wyjReA7s//pP';

test.describe('Supabase SDK pin and Subresource Integrity', () => {
  for (const path of pages) {
    test(path + ': pinned SDK tag carries integrity and loads a working client', async ({ page }) => {
      const failed = [];
      // ask.html and intelligence.html replace their own URL on load to add the cache-busting ?v= query; the
      // request in flight is aborted (net::ERR_ABORTED) and re-issued. That is navigation, not an integrity failure.
      page.on('requestfailed', r => { const why = r.failure() && r.failure().errorText; if (/supabase-js/.test(r.url()) && why !== 'net::ERR_ABORTED') failed.push(r.url() + ' ' + why); });
      const consoleErrors = [];
      page.on('console', m => { if (m.type() === 'error' && /integrity|supabase-js/i.test(m.text())) consoleErrors.push(m.text()); });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const tag = await page.evaluate(() => {
        const s = [...document.querySelectorAll('script[src*="supabase-js"]')];
        return s.map(el => ({ src: el.getAttribute('src'), integrity: el.getAttribute('integrity'), crossorigin: el.getAttribute('crossorigin') }));
      });
      expect(tag, 'exactly one SDK tag per page').toHaveLength(1);
      expect(tag[0].src).toBe(expectedSrc);
      expect(tag[0].integrity).toBe(expectedIntegrity);
      expect(tag[0].crossorigin).toBe('anonymous');
      const sdkReachable = failed.length === 0 && !/ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION)/.test(failed.join(' '));
      test.skip(!sdkReachable && failed.some(f => /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(f)), 'CDN unreachable from this runner: integrity not verified here');
      await page.waitForFunction(() => window.supabase && typeof window.supabase.createClient === 'function', null, { timeout: 15000 });
      expect(consoleErrors, 'integrity or load errors in console').toEqual([]);
      expect(failed, 'failed SDK requests').toEqual([]);
    });
  }
});

/* app.html is the only page that loads pdf.js statically: version 4.10.38 (CVE-2024-4367 is fixed since 4.2.67) as an ES
   module from cdnjs with Subresource Integrity. The same bytes are published by the npm package pdfjs-dist@4.10.38
   (build/pdf.min.mjs, SHA-256 27fc2a05...), which is how the hash below was cross-checked. The module sets
   globalThis.pdfjsLib itself; a second inline module pins the worker. The worker file is fetched by pdf.js through
   GlobalWorkerOptions.workerSrc and a Worker cannot carry Subresource Integrity, so only the version pin is asserted
   for it (npm build/pdf.worker.min.mjs, SHA-256 1baa1844...).
   Without a session app.html replaces itself with auth.html as soon as the Supabase client answers, so the request
   for the Supabase SDK is aborted here: the page then stays on app.html ("Configuração do Supabase indisponível."),
   the integrity-checked module finishes loading and the page's own extractor (window.PULSE_EXTRACT_PDF_TEXT from
   pulse-config.js) is exercised on a small PDF built in this file, which proves the library, the worker and the
   extraction path together, with real network access to the CDN. */
const pdfjsSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const pdfjsIntegrity = 'sha384-+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7';
const pdfjsWorkerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
const pdfjsVersion = '4.10.38';

/* A one-page PDF (Helvetica, one text object) with a correct xref table, so no reconstruction is involved. */
function buildPdf(text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 18 Tf 20 50 Td (' + text.replace(/[()\\]/g, '\\$&') + ') Tj ET';
  objects[3] = '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream';
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(body, 'latin1')); body += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n'; });
  const xref = Buffer.byteLength(body, 'latin1');
  body += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  body += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(body, 'latin1');
}

test.describe('pdf.js pin and Subresource Integrity on app.html', () => {
  test('/app.html: the pdf.js module carries the recorded hash, the worker is pinned and the page extractor reads a PDF', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', r => { const why = r.failure() && r.failure().errorText; if (/pdf\.(min|worker\.min)\.mjs/.test(r.url()) && why !== 'net::ERR_ABORTED') failed.push(r.url() + ' ' + why); });
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error' && /integrity|pdf\.min\.mjs|pdf\.worker|pdfjs/i.test(m.text())) consoleErrors.push(m.text()); });
    await page.route(/supabase-js@/, route => route.abort('failed'));
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    const tags = await page.evaluate(() => {
      const mod = [...document.querySelectorAll('script[type="module"][src*="pdf.min"]')].map(el => ({ src: el.getAttribute('src'), integrity: el.getAttribute('integrity'), crossorigin: el.getAttribute('crossorigin') }));
      const legacy = [...document.querySelectorAll('script[src*="pdf.min.js"]')].length;
      return { mod, legacy };
    });
    expect(tags.mod, 'exactly one pdf.js module tag').toHaveLength(1);
    expect(tags.mod[0]).toEqual({ src: pdfjsSrc, integrity: pdfjsIntegrity, crossorigin: 'anonymous' });
    expect(tags.legacy, 'no classic pdf.min.js tag left').toBe(0);
    test.skip(failed.some(f => /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(f)), 'CDN unreachable from this runner: integrity not verified here');
    await page.waitForFunction(() => window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function', null, { timeout: 15000 });
    const lib = await page.evaluate(() => ({ version: window.pdfjsLib.version, workerSrc: window.pdfjsLib.GlobalWorkerOptions.workerSrc, extractor: typeof window.PULSE_EXTRACT_PDF_TEXT, meta: window.PULSE_PDF_TEXT_EXTRACTION || null }));
    expect(lib.version, 'library version').toBe(pdfjsVersion);
    expect(lib.workerSrc, 'worker pinned to the same pdf.js version').toBe(pdfjsWorkerSrc);
    expect(lib.extractor, 'page extractor present').toBe('function');
    expect(lib.meta && lib.meta.version, 'declared extraction version').toBe(pdfjsVersion);
    expect(await page.locator('#message').textContent(), 'page stayed on app.html without a Supabase client').toContain('Supabase');
    const pdfBytes = Array.from(buildPdf('Pulse PDF 2026'));
    const extracted = await page.evaluate(async bytes => {
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      return window.PULSE_EXTRACT_PDF_TEXT(blob);
    }, pdfBytes);
    expect(extracted, 'text read through pdf.js 4 and its worker').toContain('Pulse PDF 2026');
    expect(consoleErrors, 'integrity or load errors in console').toEqual([]);
    expect(failed, 'failed pdf.js requests').toEqual([]);
  });

  test('/app.html: an altered pdf.js payload is refused by the browser (integrity enforced, no library, no extraction)', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.route(/supabase-js@/, route => route.abort('failed'));
    await page.route(pdfjsSrc, async route => {
      const real = await route.fetch();
      const body = await real.text();
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }, body: body + '\n/* tampered */' });
    });
    await page.goto('/app.html', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const lib = await page.evaluate(() => typeof window.pdfjsLib);
    expect(lib, 'tampered module must not execute').toBe('undefined');
    expect(consoleErrors.some(t => /integrity/i.test(t)), 'the browser reports the integrity mismatch').toBe(true);
  });
});
