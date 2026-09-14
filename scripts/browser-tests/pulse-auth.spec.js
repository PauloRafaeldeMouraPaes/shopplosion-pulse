import { test, expect } from '@playwright/test';

test('auth page loads without the removed global fetch abort override', async ({ page }) => {
  await page.goto('https://paulorafaeldemourapaes.github.io/shopplosion-pulse/auth.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  const source = await page.locator('body').evaluate(() => document.documentElement.outerHTML);
  expect(source).not.toContain('global:{fetch:fetchWithTimeout}');
  expect(source).not.toContain('global: {fetch:fetchWithTimeout}');
});
