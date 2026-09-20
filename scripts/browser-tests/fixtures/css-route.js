const path = require('path');

// index.html cumpre o contrato de arquivo único carregando CSS por URL ABSOLUTA de produção
// (https://paulorafaeldemourapaes.github.io/shopplosion-pulse/*.css), não por caminho relativo.
// Isso é intencional (permite abrir index.html via file:// sem quebrar), mas tem um efeito
// colateral em teste local: sem interceptação, o Chromium do Playwright busca o CSS de produção
// real na internet, e edições locais de CSS nunca são exercitadas pelo teste.
//
// Este helper intercepta essas requisições e serve o arquivo local equivalente (pelo nome do
// arquivo), para que testes que dependem de estilo computado validem o CSS que está no disco,
// não o que está publicado.

const PROD_CSS_GLOB = 'https://paulorafaeldemourapaes.github.io/shopplosion-pulse/*.css*';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

async function interceptLocalCss(page) {
  await page.route(PROD_CSS_GLOB, async (route) => {
    const url = new URL(route.request().url());
    const filename = url.pathname.split('/').pop();
    const localPath = path.join(REPO_ROOT, filename);
    await route.fulfill({ path: localPath });
  });
}

module.exports = { interceptLocalCss };
