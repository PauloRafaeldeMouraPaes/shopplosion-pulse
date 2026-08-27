const { test, expect } = require('@playwright/test');

function makeFixture(name, type, body) {
  return { name, mimeType: type, buffer: Buffer.from(body) };
}

test('estudo anexado é processado com proveniência e sinais estruturados', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.csv', 'text/csv', 'tema,achado\npreço,consumidores valorizam promoção\ncanal,atacarejo cresce\n'));

  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(1);
  const study = await page.evaluate(() => window.PULSE_STUDIES[0]);
  expect(study.name).toBe('insights.csv');
  expect(study.summary.excerpt).toContain('consumidores valorizam promoção');
  expect(study.summary.topics).toEqual(expect.arrayContaining(['preço', 'canal']));
  expect(study.provenance.evidenceType).toBe('user-provided-study');
  expect(study.provenance.confidence).toBe('descriptive');
  await expect(page.locator('#pulse-study-intelligence')).toContainText('1 estudo(s) processado(s)');
});

test('estudo duplicado não cria evidência duplicada', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  const fixture = makeFixture('same.txt', 'text/plain', 'A pesquisa aponta forte sensibilidade a preço.');
  await input.setInputFiles(fixture);
  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(1);
  await input.setInputFiles(fixture);
  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(1);
});

test('contexto de estudo é separado da pergunta e expõe proveniência', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.txt', 'text/plain', 'A pesquisa aponta forte sensibilidade a preço.'));
  await expect.poll(async () => page.evaluate(() => (window.PULSE_STUDIES || []).length)).toBe(1);

  const context = await page.evaluate(() => window.PULSE_STUDY_CONTEXT());
  expect(context).toContain('Fonte: insights.txt');
  expect(context).toContain('Confiança: descritiva');
  expect(context).toContain('forte sensibilidade a preço');
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
  expect(await page.evaluate(() => window.PULSE_ACTIVE_STUDY_CONTEXT)).toBe('');
});

// Behavioral contract: provenance, deduplication, structured signals and removable evidence.
