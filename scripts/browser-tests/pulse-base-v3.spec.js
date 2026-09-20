const { test, expect } = require('@playwright/test');
test.describe('Base e Análises: reprojeção visual',()=>{
 test('Base expõe repositório privado e estados de ingestão',async({page})=>{await page.goto('/scripts/browser-tests/fixtures/app.html');await expect(page.locator('.pv4-app')).toBeVisible();await expect(page.locator('.pv4-base-hero')).toContainText('A evidência começa aqui.');});
 test('Análises é destino distinto e preserva a mesma linguagem de workspace',async({page})=>{await page.goto('/scripts/browser-tests/fixtures/app.html#analyses');await expect(page.locator('.pv4-app')).toBeVisible();await expect(page.locator('.pv4-base-hero')).toContainText('Análises preservadas');});
});