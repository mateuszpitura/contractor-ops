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
await page.goto('http://localhost:3000/en/contractors', { waitUntil: 'networkidle' });
const info = await page.evaluate(() => {
  const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
  const sidebar = document.querySelector('[data-slot="sidebar"]');
  const gap = document.querySelector('[data-slot="sidebar-gap"]');
  const container = document.querySelector('[data-slot="sidebar-container"]');
  const inset = document.querySelector('[data-slot="sidebar-inset"]');
  const root = document.documentElement;
  return {
    cssVar: getComputedStyle(root).getPropertyValue('--sidebar-width'),
    wrapper: wrapper
      ? { display: getComputedStyle(wrapper).display, width: wrapper.clientWidth }
      : null,
    sidebar: sidebar
      ? {
          display: getComputedStyle(sidebar).display,
          width: sidebar.clientWidth,
          dataCollapsible: sidebar.getAttribute('data-collapsible'),
          dataState: sidebar.getAttribute('data-state'),
        }
      : null,
    gap: gap
      ? {
          display: getComputedStyle(gap).display,
          width: gap.clientWidth,
          computedWidth: getComputedStyle(gap).width,
        }
      : null,
    container: container
      ? {
          position: getComputedStyle(container).position,
          left: getComputedStyle(container).left,
          width: container.clientWidth,
          height: container.clientHeight,
        }
      : null,
    inset: inset
      ? {
          width: inset.clientWidth,
          x: inset.getBoundingClientRect().left,
          marginLeft: getComputedStyle(inset).marginLeft,
        }
      : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
