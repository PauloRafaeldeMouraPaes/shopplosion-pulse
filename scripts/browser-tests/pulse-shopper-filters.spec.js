import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('shopper intelligence filters and single-file UX', () => {
  test('CSV local é extraído, persistido e aparece identificado no Ask AI', async ({ page }, testInfo) => {
    const csvPath = path.join(testInfo.outputDir, 'estudo-shopper-teste.csv');
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(csvPath, 'driver,insight\nsaudabilidade,Bebidas zero açúcar ganham relevância\ncanal,Fora do lar segue relevante', 'utf8');
    await page.goto('/index.html#investigate');
    await page.locator('#pulse-files').setInputFiles(csvPath);
    await page.waitForFunction(() => Array.isArray(window.PULSE_LOCAL_EVIDENCE) && window.PULSE_LOCAL_EVIDENCE.some((x) => x.name === 'estudo-shopper-teste.csv'));
    await expect(page.locator('#file-list')).toContainText('estudo-shopper-teste.csv');
    await expect(page.locator('#pulse-local-evidence-note')).toContainText('SUA BASE LOCAL');
    const local = await page.evaluate(() => ({ count: window.PULSE_LOCAL_EVIDENCE.length, name: window.PULSE_LOCAL_EVIDENCE[0]?.name, method: window.PULSE_LOCAL_EVIDENCE[0]?.method || window.PULSE_LOCAL_EVIDENCE[0]?.provenance?.extractionMethod }));
    expect(local.count).toBe(1);
    expect(local.name).toBe('estudo-shopper-teste.csv');
    expect(local.method).toBe('textual');
    await page.locator('#pulse-question').fill('O que o estudo diz sobre bebidas zero açúcar?');
    await page.locator('#pulse-ask-submit').click();
    await page.waitForTimeout(150);
    await expect(page.locator('#answer-custom')).toBeVisible();
    await expect(page.locator('#pulse-custom-body')).toContainText('SUA BASE LOCAL');
    await expect(page.locator('#pulse-custom-body')).toContainText('estudo-shopper-teste.csv');
  });
});
