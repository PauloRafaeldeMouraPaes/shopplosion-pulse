const { test, expect } = require('@playwright/test');

// Fase 3c (reprojeção da Base): a lista de documentos privados deve aparecer
// como pv3-item de verdade dentro do Workspace V3, com o estado real do
// documento (pendente/indexado) visível e, quando o documento ainda não foi
// indexado, uma ação "Indexar" alcançável a partir da Base — sem duplicar a
// lógica de indexação, apenas dando um proxy clicável para o botão real que
// `renderDocuments()` já cria em app.html.
//
// app.html real exige uma sessão Supabase autenticada para popular
// #documents via rede, e este teste não tem credenciais reais. Em vez de
// simular uma sessão (o que dependeria de rede real contra o projeto
// Supabase de produção e seria frágil em CI), o teste carrega o mesmo
// arquivo pulse-workspace-v3.js publicado dentro de uma fixture que
// reproduz apenas o contrato de DOM que app.html já fornece
// (#documents, #analyses, #file) — sem autenticação, sem duplicar a lógica
// de indexação. Isso exercita a reação real do Workspace V3 à mesma
// mutação de DOM que `renderDocuments()` produziria (via o mesmo
// MutationObserver que já existe em produção), sem inventar uma
// funcionalidade nova nem simplificar o contrato real.

test.describe('Base (Workspace V3): documentos com estado e ação de indexar', () => {
  test('documento pendente vira pv3-item com estado e ação de indexar; documento indexado não tem ação', async ({ page }) => {
    await page.goto('/scripts/browser-tests/fixtures/app.html');
    await expect(page.locator('#pv3-list')).toHaveCount(1);

    await page.evaluate(() => {
      const box = document.getElementById('documents');
      box.innerHTML = [
        '<div class="row"><div><strong><a class="docLink" href="./documento.html?id=doc-1">relatorio-shopper.pdf</a></strong>',
        '<div class="muted">application/pdf • 01/01/2026</div></div>',
        '<div><span class="status pending">pendente</span> <button class="secondary" data-index-doc="doc-1" type="button">Indexar</button></div></div>',
        '<div class="row"><div><strong><a class="docLink" href="./documento.html?id=doc-2">painel-canais.csv</a></strong>',
        '<div class="muted">text/csv • 02/01/2026</div></div>',
        '<div><span class="status">indexado • 12 blocos</span></div></div>',
      ].join('');
    });

    const items = page.locator('#pv3-list .pv3-item');
    await expect(items).toHaveCount(2);

    const pending = items.first();
    await expect(pending).toContainText('relatorio-shopper.pdf');
    await expect(pending.locator('.pv3-tag')).toContainText('pendente');
    await expect(pending.locator('button.pv3-index-proxy')).toHaveCount(1);
    await expect(pending.locator('a')).toHaveAttribute('href', /documento\.html\?id=doc-1/);

    const done = items.nth(1);
    await expect(done).toContainText('painel-canais.csv');
    await expect(done.locator('.pv3-tag')).toContainText('indexado');
    await expect(done.locator('button.pv3-index-proxy')).toHaveCount(0);
    await expect(done.locator('a')).toHaveAttribute('href', /documento\.html\?id=doc-2/);
  });

  test('clicar em "Indexar" no card pv3 aciona o botão real data-index-doc (não duplica a lógica de indexação)', async ({ page }) => {
    await page.goto('/scripts/browser-tests/fixtures/app.html');
    await expect(page.locator('#pv3-list')).toHaveCount(1);

    await page.evaluate(() => {
      const box = document.getElementById('documents');
      box.innerHTML = '<div class="row"><div><strong><a class="docLink" href="./documento.html?id=doc-1">relatorio-shopper.pdf</a></strong>' +
        '<div class="muted">application/pdf • 01/01/2026</div></div>' +
        '<div><span class="status pending">pendente</span> <button class="secondary" data-index-doc="doc-1" type="button">Indexar</button></div></div>';
    });

    await expect(page.locator('#pv3-list .pv3-item button.pv3-index-proxy')).toHaveCount(1);

    await page.evaluate(() => {
      document.querySelector('button[data-index-doc]').addEventListener('click', () => {
        window.__realIndexClicked = true;
      });
    });

    await page.locator('#pv3-list .pv3-item button.pv3-index-proxy').click();
    const clicked = await page.evaluate(() => window.__realIndexClicked === true);
    expect(clicked).toBe(true);

    const realDisabled = await page.evaluate(() => document.querySelector('button[data-index-doc]').disabled);
    expect(realDisabled).toBe(false); // o proxy não deve mexer no estado do botão real, só disparar o clique
  });

  test('análises salvas (rota #analyses) também aparecem como pv3-item, sem ação de indexar', async ({ page }) => {
    await page.goto('/scripts/browser-tests/fixtures/app.html#analyses');
    await expect(page.locator('#pv3-list')).toHaveCount(1);

    await page.evaluate(() => {
      const box = document.getElementById('analyses');
      box.innerHTML = '<div class="analysisRow"><a href="#a1"><strong>Ticket médio por canal</strong></a><div>Pergunta, resposta e 3 citações.</div></div>';
    });

    const items = page.locator('#pv3-list .pv3-item');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('Ticket médio por canal');
    await expect(items.first().locator('button.pv3-index-proxy')).toHaveCount(0);
  });
});
