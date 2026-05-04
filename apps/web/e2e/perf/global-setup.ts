import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(currentDir, '.auth');
const authFile = path.join(authDir, 'user.json');

/**
 * Creates `e2e/perf/.auth/user.json`.
 * - With E2E_EMAIL + E2E_PASSWORD: logs in and saves session cookies.
 * - Otherwise: writes empty storage so Playwright can start; authenticated perf specs skip.
 */
export default async function globalSetup() {
  fs.mkdirSync(authDir, { recursive: true });
  fs.mkdirSync(path.join(currentDir, 'results'), { recursive: true });

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!(email && password)) {
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    // F-OBS-18 — emit on stderr (instead of console.warn) so the lint:logs
    // guard's promise of "no console.* in source" holds even in e2e setup.
    process.stderr.write(
      '[perf] E2E_EMAIL / E2E_PASSWORD not set — dashboard perf tests will skip. Public perf specs still run.\n',
    );
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/en/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/en(\/|$)/, { timeout: 60_000 });
  await page.context().storageState({ path: authFile });
  await browser.close();
}
