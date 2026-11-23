const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/* The "Estado atual" section of pilot-chocolate.html renders pilot-chocolate-status.json, which
   scripts/pilot-autonomy.js writes and CI keeps current. The page must show the same numbers. */
test('pilot-chocolate.html: Estado atual mostra os números do arquivo de estado', async ({ page }) => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'pilot-chocolate-status.json'), 'utf8'));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/pilot-chocolate.html');
  const section = page.locator('#estado-atual');
  await expect(section.locator('.live-grid')).toBeVisible();
  await expect(section).toContainText(`${d.baseline.weeks_with_capture} de ${d.baseline.weeks_required} semanas`);
  const last = d.nfce.captures[d.nfce.captures.length - 1];
  if (last) {
    await expect(section).toContainText(last.ean.toLocaleString('pt-BR'));
    await expect(section).toContainText(last.stores.toLocaleString('pt-BR'));
    await expect(section.locator('.live-table tbody tr')).toHaveCount(d.nfce.latest_top_ean_by_stores.length);
    await expect(section.locator('.live-table tbody tr').first()).toContainText(d.nfce.latest_top_ean_by_stores[0].description);
  }
  await expect(section).toContainText(d.exception_queue.length ? 'Fila de exceções:' : 'Fila de exceções: vazia');
  await expect(section).not.toContainText('preliminary_only');
  expect(errors).toEqual([]);
});

test('pilot-chocolate.html: sem o arquivo de estado, a seção diz que está indisponível', async ({ page }) => {
  await page.route('**/pilot-chocolate-status.json', r => r.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/pilot-chocolate.html');
  await expect(page.locator('#estado-atual')).toContainText('Estado atual indisponível');
});
