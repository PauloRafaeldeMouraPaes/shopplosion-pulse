const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Pulse next-level intelligence', () => {
  test('next-level runtime is present in the single-file artifact', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const state = await page.evaluate(() => ({
      history: Array.isArray(window.serie_historica),
      role: Array.isArray(window.papel_ideal),
      local: Array.isArray(window.PULSE_LOCAL_EVIDENCE),
      next: !!window.PULSE_NEXT_LEVEL,
      single: !!window.PULSE_SINGLE_FILE_READY
    }));
    expect(state.history).toBe(true);
    expect(state.role).toBe(true);
    expect(state.local).toBe(true);
    expect(state.next).toBe(true);
    expect(state.single).toBe(true);
  });

  test('historical comparison reports observed change without causal inference', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const result = await page.evaluate(() => window.PULSE_NEXT_LEVEL.compareSeries(120, 100));
    expect(result.status).toBe('observed_change');
    expect(result.delta).toBe(20);
    expect(result.deltaPct).toBe(20);
    expect(result.causal).toBe(false);
  });

  test('category role is explicitly heuristic', async ({ page }) => {
    await page.goto(`file://${path.resolve('index.html')}#signals`);
    const result = await page.evaluate(() => window.PULSE_NEXT_LEVEL.setCategoryRole('Bebidas', 'defender valor', [{ id: 'e1' }]));
    expect(result.category).toBe('Bebidas');
    expect(result.role).toBe('defender valor');
    expect(result.evidenceCount).toBe(1);
    expect(result.provenance).toMatch(/heurística/i);
  });

  test('local evidence upload extracts CSV and keeps provenance', async ({ page }, testInfo) => {
    const csvPath = path.join(testInfo.outputDir, 'pulse-next-level.csv');
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(csvPath, 'period,value,geography,claim\n2025,100,Sudeste,Bebidas zero açúcar crescem\n2026,120,Sudeste,Bebidas zero açúcar ganham relevância', 'utf8');
    await page.goto(`file://${path.resolve('index.html')}#investigate`);
    await page.locator('#pulse-files').setInputFiles(csvPath);
    await page.waitForFunction(() => Array.isArray(window.PULSE_LOCAL_EVIDENCE) && window.PULSE_LOCAL_EVIDENCE.some(x => x.name === 'pulse-next-level.csv'));
    const item = await page.evaluate(() => window.PULSE_LOCAL_EVIDENCE.find(x => x.name === 'pulse-next-level.csv'));
    expect(item.name).toBe('pulse-next-level.csv');
    expect(item.method).toMatch(/PapaParse|CSV/i);
    expect(item.provenance.sourceName).toBe('pulse-next-level.csv');
    expect(item.provenance.evidenceType).toBe('user-provided-study');
  });

  test('HTML contains no zero-width or BOM characters inside tag syntax', async () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    const tagText = html.match(/<[^>]*>/g) || [];
    const bad = tagText.filter(tag => /[\u200b\u200c\u200d\ufeff]/.test(tag));
    expect(bad).toEqual([]);
  });
});