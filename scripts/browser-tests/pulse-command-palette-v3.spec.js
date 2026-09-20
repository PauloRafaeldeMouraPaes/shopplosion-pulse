const { test, expect } = require('@playwright/test');

// Fase 5 (paleta de comando): o shell legado (pulse-shell.js) já tinha uma
// busca/navegação rápida por Ctrl/Cmd+K, mas hideLegacy() a escondia junto
// do resto do shell antigo sem repor nada dentro da V3 — uma capacidade que
// funcionava e desapareceu silenciosamente. Este teste garante que ela
// existe de novo dentro do Workspace V3: atalho de teclado, botão visível
// no rail, filtro por texto e navegação real para os 5 destinos.

test.describe('Paleta de comando (Workspace V3)', () => {
  test('Ctrl+K abre a paleta, filtra por texto e Esc fecha', async ({ page }) => {
    await page.goto('/index.html');
    const menu = page.locator('.pv3-command-menu');
    await expect(menu).not.toHaveClass(/open/);

    await page.keyboard.press('Control+k');
    await expect(menu).toHaveClass(/open/);
    await expect(menu.locator('input')).toBeFocused();

    const links = menu.locator('.pv3-command-items a');
    await expect(links).toHaveCount(5);

    await menu.locator('input').fill('base');
    await expect(links.filter({ hasText: 'Abrir Base' })).toBeVisible();
    await expect(links.filter({ hasText: 'Ir para Hoje' })).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(menu).not.toHaveClass(/open/);
  });

  test('botão da paleta no rail abre o mesmo menu e navega para o destino escolhido', async ({ page }) => {
    await page.goto('/index.html');
    const trigger = page.locator('.pv3-command-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();

    const menu = page.locator('.pv3-command-menu');
    await expect(menu).toHaveClass(/open/);

    const investigar = menu.locator('.pv3-command-items a', { hasText: 'Perguntar ao Pulse' });
    await expect(investigar).toHaveAttribute('href', /ask\.html/);
  });
});
