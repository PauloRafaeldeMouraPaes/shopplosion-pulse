const { test, expect } = require('@playwright/test');

test.describe('Shopper intelligence — V3 single-file workspace', () => {
  test('publicado não referencia scripts JS locais externos', async ({ page }) => {
    await page.goto('/index.html#overview');
    const localScripts = await page.locator('script[src]').evaluateAll(nodes =>
      nodes.map(n => n.getAttribute('src')).filter(src => /^(?:\.?\/)?scripts\//i.test(src || ''))
    );
    expect(localScripts).toEqual([]);
    await expect(page.locator('.pv3-app')).toBeVisible();
  });

  test('Universo usa categorias data-driven sem opções órfãs', async ({ page }) => {
    await page.goto('/index.html#overview');
    const values = await page.locator('#pv3-category option').evaluateAll(opts => opts.map(o => o.value).filter(Boolean));
    const evidence = await page.evaluate(() => window.PULSE_EVIDENCE || []);
    for (const value of values) {
      expect(evidence.some(item => item.categoria === value), `Categoria sem evidência: ${value}`).toBe(true);
      await page.locator('#pv3-category').selectOption(value);
      await expect(page.locator('#pv3-signals .pv3-item').first()).toBeVisible();
    }
  });

  test('filtro de categoria altera a lista e oferece reset', async ({ page }) => {
    await page.goto('/index.html#overview');
    const total = await page.locator('#pv3-signals .pv3-item').count();
    const categories = await page.locator('#pv3-category option').evaluateAll(opts => opts.map(o => o.value).filter(Boolean));
    expect(categories.length).toBeGreaterThan(0);
    await page.locator('#pv3-category').selectOption(categories[0]);
    const filtered = await page.locator('#pv3-signals .pv3-item').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(total);
    await expect(page.locator('#pv3-chips .pv3-chip')).toContainText(categories[0]);
    await page.locator('#pv3-chips .pv3-chip button').click();
    await expect(page.locator('#pv3-category')).toHaveValue('');
    await expect(page.locator('#pv3-chips')).toBeEmpty();
    await expect(page.locator('#pv3-signals .pv3-item')).toHaveCount(total);
  });

  test('evidência abre no Inspector com proveniência e estrutura Fato → Contexto → Interpretação → Hipótese → Ação', async ({ page }) => {
    await page.goto('/index.html#overview');
    const first = page.locator('#pv3-signals .pv3-item[data-evidence-id]').first();
    await expect(first).toBeVisible();
    await first.getByRole('button', { name: 'Ver evidência' }).click();
    await expect(page.locator('#pv3-inspector')).toHaveClass(/open/);
    await expect(page.locator('#pv3-inspector')).toContainText('FATO');
    await expect(page.locator('#pv3-inspector')).toContainText('CONTEXTO');
    await expect(page.locator('#pv3-inspector')).toContainText('INTERPRETAÇÃO');
    await expect(page.locator('#pv3-inspector')).toContainText('HIPÓTESE');
    await expect(page.locator('#pv3-inspector')).toContainText('PRÓXIMA AÇÃO');
    await expect(page.locator('#pv3-inspector')).toContainText('Fonte');
    await page.getByRole('button', { name: 'Fechar' }).click();
    await expect(page.locator('#pv3-inspector')).not.toHaveClass(/open/);
  });

  test('breadcrumb contextual existe no workspace V3', async ({ page }) => {
    await page.goto('/index.html#overview');
    await expect(page.locator('.pv3-breadcrumb')).toBeVisible();
    await expect(page.locator('.pv3-breadcrumb')).toContainText('Pulse');
    await expect(page.locator('.pv3-breadcrumb')).toContainText('Universo');
  });

  test('barra mobile preserva Hoje/Base/Investigação e escopo Universo/Análises', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html#overview');
    const bottom = page.locator('.pv3-shell-nav');
    await expect(bottom.locator('a:visible')).toHaveCount(3);
    await expect(bottom.locator('a[data-nav="hoje"]')).toBeVisible();
    await expect(bottom.locator('a[data-nav="base"]')).toBeVisible();
    await expect(bottom.locator('a[data-nav="investigacao"]')).toBeVisible();
    await expect(page.locator('.pv3-scope-header')).toBeVisible();
  });
});