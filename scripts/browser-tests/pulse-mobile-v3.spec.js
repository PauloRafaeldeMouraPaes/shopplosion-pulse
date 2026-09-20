const { test, expect } = require('@playwright/test');
test.describe('Reprojeção mobile',{});
test.describe('Reprojeção mobile',()=>{test.use({viewport:{width:390,height:844}});
 test('barra inferior mostra Hoje/Base/Investigação e escopo separado',async({page})=>{await page.goto('/index.html');const nav=page.locator('.pv3-shell-nav');await expect(nav.locator('a:visible')).toHaveCount(3);for(const x of ['hoje','base','investigacao'])await expect(nav.locator('a[data-nav="'+x+'"]')).toBeVisible();await expect(nav.locator('a[data-nav="universo"]')).toBeHidden();await expect(page.locator('.pv3-scope-header')).toBeVisible()});
});
test.describe('Rail desktop',()=>{test.use({viewport:{width:1280,height:900}});test('cinco destinos',async({page})=>{await page.goto('/index.html');await expect(page.locator('.pv3-shell-nav a:visible')).toHaveCount(5);await expect(page.locator('.pv3-scope-header')).toBeHidden()})});