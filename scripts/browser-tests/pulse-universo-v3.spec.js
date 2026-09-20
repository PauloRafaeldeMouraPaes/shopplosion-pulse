const { test, expect } = require('@playwright/test');
test.describe('Universo: sinais, diagnóstico e oportunidade',()=>{
 test('todas as evidências aparecem sem filtro',async({page})=>{await page.goto('/index.html');const total=await page.evaluate(()=>window.PULSE_EVIDENCE.length);await expect(page.locator('#pv3-signals .pv4-evidence')).toHaveCount(total)});
 test('filtro por categoria reduz o canvas',async({page})=>{await page.goto('/index.html');const sel=page.locator('#pv3-category');await sel.selectOption('bebidas');await expect(page.locator('#pv3-signals .pv4-evidence')).toHaveCount(2);});
 test('diagnóstico e oportunidade existem',async({page})=>{await page.goto('/index.html');await expect(page.locator('.pv4-diagnostic')).toBeVisible();await expect(page.locator('.pv4-opportunity')).toBeVisible();await expect(page.locator('.pv4-opportunity')).toContainText('Onde crescer')});
});