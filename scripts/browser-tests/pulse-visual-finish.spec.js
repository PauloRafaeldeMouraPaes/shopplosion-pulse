const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/pilot-chocolate.html', name: 'piloto chocolate' },
  { path: '/index.html', name: 'Hoje' },
  { path: '/app.html', name: 'app' },
  { path: '/ask.html', name: 'Ask AI' },
];
const viewports = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];

test.describe('Pulse visual finish contract', () => {
  for (const pageCase of pages) {
    for (const viewport of viewports) {
      test(`${pageCase.name} at ${viewport.width}px meets visual accessibility contract`, async ({ page }, testInfo) => {
        const runtimeErrors = [];
        page.on('pageerror', error => runtimeErrors.push('pageerror: ' + error.message));
        page.on('console', message => {
          if (message.type() === 'error') runtimeErrors.push('console: ' + message.text());
        });
        await page.setViewportSize(viewport);
        await page.goto(pageCase.path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        if (pageCase.path !== '/pilot-chocolate.html') {
          await expect(page.locator('.pv4-rail'), 'shared Pulse navigation must mount').toBeVisible({ timeout: 10000 });
          await expect(page.locator('.pv4-app'), 'shared Pulse page content must mount').toBeVisible({ timeout: 10000 });
        }
        const audit = await page.evaluate(() => {
          const visible = (el) => {
            if (!(el instanceof Element)) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            for (let node = el; node instanceof Element; node = node.parentElement) {
              const style = getComputedStyle(node);
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            }
            return true;
          };
          const parseColor = (value) => {
            if (!value) return null;
            const s = value.trim().toLowerCase();
            if (s === 'transparent') return [0, 0, 0, 0];
            let m = s.match(/^#([0-9a-f]{3,8})$/i);
            if (m) {
              let h = m[1];
              if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
              if (h.length === 6) h += 'ff';
              if (h.length !== 8) return null;
              return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255];
            }
            m = s.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/);
            if (!m) return null;
            let alpha = m[4] === undefined ? 1 : Number(m[4]);
            if (s.includes('/') && m[4] && s.slice(s.indexOf('/') + 1).includes('%')) alpha /= 100;
            if (alpha > 1) alpha /= 100;
            return [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
          };
          const blend = (front, back) => {
            const a = front[3] === undefined ? 1 : front[3];
            return [
              front[0] * a + back[0] * (1 - a),
              front[1] * a + back[1] * (1 - a),
              front[2] * a + back[2] * (1 - a),
              1,
            ];
          };
          const backgroundFor = (el) => {
            let bg = [255, 255, 255, 1];
            const ancestors = [];
            for (let node = el; node instanceof Element; node = node.parentElement) ancestors.push(node);
            for (const node of ancestors.reverse()) {
              const c = parseColor(getComputedStyle(node).backgroundColor);
              if (c && c[3] > 0) bg = blend(c, bg);
            }
            return bg;
          };
          const luminance = (color) => {
            const channels = color.slice(0, 3).map(v => {
              const c = v / 255;
              return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const ratio = (a, b) => {
            const l1 = luminance(a), l2 = luminance(b);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          };
          const errors = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
            const el = node.parentElement;
            if (!text || !visible(el) || el.closest('script,style,noscript,template')) continue;
            const style = getComputedStyle(el);
            const size = parseFloat(style.fontSize);
            if (size < 11) errors.push({ type: 'text-under-11px', text: text.slice(0, 70), size, selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '') });
            if (/[\u2013\u2014]/.test(text)) errors.push({ type: 'dash-in-visible-text', text: text.slice(0, 90), selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') });
            const fg = parseColor(style.color);
            const bg = backgroundFor(el);
            if (fg) {
              const effectiveFg = blend(fg, bg);
              const contrast = ratio(effectiveFg, bg);
              const bold = parseInt(style.fontWeight, 10) >= 700;
              const large = size >= 24 || (size >= 18.66 && bold);
              const minimum = large ? 3 : 4.5;
              if (contrast + 0.01 < minimum) errors.push({ type: 'contrast', text: text.slice(0, 70), ratio: Number(contrast.toFixed(2)), minimum, foreground: style.color, background: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')', selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '') });
            } else {
              errors.push({ type: 'contrast-unparsed-color', text: text.slice(0, 70), color: style.color });
            }
          }
          for (const control of [...document.querySelectorAll('input[placeholder],textarea[placeholder],select')].filter(visible)) {
            const text = control.tagName === 'SELECT'
              ? String(control.options[control.selectedIndex]?.textContent || '').trim()
              : String(control.getAttribute('placeholder') || '').trim();
            if (!text) continue;
            const style = control.tagName === 'SELECT' ? getComputedStyle(control) : getComputedStyle(control, '::placeholder');
            const size = parseFloat(style.fontSize || getComputedStyle(control).fontSize);
            const selector = control.tagName.toLowerCase() + (control.id ? '#' + control.id : '') + (control.tagName === 'SELECT' ? '::selected-option' : '::placeholder');
            if (size < 11) errors.push({ type: 'text-under-11px', text: text.slice(0, 70), size, selector });
            if (/[\u2013\u2014]/.test(text)) errors.push({ type: 'dash-in-visible-text', text: text.slice(0, 90), selector });
            const fg = parseColor(style.color);
            const bg = backgroundFor(control);
            if (fg) {
              const contrast = ratio(blend(fg, bg), bg);
              const bold = parseInt(style.fontWeight || getComputedStyle(control).fontWeight, 10) >= 700;
              const large = size >= 24 || (size >= 18.66 && bold);
              const minimum = large ? 3 : 4.5;
              if (contrast + 0.01 < minimum) errors.push({ type: 'contrast', text: text.slice(0, 70), ratio: Number(contrast.toFixed(2)), minimum, foreground: style.color, background: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')', selector });
            } else {
              errors.push({ type: 'contrast-unparsed-color', text: text.slice(0, 70), color: style.color, selector });
            }
          }
          if (/[\u2013\u2014]/.test(document.title)) errors.push({ type: 'dash-in-document-title', text: document.title });
          const h1 = [...document.querySelectorAll('h1')].find(visible);
          let eyebrowCount = 0;
          if (h1) {
            const h1Top = h1.getBoundingClientRect().top;
            eyebrowCount = [...document.querySelectorAll('.eyebrow,.overline,.kicker,.label,.section-label,.page-label,.hero-label,.pv4-kicker,.pv4-label,.page-kicker,[data-eyebrow="true"],[data-page-kicker]')]
              .filter(el => visible(el) && el.getBoundingClientRect().bottom <= h1Top + 1).length;
            if (eyebrowCount > 1) errors.push({ type: 'multiple-labels-above-title', count: eyebrowCount, title: h1.innerText.trim() });
          }
          const cssText = [...document.styleSheets].filter(sheet => !/pulse-tokens\.css/i.test(sheet.href || '')).map(sheet => {
            try { return [...sheet.cssRules].map(rule => rule.cssText).join(' '); }
            catch (_) { return ''; }
          }).join(' ');
          const below11Count = errors.filter(error => error.type === 'text-under-11px').length;
          const contrastFailureCount = errors.filter(error => error.type === 'contrast' || error.type === 'contrast-unparsed-color').length;
          const visibleDashCount = errors.filter(error => error.type === 'dash-in-visible-text' || error.type === 'dash-in-document-title').length;
          const distinctHexColors = new Set(cssText.match(/#[0-9a-f]{3,8}\b/gi) || []).size;
          const importantCount = (cssText.match(/!important/g) || []).length;
          return {
            errors, title: document.title, eyebrowCount, visibleTextNodes: document.body.innerText.length,
            metrics: { below11Count, contrastFailureCount, visibleDashCount, labelsAboveTitle: eyebrowCount, distinctHexColors, importantCount }
          };
        });
        console.log('[VISUAL_FINISH_METRICS] ' + JSON.stringify({ page: pageCase.path, width: viewport.width, runtimeErrors: runtimeErrors.slice(0, 12), ...audit.metrics }));
        await testInfo.attach(`${pageCase.name.replace(/[^a-z0-9]+/gi, '-')}-${viewport.width}px`, {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
          contentType: 'image/png',
        });
        expect(audit.errors, `${pageCase.path} at ${viewport.width}px visual audit: ${JSON.stringify(audit.errors.slice(0, 20), null, 2)}`).toEqual([]);
      });
    }
  }
});
