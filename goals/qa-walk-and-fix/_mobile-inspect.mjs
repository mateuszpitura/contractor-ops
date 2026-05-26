import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
await ctx.request.post('http://localhost:3000/api/auth/sign-in/email', {
  data: { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD },
  headers: { 'content-type': 'application/json' },
});
await ctx.request.post('http://localhost:3000/api/auth/organization/set-active', {
  data: { organizationId: process.env.QA_DEFAULT_ORG_ID },
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
});
const page = await ctx.newPage();
await page.goto('http://localhost:3000/en/contractors', { waitUntil: 'networkidle' });
// Find any visible avatar/badge that contains "N"
const items = await page.evaluate(() => {
  const r = [];
  for (const el of document.querySelectorAll('*')) {
    const s = window.getComputedStyle(el);
    if (
      (s.position === 'fixed' || s.position === 'absolute') &&
      s.display !== 'none' &&
      el.children.length < 5
    ) {
      const t = el.textContent?.trim() || '';
      const rect = el.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top > 100 &&
        rect.top < 800 &&
        rect.left < 100
      ) {
        r.push({
          tag: el.tagName,
          slot: el.getAttribute('data-slot'),
          state: el.getAttribute('data-state'),
          mobile: el.getAttribute('data-mobile'),
          cls: el.className?.toString().slice(0, 120),
          text: t.slice(0, 60),
          rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
          pos: s.position,
        });
      }
    }
  }
  return r.slice(0, 20);
});
console.log(JSON.stringify(items, null, 2));
await browser.close();
