const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/pilot-chocolate.html', name: 'Piloto Chocolate' },
  { path: '/index.html', name: 'Hoje' },
  { path: '/app.html', name: 'App' },
  { path: '/ask.html', name: 'Ask AI' },
];
const viewports = [
  { width: 1440, height: 1000, label: 'desktop 1440' },
  { width: 390, height: 844, label: 'mobile 390' },
];

const auditVisibleText = () => {
  const errors = [];
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && s.display !== 'none' &&
      s.visibility !== 'hidden' && Number(s.opacity || 1) > 0.01;
  };
  const rgb = (value) => {
    const m = String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
    if (!m) return null;
    let a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (String(m[4] || '').includes('%')) a /= 100;
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  };
  const composite = (front, back) => {
    const a = front[3];
    return [
      front[0] * a + back[0] * (1 - a),
      front[1] * a + back[1] * (1 - a),
      front[2] * a + back[2] * (1 - a),
      1,
    ];
  };
  const backgroundOf = (el) => {
    let bg = [255, 255, 255, 1];
    const chain = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    for (const n of chain.reverse()) {
      const c = rgb(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) bg = composite(c, bg);
    }
    return bg;
  };
  const luminance = (c) => {
    const linear = c.slice(0, 3).map(v => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (fg, bg) => {
    const f = luminance(fg), b = luminance(bg);
    return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05);
  };
  const labelFor = (el) => {
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const weight = Number(s.fontWeight) || 400;
    return { size, weight, color: s.color, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100) };
  };

  const bodyText = document.body.innerText || '';
  const titleText = [document.title, ...Array.from(document.querySelectorAll('h1')).filter(visible).map(el => el.innerText)].join('\n');
  if (/[\u2013\u2014]/u.test(bodyText + '\n' + titleText)) {
    const match = (bodyText + '\n' + titleText).match(/[^\n]*[\u2013\u2014][^\n]*/u);
    errors.push('Travessão/meia-risca visível: ' + (match ? match[0].trim().slice(0, 120) : 'texto'));
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  const textNodes = [];
  while ((node = walker.nextNode())) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el || !visible(el)) continue;
    textNodes.push({ el, text: node.nodeValue.trim().replace(/\s+/g, ' ') });
  }
  for (const item of textNodes) {
    const info = labelFor(item.el);
    if (info.size < 11) {
      errors.push('Texto abaixo de 11 px (' + info.size + ' px): "' + item.text.slice(0, 90) + '"');
      continue;
    }
    const fg = rgb(info.color);
    const bg = backgroundOf(item.el);
    if (!fg) {
      errors.push('Cor de texto não auditável em "' + item.text.slice(0, 70) + '": ' + info.color);
      continue;
    }
    const effectiveFg = fg[3] < 1 ? composite(fg, bg) : fg;
    const ratio = contrast(effectiveFg, bg);
    const large = info.size >= 24 || (info.size >= 18.66 && info.weight >= 700);
    const required = large ? 3 : 4.5;
    if (ratio + 0.01 < required) {
      errors.push('Contraste ' + ratio.toFixed(2) + ':1 abaixo de ' + required + ':1 (' + info.size + ' px, peso ' + info.weight + ', texto "' + item.text.slice(0, 75) + '", fg ' + info.color + ')');
    }
  }

  for (const el of Array.from(document.querySelectorAll('input, textarea, select, button')).filter(visible)) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) errors.push('Controle abaixo de 11 px: ' + el.tagName + ' (' + size + ' px)');
  }

  const main = document.querySelector('main, .main, .workspace, #main-content') || document.body;
  const h1 = Array.from(main.querySelectorAll('h1')).find(visible);
  if (h1) {
    const candidates = Array.from(main.querySelectorAll('.label, .eyebrow, .kicker, .crumb, [data-eyebrow], [data-label-above-title]'))
      .filter(el => visible(el) && el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING);
    const unique = candidates.filter((el, i, all) => !all.some((other, j) => j !== i && other.contains(el)));
    if (unique.length > 1) {
      errors.push('Mais de um rótulo antes do título principal: ' + unique.map(el => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)).join(' | '));
    }
  }
  return { errors, textNodes: textNodes.length };
};

for (const page of pages) {
  for (const viewport of viewports) {
    test(page.name + ': acabamento visual ' + viewport.label, async ({ page: browser }) => {
      await browser.setViewportSize({ width: viewport.width, height: viewport.height });
      await browser.goto(page.path, { waitUntil: 'domcontentloaded' });
      await browser.waitForLoadState('networkidle').catch(() => {});
      await browser.waitForTimeout(400);
      const result = await browser.evaluate(auditVisibleText);
      expect(result.errors, page.path + ' em ' + viewport.label + '\n' + result.errors.join('\n')).toEqual([]);
    });
  }
}
