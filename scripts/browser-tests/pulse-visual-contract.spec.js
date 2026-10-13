const { test, expect } = require('@playwright/test');

const viewports = [
  { name: 'desktop 1440', width: 1440, height: 1000 },
  { name: 'mobile 390', width: 390, height: 844 }
];
const pages = [
  { name: 'pilot chocolate', path: '/pilot-chocolate.html' },
  { name: 'Hoje', path: '/index.html' },
  { name: 'app', path: '/app.html' },
  { name: 'Ask AI', path: '/ask.html' }
];

async function visibleTextAudit(page) {
  return page.evaluate(() => {
    const visible = el => {
      if (!(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity || 1) > 0 && el.getClientRects().length > 0;
    };
    const parse = value => {
      const m = value.match(/rgba?\(([^)]+)\)/i);
      if (!m) return null;
      const parts = m[1].split(',').map(v => Number.parseFloat(v.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };
    const composite = (fg, bg) => {
      const a = fg.a ?? 1;
      return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
    };
    const backgroundFor = el => {
      let bg = { r: 255, g: 255, b: 255, a: 1 };
      const chain = [];
      for (let node = el; node instanceof Element; node = node.parentElement) chain.push(node);
      for (const node of chain.reverse()) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color) bg = composite(color, bg);
      }
      return bg;
    };
    const channel = n => {
      const x = n / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const luminance = c => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    const ratio = (a, b) => {
      const x = luminance(a), y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const failures = { smallText: [], contrast: [], dashes: [], labels: [] };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('script,style,noscript,template,[aria-hidden="true"]') || !visible(el)) continue;
      const style = getComputedStyle(el);
      const size = Number.parseFloat(style.fontSize);
      if (size < 11) failures.smallText.push({ text: text.slice(0, 100), px: size, tag: el.tagName.toLowerCase(), className: String(el.className || '').slice(0, 80) });
      if (/[\u2013\u2014]/.test(text)) failures.dashes.push({ text: text.slice(0, 140), tag: el.tagName.toLowerCase(), className: String(el.className || '').slice(0, 80) });
      const fg = parse(style.color);
      if (fg) {
        const bg = backgroundFor(el);
        const contrast = ratio(fg, bg);
        const weight = Number.parseInt(style.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const minimum = large ? 3 : 4.5;
        if (contrast + 0.01 < minimum) failures.contrast.push({
          text: text.slice(0, 100), ratio: Number(contrast.toFixed(2)), required: minimum,
          foreground: style.color, background: 'rgb(' + [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)].join(', ') + ')',
          px: size, weight, tag: el.tagName.toLowerCase(), className: String(el.className || '').slice(0, 80)
        });
      }
    }

    const h1 = [...document.querySelectorAll('h1')].find(visible);
    if (h1) {
      const labelSelector = '.eyebrow,.pv4-kicker,.pv4-label,[data-title-label]';
      const candidates = [...document.querySelectorAll(labelSelector)].filter(el => visible(el));
      const preceding = candidates.filter(el => {
        const position = el.compareDocumentPosition(h1);
        return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (preceding.length > 1) failures.labels.push({
        title: (h1.textContent || '').trim(),
        labels: preceding.map(el => (el.textContent || '').trim()).slice(-5)
      });
    } else {
      failures.labels.push({ title: null, labels: [], reason: 'No visible h1 found' });
    }
    return failures;
  });
}

for (const pageCase of pages) {
  for (const viewport of viewports) {
    test(`${pageCase.name}: visual contract at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      const failures = await visibleTextAudit(page);
      expect(failures.smallText, 'Visible text below 11px: ' + JSON.stringify(failures.smallText, null, 2)).toEqual([]);
      expect(failures.contrast, 'WCAG AA contrast failures: ' + JSON.stringify(failures.contrast, null, 2)).toEqual([]);
      expect(failures.dashes, 'Visible em/en dashes: ' + JSON.stringify(failures.dashes, null, 2)).toEqual([]);
      expect(failures.labels, 'More than one label above title: ' + JSON.stringify(failures.labels, null, 2)).toEqual([]);
    });
  }
}
