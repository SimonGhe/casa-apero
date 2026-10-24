import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/test-checkout',outputDir:'test-checkout-results',workers:1,retries:0,reporter:'list',
 use:{baseURL:'https://casa-apero.com',trace:'retain-on-failure'},
 projects:[{name:'test-checkout-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'test-checkout-mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 // Every request is intercepted: virtual main/admin domains, local workerd only.
});
