const { test, expect } = require('@playwright/test');

/* The Supabase SDK is loaded from jsDelivr with a pinned version, explicit file path and Subresource
   Integrity. If the served bytes ever differ from the recorded hash the browser refuses to execute the
   script, so this test proves, with real network access to the CDN, that every page still gets a
   working client. It needs outbound HTTPS to cdn.jsdelivr.net; when the CDN is unreachable the test
   reports that instead of claiming the integrity check passed. */
const pages = ['/auth.html', '/index.html', '/app.html', '/ask.html', '/sources.html', '/intelligence.html', '/documento.html'];
const expectedSrc = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js';

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
      expect(tag[0].integrity).toMatch(/^sha384-[A-Za-z0-9+/=]{64}$/);
      expect(tag[0].crossorigin).toBe('anonymous');
      const sdkReachable = failed.length === 0 && !/ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION)/.test(failed.join(' '));
      test.skip(!sdkReachable && failed.some(f => /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(f)), 'CDN unreachable from this runner: integrity not verified here');
      await page.waitForFunction(() => window.supabase && typeof window.supabase.createClient === 'function', null, { timeout: 15000 });
      expect(consoleErrors, 'integrity or load errors in console').toEqual([]);
      expect(failed, 'failed SDK requests').toEqual([]);
    });
  }
});

/* app.html is the only page that loads pdf.js statically (cdnjs, version 3.11.174). The same bytes are
   published by the npm package pdfjs-dist@3.11.174 (build/pdf.min.js), which is how the hash below was
   cross-checked. The worker file is fetched by pdf.js itself through GlobalWorkerOptions.workerSrc and a
   Worker cannot carry Subresource Integrity, so only the version pin is asserted for it.
   Without a session app.html replaces itself with auth.html right after its synchronous scripts run, so the
   observation is taken at DOMContentLoaded by an init script and parked in sessionStorage, which survives the
   same-origin redirect; the test then reads it from whichever document is current. */
const pdfjsSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const pdfjsIntegrity = 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
const pdfjsWorkerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const pdfjsProbeKey = 'pulse-test:pdfjs-integrity';

test.describe('pdf.js pin and Subresource Integrity on app.html', () => {
  test('/app.html: the static pdf.js tag carries the recorded hash and the library loads', async ({ page }) => {
    const failed = [];
    page.on('requestfailed', r => { const why = r.failure() && r.failure().errorText; if (/pdf\.min\.js/.test(r.url()) && why !== 'net::ERR_ABORTED') failed.push(r.url() + ' ' + why); });
    const consoleErrors = [];
    page.on('console', m => { if (m.type() === 'error' && /integrity|pdf\.min\.js|pdfjs/i.test(m.text())) consoleErrors.push(m.text()); });
    await page.addInitScript(key => {
      if (!/\/app\.html$/.test(location.pathname)) return;
      document.addEventListener('DOMContentLoaded', () => {
        const tags = [...document.querySelectorAll('script[src*="pdf.min.js"]')].map(el => ({ src: el.getAttribute('src'), integrity: el.getAttribute('integrity'), crossorigin: el.getAttribute('crossorigin') }));
        const lib = window.pdfjsLib;
        const probe = { tags, loaded: !!(lib && typeof lib.getDocument === 'function'), workerSrc: lib && lib.GlobalWorkerOptions ? lib.GlobalWorkerOptions.workerSrc : null };
        try { sessionStorage.setItem(key, JSON.stringify(probe)); } catch (e) { /* storage unavailable: the test fails on a missing probe */ }
      });
    }, pdfjsProbeKey);
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(key => !!sessionStorage.getItem(key), pdfjsProbeKey, { timeout: 15000 });
    const probe = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), pdfjsProbeKey);
    expect(probe.tags, 'exactly one static pdf.js tag').toHaveLength(1);
    expect(probe.tags[0]).toEqual({ src: pdfjsSrc, integrity: pdfjsIntegrity, crossorigin: 'anonymous' });
    test.skip(failed.some(f => /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(f)), 'CDN unreachable from this runner: integrity not verified here');
    expect(probe.loaded, 'window.pdfjsLib.getDocument available after the integrity-checked load').toBe(true);
    expect(probe.workerSrc, 'worker pinned to the same pdf.js version').toBe(pdfjsWorkerSrc);
    expect(consoleErrors, 'integrity or load errors in console').toEqual([]);
    expect(failed, 'failed pdf.js requests').toEqual([]);
  });
});
