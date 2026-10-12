const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/pilot-chocolate.html', key: 'pilot-chocolate' },
  { path: '/index.html', key: 'hoje' },
  { path: '/app.html', key: 'app' },
  { path: '/ask.html', key: 'ask' },
];
const viewports = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];

async function auditVisibleText(page) {
  return page.evaluate(() => {
    const isVisible = (node) => {
      let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!el) return false;
      for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      return Array.from(range.getClientRects()).some(r => r.width > 0 && r.height > 0);
    };
    const rgb = (value) => {
      const m = String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
    };
    const over = (front, back) => {
      const a = front[3];
      const outA = a + back[3] * (1 - a);
      if (!outA) return [255, 255, 255, 1];
      return [
        (front[0] * a + back[0] * back[3] * (1 - a)) / outA,
        (front[1] * a + back[1] * back[3] * (1 - a)) / outA,
        (front[2] * a + back[2] * back[3] * (1 - a)) / outA,
        outA,
      ];
    };
    const effectiveBackground = (el) => {
      let bg = [255, 255, 255, 1];
      const ancestors = [];
      for (let p = el; p && p !== document.documentElement; p = p.parentElement) ancestors.push(p);
      for (const p of ancestors.reverse()) {
        const c = rgb(getComputedStyle(p).backgroundColor);
        if (c && c[3] > 0) bg = over(c, bg);
      }
      return bg;
    };
    const lum = (c) => {
      const channels = c.slice(0, 3).map(v => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (fg, bg) => {
      const l1 = lum(fg), l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const findings = { small: [], contrast: [], dashes: [], labelsAboveTitle: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text || !isVisible(node)) continue;
      const el = node.parentElement;
      if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      if (Number.isFinite(size) && size < 11) findings.small.push({ text: text.slice(0, 100), size, tag: el.tagName.toLowerCase(), className: String(el.className || '') });
      if (/[\u2013\u2014]/.test(text)) findings.dashes.push({ text: text.slice(0, 140), tag: el.tagName.toLowerCase() });
      const fg = rgb(cs.color);
      if (fg) {
        const bg = effectiveBackground(el);
        const ratio = contrast(fg, bg);
        const weight = Number.parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const minimum = large ? 3 : 4.5;
        if (ratio + 0.005 < minimum) findings.contrast.push({ text: text.slice(0, 100), ratio: Number(ratio.toFixed(2)), minimum, size, weight, color: cs.color, background: 'rgb(' + bg.slice(0, 3).map(Math.round).join(', ') + ')' });
      }
    }
    if (/[\u2013\u2014]/.test(document.title)) findings.dashes.push({ text: 'TITLE: ' + document.title, tag: 'title' });
    const h1 = document.querySelector('h1');
    if (h1) {
      const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      const selectors = '.eyebrow, .pv4-kicker, [data-eyebrow], [data-page-kicker], .page-kicker';
      findings.labelsAboveTitle = Array.from(document.querySelectorAll(selectors)).filter(el => {
        if (!before(el, h1)) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0 && String(el.textContent || '').trim();
      }).map(el => String(el.textContent || '').replace(/\s+/g, ' ').trim());
    }
    return findings;
  });
}

for (const target of pages) {
  for (const viewport of viewports) {
    test(`${target.key}: legibilidade e hierarquia em ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.goto(target.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const findings = await auditVisibleText(page);
      const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
      await testInfo.attach(`${target.key}-${viewport.width}px`, { body: screenshot, contentType: 'image/png' });
      expect(findings.small, 'Texto visível abaixo de 11 px').toEqual([]);
      expect(findings.contrast, 'Texto visível abaixo de WCAG AA').toEqual([]);
      expect(findings.dashes, 'Texto visível contém U+2013 ou U+2014').toEqual([]);
      expect(findings.labelsAboveTitle.length, 'Mais de um rótulo acima do h1: ' + findings.labelsAboveTitle.join(' | ')).toBeLessThanOrEqual(1);
    });
  }
}
