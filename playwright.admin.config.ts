import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/admin',outputDir:'admin-test-results',fullyParallel:false,workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:5180',trace:'retain-on-failure'},
 projects:[{name:'admin-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'admin-mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 webServer:[
  {command:'pnpm dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
  {command:'pnpm dev:admin',url:'http://127.0.0.1:5180',reuseExistingServer:!process.env.CI,timeout:30000},
 ],
});
