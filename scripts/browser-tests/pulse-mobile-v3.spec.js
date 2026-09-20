const { test, expect } = require('@playwright/test');
const { interceptLocalCss } = require('./fixtures/css-route');

// Fase 6 (reprojeção mobile): a proposta rejeita explicitamente transformar o rail de 5 destinos
// numa barra inferior de 5 ícones no mobile. No mobile a barra inferior deve ter só Hoje/Base/
// Investigação; Universo e Análises continuam alcançáveis, mas por um cabeçalho de escopo próprio.
// No desktop nada muda: os 5 destinos continuam no rail lateral.
//
// index.html carrega seu CSS por URL absoluta de produção (contrato de arquivo único / file://).
// Estes testes dependem de estilo computado (display, grid-template-columns), então interceptamos
// essas URLs para servir o CSS local em edição, não o CSS publicado — ver fixtures/css-route.js.

test.describe('Reprojeção mobile (Workspace V3)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await interceptLocalCss(page);
  });

  test('barra inferior mobile mostra só Hoje/Base/Investigação', async ({ page }) => {
    await page.goto('/index.html');
    const bottomNav = page.locator('.pv3-shell-nav');
    await expect(bottomNav).toBeVisible();

    const visibleLinks = bottomNav.locator('a:visible');
    await expect(visibleLinks).toHaveCount(3);
    await expect(bottomNav.locator('a[data-nav="hoje"]')).toBeVisible();
    await expect(bottomNav.locator('a[data-nav="base"]')).toBeVisible();
    await expect(bottomNav.locator('a[data-nav="investigacao"]')).toBeVisible();
    await expect(bottomNav.locator('a[data-nav="universo"]')).toBeHidden();
    await expect(bottomNav.locator('a[data-nav="analises"]')).toBeHidden();
  });

  test('cabeçalho de escopo mostra Universo e Análises e marca o escopo ativo', async ({ page }) => {
    await page.goto('/index.html');
    const scopeHeader = page.locator('.pv3-scope-header');
    await expect(scopeHeader).toBeVisible();

    const universoLink = scopeHeader.locator('a[data-nav="universo"]');
    const analisesLink = scopeHeader.locator('a[data-nav="analises"]');
    await expect(universoLink).toBeVisible();
    await expect(analisesLink).toBeVisible();
    await expect(universoLink).toHaveAttribute('aria-current', 'page');
    await expect(analisesLink).not.toHaveAttribute('aria-current', /.*/);
  });
});

test.describe('Rail desktop (Workspace V3) permanece com os 5 destinos', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await interceptLocalCss(page);
  });

  test('rail lateral desktop mostra os 5 destinos e o cabeçalho de escopo mobile fica oculto', async ({ page }) => {
    await page.goto('/index.html');
    const rail = page.locator('.pv3-shell-nav');
    await expect(rail.locator('a:visible')).toHaveCount(5);
    await expect(page.locator('.pv3-scope-header')).toBeHidden();
  });
});
