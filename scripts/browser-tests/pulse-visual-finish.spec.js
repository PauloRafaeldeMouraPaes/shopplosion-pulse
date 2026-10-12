const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/pilot-chocolate.html', name: 'piloto chocolate' },
  { path: '/index.html', name: 'Hoje' },
  { path: '/app.html', name: 'app' },
  { path: '/ask.html', name: 'Ask AI' },
];
const viewports = [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
];

async function inspectVisibleText(page) {
  return page.evaluate(() => {
    const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'PATH']);
    const parseColor = (value) => {
      const match = value.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
      if (!match) return null;
      const alphaRaw = match[4] === undefined ? 1 : (match[4].endsWith('%') ? Number(match[4].slice(0, -1)) / 100 : Number(match[4]));
      return [Number(match[1]), Number(match[2]), Number(match[3]), Math.max(0, Math.min(1, alphaRaw))];
    };
    const composite = (front, back) => {
      const a = front[3] + back[3] * (1 - front[3]);
      if (a === 0) return [0, 0, 0, 0];
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / a,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / a,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / a,
        a,
      ];
    };
    const luminance = (rgb) => {
      const channels = rgb.slice(0, 3).map((n) => {
        const c = n / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrast = (a, b) => {
      const l1 = luminance(a), l2 = luminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const isVisible = (element) => {
      if (!element || ignored.has(element.tagName)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!rect.width || !rect.height || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      return true;
    };
    const composedBackground = (element) => {
      const chain = [];
      for (let node = element; node && node.nodeType === 1; node = node.parentElement) chain.unshift(node);
      let background = [255, 255, 255, 1];
      for (const node of chain) {
        const color = parseColor(getComputedStyle(node).backgroundColor);
        if (color && color[3] > 0) background = composite(color, background);
      }
      return background.slice(0, 3);
    };
    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue || '';
      const element = node.parentElement;
      if (!value.trim() || !isVisible(element)) continue;
      if (element.closest('script,style,noscript,template,svg')) continue;
      const style = getComputedStyle(element);
      const fontSize = Number.parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const foreground = parseColor(style.color);
      if (!foreground || foreground[3] === 0) continue;
      const bg = composedBackground(element);
      const fg = composite(foreground, [...bg, 1]);
      const ratio = contrast(fg, [...bg, 1]);
      const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
      textNodes.push({
        text: value.trim().replace(/\s+/g, ' '),
        fontSize,
        contrast: Number(ratio.toFixed(2)),
        minimumContrast: large ? 3 : 4.5,
        large,
        line: element.tagName.toLowerCase(),
      });
    }
    const h1 = document.querySelector('h1');
    const labelSelector = '.eyebrow,.kicker,.overline,.page-eyebrow,.page-kicker,[data-label-above-title],.label';
    const labelsAboveTitle = h1 && isVisible(h1)
      ? [...document.querySelectorAll(labelSelector)].filter((el) => {
          if (!isVisible(el) || el === h1 || h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return false;
          const text = (el.innerText || el.textContent || '').trim();
          if (!text) return false;
          const rect = el.getBoundingClientRect(), titleRect = h1.getBoundingClientRect();
          if (rect.bottom > titleRect.top + 1) return false;
          const style = getComputedStyle(el);
          const upperLabel = style.textTransform === 'uppercase' || el.matches('[data-label-above-title],.eyebrow,.kicker,.overline,.page-eyebrow,.page-kicker');
          return upperLabel && rect.left < titleRect.right && rect.right > titleRect.left;
        }).map((el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' '))
      : [];
    const visibleText = textNodes.map((item) => item.text).join(' ') + ' ' + document.title;
    return {
      tooSmall: textNodes.filter((item) => item.fontSize < 11),
      lowContrast: textNodes.filter((item) => item.contrast + 0.001 < item.minimumContrast),
      dashText: visibleText.split(/\s+/).filter((part) => /[\u2013\u2014]/.test(part)),
      labelsAboveTitle,
      title: document.title,
    };
  });
}

for (const pageCase of pages) {
  for (const viewport of viewports) {
    test(`acabamento visual: ${pageCase.name}, ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(pageCase.path);
      await page.waitForLoadState('domcontentloaded');
      const audit = await inspectVisibleText(page);
      expect(audit.tooSmall, `Texto visível abaixo de 11 px: ${JSON.stringify(audit.tooSmall.slice(0, 12))}`).toEqual([]);
      expect(audit.lowContrast, `Falhas de contraste AA: ${JSON.stringify(audit.lowContrast.slice(0, 12))}`).toEqual([]);
      expect(audit.dashText, `Travessão ou meia-risca em texto visível/título: ${JSON.stringify(audit.dashText)}`).toEqual([]);
      expect(audit.labelsAboveTitle.length, `Mais de um rótulo acima do título: ${JSON.stringify(audit.labelsAboveTitle)}`).toBeLessThanOrEqual(1);
    });
  }
}
