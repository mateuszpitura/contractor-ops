import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(currentDir, '.auth');
const authFile = path.join(authDir, 'user.json');

/**
 * Functional E2E global setup.
 * Logs in once, saves session to `.auth/user.json` for reuse across all specs.
 * Falls back to empty storage when credentials are missing — specs skip gracefully.
 */
export default async function globalSetup() {
  fs.mkdirSync(authDir, { recursive: true });

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!(email && password)) {
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    console.warn('[functional] E2E_EMAIL / E2E_PASSWORD not set — authenticated specs will skip.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/en/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(?:en|pl|ar)(\/|$)/, { timeout: 60_000 });
  await page.context().storageState({ path: authFile });
  await browser.close();
}
