const { test, expect } = require('@playwright/test');

// Fase 3: the "faixa de condução" module must load without throwing on every
// page that includes it, and must stay silent (no banner, no error) when
// there is no authenticated session, instead of guessing or inventing data.

for (const page_ of ['app.html', 'ask.html', 'intelligence.html']) {
  test(`condução carrega sem erro em ${page_} sem sessão`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack || error.message));
    await page.goto('/' + page_, { waitUntil: 'domcontentloaded' });
    // auth.html redirect (or the page's own guard) may fire; either way the
    // condução script itself must never throw.
    await page.waitForTimeout(800);
    expect(errors, `Erros de página:\n${errors.join('\n---\n')}`).toEqual([]);
    await expect(page.locator('.pulse-conducao')).toHaveCount(0);
  });
}
