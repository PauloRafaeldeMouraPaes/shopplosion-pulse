import { test, expect } from '@playwright/test';

test('auth page loads without the removed global fetch abort override', async ({ page }) => {
  await page.goto('https://paulorafaeldemourapaes.github.io/shopplosion-pulse/auth.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[type="email"]')).toBeVisible();
  // auth.html has three password inputs (login, new password, confirm); the login one is #password.
  await expect(page.locator('input#password')).toBeVisible();
  const source = await page.locator('body').evaluate(() => document.documentElement.outerHTML);
  expect(source).not.toContain('global:{fetch:fetchWithTimeout}');
  expect(source).not.toContain('global: {fetch:fetchWithTimeout}');
});
