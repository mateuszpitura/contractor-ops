import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.request.post('http://localhost:3000/api/auth/sign-in/email', {
  data: { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD },
  headers: { 'content-type': 'application/json' },
});
await ctx.request.post('http://localhost:3000/api/auth/organization/set-active', {
  data: { organizationId: process.env.QA_DEFAULT_ORG_ID },
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
});
const page = await ctx.newPage();
const resp = await page.goto('http://localhost:3000/en/contractors', { waitUntil: 'networkidle' });
console.log('status:', resp?.status(), 'url:', page.url());
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/sidebar-test.png', fullPage: true });
console.log('saved /tmp/sidebar-test.png');
await browser.close();
