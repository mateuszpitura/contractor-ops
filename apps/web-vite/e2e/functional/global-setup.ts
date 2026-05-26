import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const authDir = path.join(currentDir, '.auth');
const authFile = path.join(authDir, 'user.json');

const SPA_PORT = Number(process.env.WEB_VITE_PORT ?? 4173);

/**
 * Functional E2E global setup for the Vite + Fastify stack.
 * Logs in once, saves session to `.auth/user.json` for reuse across specs.
 * Falls back to empty storage when credentials are missing — specs skip gracefully.
 */
export default async function globalSetup() {
  fs.mkdirSync(authDir, { recursive: true });

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${SPA_PORT}`;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!(email && password)) {
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    process.stderr.write(
      '[functional] E2E_EMAIL / E2E_PASSWORD not set — authenticated specs will skip.\n',
    );
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/pl/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(?:en|pl|ar|de)(\/|$)/, { timeout: 60_000 });
  await page.context().storageState({ path: authFile });
  await browser.close();
}
