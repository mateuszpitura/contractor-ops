import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Login first
const r = await ctx.request.post('http://localhost:3000/api/auth/sign-in/email', {
  data: { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD },
  headers: { 'content-type': 'application/json' },
});
console.log('login:', r.status());
const orgId = process.env.QA_DEFAULT_ORG_ID;
if (orgId) {
  const ar = await ctx.request.post('http://localhost:3000/api/auth/organization/set-active', {
    data: { organizationId: orgId },
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  });
  console.log('set-active:', ar.status());
}

const routes = ['/en/invoices/intake/qa-intake-id', '/en/invoices/intake'];
for (const route of routes) {
  page.removeAllListeners('console');
  page.removeAllListeners('response');
  const consoleErrs = [];
  const httpErrs = [];
  page.on('console', m => {
    if (m.type() === 'error') consoleErrs.push(m.text());
  });
  page.on('response', r => {
    if (r.status() >= 400) httpErrs.push(r.status() + ' ' + r.url());
  });
  const resp = await page.goto('http://localhost:3000' + route, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  console.log('\n=== ' + route + ' (url: ' + page.url() + ', status: ' + resp?.status() + ') ===');
  for (const e of consoleErrs) console.log('  CONSOLE:', e.slice(0, 200));
  for (const e of httpErrs) console.log('  HTTP:', e.slice(0, 200));
  await page.setViewportSize({ width: 375, height: 812 });
  const results = await new AxeBuilder({ page }).analyze();
  for (const v of results.violations) {
    console.log('VIOL ' + v.id + ' (' + v.nodes.length + ' nodes)');
    for (const n of v.nodes.slice(0, 2)) {
      console.log('  TARGET:', n.target);
      console.log('  HTML:  ', n.html.slice(0, 300));
    }
  }
}
await browser.close();
