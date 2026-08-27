const { test, expect } = require('@playwright/test');

function makeFixture(name, type, body) {
  return { name, mimeType: type, buffer: Buffer.from(body) };
}

test('estudo anexado é processado e disponibilizado ao Ask AI', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.csv', 'text/csv', 'tema,achado\npreço,consumidores valorizam promoção\ncanal,atacarejo cresce\n'));

  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(1);
  const study = await page.evaluate(() => window.PULSE_STUDIES[0]);
  expect(study.name).toBe('insights.csv');
  expect(study.summary.excerpt).toContain('consumidores valorizam promoção');
  await expect(page.locator('#pulse-study-intelligence')).toContainText('1 estudo(s) processado(s)');
});

test('remover todos os estudos remove a evidência do contexto do Ask AI', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.txt', 'text/plain', 'A pesquisa aponta forte sensibilidade a preço.'));
  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(1);

  const before = await page.evaluate(() => window.PULSE_STUDY_CONTEXT());
  expect(before).toContain('A pesquisa aponta forte sensibilidade a preço');

  await page.evaluate(() => window.PULSE_CLEAR_STUDIES());
  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(0);
  const after = await page.evaluate(() => window.PULSE_STUDY_CONTEXT());
  expect(after).toBe('');
});
