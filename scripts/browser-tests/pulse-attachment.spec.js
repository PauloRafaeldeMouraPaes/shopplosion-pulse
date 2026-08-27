const { test, expect } = require('@playwright/test');

function makeFixture(name, type, bytes = [1, 2, 3]) {
  return { name, mimeType: type, buffer: Buffer.from(bytes) };
}

test('anexar estudos: aceita múltiplos arquivos e atualiza a revisão', async ({ page }) => {
  await page.goto('/index.html#investigate');

  const input = page.locator('#pulse-files');
  await expect(input).toHaveCount(1);

  await input.setInputFiles([
    makeFixture('estudo-shopper.pdf', 'application/pdf'),
    makeFixture('dados-fmcg.csv', 'text/csv'),
  ]);

  await expect(page.locator('#file-list')).toContainText('2 estudo(s) selecionado(s)');
  await expect(page.locator('#file-list')).toContainText('estudo-shopper.pdf');
  await expect(page.locator('#file-list')).toContainText('dados-fmcg.csv');
  await expect(page.locator('#file-list .file-list-empty')).toHaveCount(0);

  const uploaded = await page.evaluate(() => window.PULSE_UPLOADED_FILES);
  expect(uploaded).toEqual(['estudo-shopper.pdf', 'dados-fmcg.csv']);
});

test('anexar estudos: limpar seleção retorna ao estado vazio', async ({ page }) => {
  await page.goto('/index.html#investigate');
  const input = page.locator('#pulse-files');

  await input.setInputFiles(makeFixture('estudo.pdf', 'application/pdf'));
  await expect(page.locator('#file-list')).toContainText('1 estudo(s) selecionado(s)');

  await input.setInputFiles([]);
  await expect(page.locator('#file-list')).toContainText('Nenhum estudo selecionado.');
});
