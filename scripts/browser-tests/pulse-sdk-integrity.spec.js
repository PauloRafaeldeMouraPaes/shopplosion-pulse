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
