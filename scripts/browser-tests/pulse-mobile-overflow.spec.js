const { test, expect } = require('@playwright/test');

/* No page may scroll sideways on a phone. At 390 px every visible element must end inside the viewport and the
   document must not be wider than it. Found on 2026-11-05: the workspace status sentence (#pv4-nl-status) was a
   nowrap chip 556 px wide on index.html and intelligence.html, and the documento.html header did not wrap.
   Pages are loaded without a session; the Supabase SDK request is aborted so pages that redirect to auth.html when
   the client answers stay on their own markup and are measured as served. */
const pages = ['/index.html', '/intelligence.html', '/sources.html', '/ask.html', '/documento.html', '/pilot-chocolate.html', '/base.html'];

for (const path of pages) {
  test(`${path}: no horizontal overflow at 390 px`, async ({ page }) => {
    await page.route(/supabase-js@/, route => route.abort('failed'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        const rc = el.getBoundingClientRect();
        if (rc.width && rc.right > vw + 1) over.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]) + ' right=' + Math.round(rc.right));
      }
      return { sw: document.documentElement.scrollWidth, vw, over: over.slice(0, 8) };
    });
    expect(r.over, 'elements ending past the viewport').toEqual([]);
    expect(r.sw, 'document width').toBeLessThanOrEqual(r.vw);
  });
}
