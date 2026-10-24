import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/admin-preview',outputDir:'admin-preview-test-results',workers:1,retries:0,reporter:'list',
 use:{baseURL:'https://admin.casa-apero.com',trace:'retain-on-failure'},
 projects:[{name:'preview-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'preview-mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 // No webServer or remote request: every browser URL is intercepted and handled
 // by a local compiled workerd fixture, including the virtual admin hostname.
});
