const { test, expect } = require('@playwright/test');

const pages = [
  { path: '/pilot-chocolate.html', name: 'piloto-chocolate' },
  { path: '/index.html', name: 'hoje' },
  { path: '/app.html', name: 'app' },
  { path: '/ask.html', name: 'ask-ai' },
];
const viewports = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];

test.describe('Contrato de acabamento visual Pulse', () => {
  for (const item of pages) {
    for (const viewport of viewports) {
      test(item.name + ' ' + viewport.width + 'px: tipografia, contraste e hierarquia', async ({ page }, testInfo) => {
        const runtimeErrors = [];
        page.on('pageerror', error => runtimeErrors.push(error.message));
        await page.setViewportSize(viewport);
        await page.goto(item.path, { waitUntil: 'commit' });
        if (item.path === '/pilot-chocolate.html') {
          await expect(page.locator('link[rel="stylesheet"][href*="pulse-tokens.css"]'),
            'o piloto deve consumir o design system compartilhado').toHaveCount(1);
          await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f6f4');
          await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
        }
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(150);
        if (item.path !== '/pilot-chocolate.html') {
          await expect(page.locator('.pv4-rail'), 'a casca compartilhada deve montar').toBeVisible({ timeout: 10000 });
          await expect(page.locator('.pv4-app'), 'o conteúdo compartilhado deve montar').toBeVisible({ timeout: 10000 });
        }
        const audit = await page.evaluate(() => {
          const visible = (el) => {
            if (!(el instanceof Element)) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            for (let node = el; node instanceof Element; node = node.parentElement) {
              const s = getComputedStyle(node);
              if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
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
            return [front[0] * a + back[0] * (1 - a), front[1] * a + back[1] * (1 - a), front[2] * a + back[2] * (1 - a), 1];
          };
          const backgroundFor = (el) => {
            let bg = [255, 255, 255, 1];
            const ancestors = [];
            for (let node = el; node instanceof Element; node = node.parentElement) ancestors.push(node);
            for (const node of ancestors.reverse()) {
              const color = parseColor(getComputedStyle(node).backgroundColor);
              if (color && color[3] > 0) bg = blend(color, bg);
            }
            return bg;
          };
          const luminance = (color) => {
            const c = color.slice(0, 3).map(v => {
              const x = v / 255;
              return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
            });
            return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
          };
          const contrast = (a, b) => {
            const x = luminance(a), y = luminance(b);
            return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
          };
          const errors = [];
          const addTextError = (type, text, selector, extra = {}) => errors.push({ type, text: text.slice(0, 90), selector, ...extra });
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
            const el = node.parentElement;
            if (!text || !visible(el) || el.closest('script,style,noscript,template')) continue;
            const style = getComputedStyle(el);
            const size = parseFloat(style.fontSize);
            const selector = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 2).map(c => '.' + c).join('');
            if (size < 11) addTextError('texto-abaixo-de-11px', text, selector, { size });
            if (/[\u2013\u2014]/.test(text)) addTextError('travessao-ou-meia-risca', text, selector);
            const fg = parseColor(style.color);
            const bg = backgroundFor(el);
            if (!fg) {
              addTextError('cor-nao-interpretada', text, selector, { color: style.color });
              continue;
            }
            const ratio = contrast(blend(fg, bg), bg);
            const bold = parseInt(style.fontWeight, 10) >= 700;
            const large = size >= 24 || (size >= 18.66 && bold);
            const minimum = large ? 3 : 4.5;
            if (ratio + 0.01 < minimum) addTextError('contraste-abaixo-de-AA', text, selector, {
              ratio: Number(ratio.toFixed(2)), minimum, foreground: style.color,
              background: 'rgb(' + bg.slice(0, 3).map(Math.round).join(',') + ')'
            });
          }
          for (const control of [...document.querySelectorAll('input[placeholder],textarea[placeholder],select')].filter(visible)) {
            const placeholder = control.tagName === 'SELECT'
              ? String(control.options[control.selectedIndex]?.textContent || '').trim()
              : String(control.getAttribute('placeholder') || '').trim();
            if (!placeholder) continue;
            const style = control.tagName === 'SELECT' ? getComputedStyle(control) : getComputedStyle(control, '::placeholder');
            const size = parseFloat(style.fontSize || getComputedStyle(control).fontSize);
            const selector = control.tagName.toLowerCase() + (control.id ? '#' + control.id : '') + (control.tagName === 'SELECT' ? '::selected-option' : '::placeholder');
            if (size < 11) addTextError('texto-abaixo-de-11px', placeholder, selector, { size });
            if (/[\u2013\u2014]/.test(placeholder)) addTextError('travessao-ou-meia-risca', placeholder, selector);
            const fg = parseColor(style.color);
            const bg = backgroundFor(control);
            if (fg) {
              const ratio = contrast(blend(fg, bg), bg);
              const bold = parseInt(style.fontWeight || getComputedStyle(control).fontWeight, 10) >= 700;
              const large = size >= 24 || (size >= 18.66 && bold);
              const minimum = large ? 3 : 4.5;
              if (ratio + 0.01 < minimum) addTextError('contraste-abaixo-de-AA', placeholder, selector, { ratio: Number(ratio.toFixed(2)), minimum });
            }
          }
          if (/[\u2013\u2014]/.test(document.title)) addTextError('travessao-ou-meia-risca-no-title', document.title, 'title');
          const h1 = [...document.querySelectorAll('h1')].find(visible);
          let labelsAboveTitle = 0;
          if (h1) {
            const titleRect = h1.getBoundingClientRect();
            const labels = [...document.querySelectorAll('.eyebrow,.overline,.kicker,.label,.section-label,.page-label,.hero-label,.pv4-kicker,.pv4-label,.page-kicker,[data-eyebrow="true"],[data-page-kicker]')];
            labelsAboveTitle = labels.filter(el => {
              if (!visible(el)) return false;
              const rect = el.getBoundingClientRect();
              const sameColumn = rect.right > titleRect.left && rect.left < titleRect.right;
              return sameColumn && rect.bottom <= titleRect.top + 1;
            }).length;
            if (labelsAboveTitle > 1) addTextError('mais-de-um-rotulo-acima-do-titulo', h1.innerText.trim(), 'h1', { labelsAboveTitle });
          }
          const cssText = [...document.styleSheets].map(sheet => {
            try { return [...sheet.cssRules].map(rule => rule.cssText).join(' '); } catch (_) { return ''; }
          }).join(' ');
          return {
            errors,
            metrics: {
              distinctHexColors: new Set(cssText.match(/#[0-9a-f]{3,8}\b/gi) || []).size,
              importantCount: (cssText.match(/!important/g) || []).length,
              under11Count: errors.filter(e => e.type === 'texto-abaixo-de-11px').length,
              contrastFailures: errors.filter(e => e.type === 'contraste-abaixo-de-AA' || e.type === 'cor-nao-interpretada').length,
              visibleDashCount: errors.filter(e => e.type.includes('travessao-ou-meia-risca')).length,
              labelsAboveTitle,
            },
          };
        });
        console.log('[PULSE_ACABAMENTO] ' + JSON.stringify({ page: item.path, width: viewport.width, runtimeErrors: runtimeErrors.slice(0, 8), ...audit.metrics }));
        await testInfo.attach(item.name + '-' + viewport.width + 'px', {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
          contentType: 'image/png',
        });
        expect(audit.errors, item.path + ' at ' + viewport.width + 'px: ' + JSON.stringify(audit.errors.slice(0, 25), null, 2)).toEqual([]);
      });
    }
  }
});
