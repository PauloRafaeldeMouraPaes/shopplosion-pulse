const { test, expect } = require('@playwright/test');

// Fase 3b (reprojeção do Universo): a leitura editorial Sinais → Diagnóstico →
// Oportunidades deve existir de verdade dentro do Workspace V3, com filtro de
// categoria funcional sobre a evidência pública real (window.PULSE_EVIDENCE),
// chip removível com contagem, e as seções de diagnóstico/oportunidades
// preenchidas com o conteúdo real do Universo (não um retrato vazio).

test.describe('Universo (Workspace V3): sinais, diagnóstico e oportunidades', () => {
  test('todas as evidências aparecem sem filtro', async ({ page }) => {
    await page.goto('/index.html');
    const total = await page.evaluate(() => window.PULSE_EVIDENCE.length);
    await expect(page.locator('#pv3-signals .pv3-item')).toHaveCount(total);
    await expect(page.locator('#pv3-signals-count')).toContainText(total + ' evidência');
    await expect(page.locator('#pv3-chips')).toBeEmpty();
  });

  test('filtrar por categoria mostra só a evidência daquela categoria e cria um chip removível', async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('#pv3-category').selectOption('bebidas');
    await expect(page.locator('#pv3-signals .pv3-item')).toHaveCount(2);
    await expect(page.locator('#pv3-signals-count')).toContainText('2 evidência');
    await expect(page.locator('#pv3-signals-count')).toContainText('bebidas');
    const chip = page.locator('.pv3-chip');
    await expect(chip).toContainText('bebidas');
    await chip.locator('button').click();
    const total = await page.evaluate(() => window.PULSE_EVIDENCE.length);
    await expect(page.locator('#pv3-signals .pv3-item')).toHaveCount(total);
    await expect(page.locator('#pv3-chips')).toBeEmpty();
  });

  test('categoria sem opção órfã: todas as opções do seletor existem em alguma evidência', async ({ page }) => {
    await page.goto('/index.html');
    const values = await page.locator('#pv3-category option').evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));
    for (const value of values) {
      await page.locator('#pv3-category').selectOption(value);
      await expect(page.locator('#pv3-signals .pv3-item').first()).toBeVisible();
    }
  });

  test('diagnóstico mostra a leitura real do Universo, não uma seção vazia', async ({ page }) => {
    await page.goto('/index.html');
    const diag = page.locator('#pv3-diagnostic');
    await expect(diag.locator('.pv3-item')).not.toHaveCount(0);
    await expect(diag).toContainText('shopper brasileiro');
  });

  test('oportunidades mostra os cartões reais do Opportunity Canvas', async ({ page }) => {
    await page.goto('/index.html');
    const opp = page.locator('#pv3-opportunities');
    await expect(opp.locator('.pv3-item')).toHaveCount(2);
    await expect(opp).toContainText('PRIORIDADE 1');
  });
});
