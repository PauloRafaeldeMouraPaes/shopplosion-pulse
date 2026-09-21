const { test, expect } = require('@playwright/test');

const routes = [
  ['/index.html?v=20260921.10#overview', 'universo'],
  ['/base.html?v=20260921.10#documents', 'base'],
  ['/ask.html?v=20260921.10', 'investigacao'],
  ['/app.html?v=20260921.10#analyses', 'analises'],
  ['/intelligence.html?v=20260921.10', 'hoje']
];

test.describe('Pulse canonical route shell', () => {
  for (const [url, active] of routes) {
    test(`canonical shell: ${active}`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('.pv4-rail').waitFor({ state: 'visible', timeout: 10000 });
      await expect(page.locator('.pv4-rail')).toHaveCount(1);
      await expect(page.locator('.pv4-top')).toHaveCount(1);
      await expect(page.locator('.pv4-command-menu')).toHaveCount(1);
      await expect(page.locator('.pv4-app')).toHaveCount(1);
      await expect(page.locator('.pv4-rail nav a')).toHaveCount(5);
      await expect(page.locator('.pv4-rail nav a[aria-current="page"]')).toHaveCount(1);
      await expect(page.locator(`.pv4-rail nav a[data-nav="${active}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.pulse-rail, .pulse-mainbar, .legacy-shell, .legacy-workspace')).toHaveCount(0);
      const geometry = await page.evaluate(() => {
        const rail = document.querySelector('.pv4-rail');
        const app = document.querySelector('.pv4-app');
        const top = document.querySelector('.pv4-top');
        const rr = rail.getBoundingClientRect();
        const ar = app.getBoundingClientRect();
        const tr = top.getBoundingClientRect();
        return {
          railRight: rr.right,
          appLeft: ar.left,
          appContentLeft: ar.left + parseFloat(getComputedStyle(app).paddingLeft || '0'),
          appWidth: ar.width,
          viewportWidth: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          topLeft: tr.left
        };
      });
      expect(geometry.appWidth).toBeGreaterThan(0);
      if (geometry.viewportWidth > 640) {
        expect(geometry.appContentLeft).toBeGreaterThanOrEqual(geometry.railRight - 1);
        expect(geometry.topLeft).toBeGreaterThanOrEqual(geometry.railRight - 1);
      } else {
        expect(geometry.appLeft).toBeGreaterThanOrEqual(-1);
      }
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('const path=location.pathname');
      expect(bodyText).not.toContain('(()=>{if(window.__PULSE_WORKSPACE_V5__)');
      expect(bodyText).not.toContain('Adicionar observação');
      expect(bodyText).not.toContain('pulse-history-period');
    });
  }

  test('mobile keeps all five destinations', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/index.html?v=20260921.10#overview', { waitUntil: 'domcontentloaded' });
    await page.locator('.pv4-rail').waitFor({ state: 'visible', timeout: 10000 });
    const links = page.locator('.pv4-rail nav a');
    await expect(links).toHaveCount(5);
    for (const label of ['Hoje', 'Universo', 'Base', 'Investigação', 'Análises']) {
      await expect(links.filter({ hasText: label })).toHaveCount(1);
    }
    await expect(page.locator('.pv4-mobile-scope select')).toHaveCount(1);
  });

  test('Universe has real evidence and Inspector contract', async ({ page }) => {
    await page.goto('/index.html?v=20260921.10#overview', { waitUntil: 'domcontentloaded' });
    await page.locator('#pv3-signals .pv4-evidence').first().waitFor({ state: 'visible', timeout: 10000 });
    const total = await page.evaluate(() => Array.isArray(window.PULSE_EVIDENCE) ? window.PULSE_EVIDENCE.length : 0);
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('#pv3-signals .pv4-evidence')).toHaveCount(total);
    await page.locator('#pv3-signals .pv4-evidence').first().click();
    await expect(page.locator('.pv4-inspector.open')).toBeVisible();
    await expect(page.locator('.pv4-inspector')).toContainText('FATO');
    await expect(page.locator('.pv4-inspector')).toContainText('ORIGEM');
    await expect(page.locator('.pv4-inspector')).toContainText('HIPÓTESE');
  });
});
