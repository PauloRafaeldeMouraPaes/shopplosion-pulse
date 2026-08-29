const { test, expect } = require('@playwright/test');

function makeFixture(name, type, body) {
  return { name, mimeType: type, buffer: Buffer.from(body) };
}

test('estudo anexado é processado com proveniência e sinais estruturados', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.csv', 'text/csv', 'tema,achado\npreço,consumidores valorizam promoção\ncanal,atacarejo cresce\n'));

  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(1);
  const study = await page.evaluate(() => window.PULSE_STUDIES[0]);
  expect(study.name).toBe('insights.csv');
  expect(study.summary.excerpt).toContain('consumidores valorizam promoção');
  expect(study.summary.topics).toEqual(expect.arrayContaining(['preço', 'canal']));
  expect(study.provenance.evidenceType).toBe('user-provided-study');
  expect(study.provenance.confidence).toBe('descriptive');
  expect(study.summary.claims.length).toBeGreaterThan(0);
  await expect(page.locator('#pulse-study-intelligence')).toContainText('1 estudo(s) processado(s)');
});

test('estudo duplicado não cria evidência duplicada', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  const fixture = makeFixture('same.txt', 'text/plain', 'A pesquisa aponta forte sensibilidade a preço.');
  await input.setInputFiles(fixture);
  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(1);
  await input.setInputFiles(fixture);
  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(1);
});

test('contexto de estudo é separado da pergunta e expõe proveniência e achados', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.txt', 'text/plain', 'A pesquisa aponta forte sensibilidade a preço.'));
  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(1);

  const context = await page.evaluate(() => window.PULSE_STUDY_CONTEXT());
  expect(context).toContain('Fonte: insights.txt');
  expect(context).toContain('Confiança: descritiva');
  expect(context).toContain('Achados estruturados:');
  expect(context).toContain('forte sensibilidade a preço');
});

test('duas evidências com polaridades opostas no mesmo tópico são sinalizadas para revisão', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles([
    makeFixture('positivo.txt', 'text/plain', 'A pesquisa mostra que consumidores valorizam fortemente promoções de preço.'),
    makeFixture('negativo.txt', 'text/plain', 'A pesquisa mostra que consumidores não valorizam promoções de preço.')
  ]);
  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(2);
  const contradictions = await page.evaluate(() => window.PULSE_STUDY_CONTRADICTIONS());
  expect(contradictions.length).toBeGreaterThan(0);
  expect(contradictions[0].type).toBe('potential-contradiction');
  expect(contradictions[0].topic).toBe('preço');
  await expect(page.locator('#pulse-study-intelligence')).toContainText('Possíveis divergências entre estudos');
});

test('remover todos os estudos remove a evidência do contexto do Ask AI', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');
  await input.setInputFiles(makeFixture('insights.txt', 'text/plain', 'A pesquisa aponta forte sensibilidade a preço.'));
  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(1);

  const before = await page.evaluate(() => window.PULSE_STUDY_CONTEXT());
  expect(before).toContain('A pesquisa aponta forte sensibilidade a preço');

  await page.evaluate(() => window.PULSE_CLEAR_STUDIES());
  await expect.poll(async () => (await page.evaluate(() => (window.PULSE_STUDIES || []).length))).toBe(0);
  const after = await page.evaluate(() => window.PULSE_STUDY_CONTEXT());
  expect(after).toBe('');
  expect(await page.evaluate(() => window.PULSE_ACTIVE_STUDY_CONTEXT)).toBe('');
});

test('Pulse Intelligence Lab expõe score, qualidade, comparação e leitura executiva', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const lab = page.locator('#pulse-v6-lab');
  await expect(lab).toBeVisible();
  await expect(lab).toContainText('Signal Score');
  await expect(lab).toContainText('Oportunidades prioritárias');
  await expect(lab).toContainText('Qualidade das evidências');
  await expect(lab).toContainText('Comparação temporal');
  await expect(lab).toContainText('Próximas ações de investigação');
  await expect(lab).toContainText('Leitura executiva');
  await expect(lab.locator('#pulse-v6-print')).toBeVisible();
  await expect(lab.locator('#pulse-v6-copy')).toBeVisible();
});

// Behavioral contract: provenance, deduplication, claims, contradiction signals, removable evidence and the Intelligence Lab.
