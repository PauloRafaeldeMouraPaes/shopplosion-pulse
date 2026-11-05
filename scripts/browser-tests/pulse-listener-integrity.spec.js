const { test, expect } = require('@playwright/test');

/* Gate for issues #18/#19: exactly one active handler per question-suggestion control and no
   element with more than one click listener for the same purpose. addEventListener is instrumented
   before any page script runs; inline on* handlers are counted through the element property. */
const INSTRUMENT = `(() => {
  window.__pulseListenerLog = [];
  const original = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try { window.__pulseListenerLog.push({ node: this, type: String(type) }); } catch (_) {}
    return original.call(this, type, fn, opts);
  };
})();`;

const pages = ['/index.html', '/ask.html', '/app.html', '/base.html', '/sources.html'];
const suggestionSelector = '.pulse-suggestion,[data-suggestion],.pv4-suggestion,[data-question],.questionExample';

test.describe('Listener integrity', () => {
  for (const path of pages) {
    test(path + ': suggestion controls have exactly one handler and no element has duplicate click listeners', async ({ page }) => {
      await page.addInitScript(INSTRUMENT);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(path, { waitUntil: 'load' });
      await page.waitForTimeout(800);
      const report = await page.evaluate((selector) => {
        const log = window.__pulseListenerLog || [];
        const perNode = new Map();
        for (const entry of log) {
          if (entry.type !== 'click' || !(entry.node instanceof Element)) continue;
          perNode.set(entry.node, (perNode.get(entry.node) || 0) + 1);
        }
        const duplicates = [...perNode.entries()].filter(([, n]) => n > 1).map(([node, n]) => ({ tag: node.tagName.toLowerCase(), id: node.id || null, className: node.className || null, count: n }));
        const suggestions = [...document.querySelectorAll(selector)].map(node => ({
          text: (node.getAttribute('data-question') || node.textContent || '').trim().slice(0, 60),
          handlers: (typeof node.onclick === 'function' ? 1 : 0) + (perNode.get(node) || 0),
        }));
        return { duplicates, suggestions, documentClickHandlers: log.filter(e => e.node === document && e.type === 'click').length };
      }, suggestionSelector);
      expect(errors, 'runtime errors').toEqual([]);
      expect(report.duplicates, 'elements with more than one click listener').toEqual([]);
      // Unauthenticated: Ask AI suggestions bind only after the session gate, so 0 or 1 is legitimate; never 2.
      for (const s of report.suggestions) expect(s.handlers, 'handlers on suggestion "' + s.text + '"').toBeLessThanOrEqual(1);
      expect(report.documentClickHandlers, 'document-level click delegation').toBeLessThanOrEqual(1);
    });
  }
});

/* Authenticated path of the Ask AI inline runtime: the suggestion and Enter-key handlers bind only after
   the session gate, so a stub client stands in for Supabase. The stub returns no data and never reaches
   the network; it exists only to let the binding code run. */
test('ask.html authenticated path binds each suggestion once and the Enter key once', async ({ page }) => {
  await page.route(/supabase-js|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/, route => route.abort());
  await page.addInitScript(INSTRUMENT);
  await page.addInitScript(() => {
    const result = (data = null) => Promise.resolve({ data, error: null });
    const chain = () => { const c = {}; ['select', 'eq', 'or', 'limit', 'in', 'order', 'maybeSingle', 'insert', 'update', 'upsert', 'single'].forEach(k => { c[k] = () => c; }); c.then = (ok) => result(null).then(ok); return c; };
    const session = { user: { id: 'stub-user', email: 'stub@example.invalid' }, access_token: 'stub-token', refresh_token: 'stub-refresh' };
    window.supabase = { createClient: () => ({ auth: { getSession: () => result({ session }), setSession: () => result({ session }), signOut: () => result() }, from: () => chain(), functions: { invoke: () => result({}) } }) };
    const realFetch = window.fetch.bind(window);
    window.fetch = (url, opts) => /pulse-auth-broker/.test(String(url)) ? Promise.resolve(new Response(JSON.stringify({ industry_id: 'stub-industry', industry_status: 'active', role: 'member', industry_name: 'Indústria Teste' }), { status: 200, headers: { 'Content-Type': 'application/json' } })) : realFetch(url, opts);
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/ask.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__PULSE_ASK_READY_FOR_PRIVATE__ === true, null, { timeout: 8000 });
  await page.waitForTimeout(600);
  const report = await page.evaluate(() => {
    const log = window.__pulseListenerLog || [];
    const count = (node, type) => (typeof node['on' + type] === 'function' ? 1 : 0) + log.filter(e => e.node === node && e.type === type).length;
    return {
      suggestions: [...document.querySelectorAll('.questionExample')].map(n => count(n, 'click')),
      queryEnter: count(document.getElementById('query'), 'keydown'),
      generateClick: count(document.getElementById('generate'), 'click'),
    };
  });
  expect(errors, 'runtime errors').toEqual([]);
  expect(report.suggestions.length).toBeGreaterThan(0);
  for (const n of report.suggestions) expect(n, 'click handlers per suggestion').toBe(1);
  expect(report.queryEnter, 'keydown handlers on #query (Enter must not trigger generation twice)').toBe(1);
  expect(report.generateClick, 'click handlers on #generate').toBeLessThanOrEqual(1);
});
