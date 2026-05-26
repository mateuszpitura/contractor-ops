import { expect, test } from '@playwright/test';

import { E2E_LOCALE } from './helpers';

/**
 * Legal / public pages — Step 13 port from apps/web/e2e/functional/legal-pages.spec.ts
 *
 * Vite routes use the `/legal/` prefix (e.g. `/pl/legal/privacy`), unlike the
 * legacy Next app paths (`/en/privacy`). No auth required.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Privacy Page', () => {
  test('renders with heading', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/legal/privacy`, { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/prywatno|privacy/i, { timeout: 15_000 });
  });

  test('has prose content sections', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/legal/privacy`, { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const content = page.locator('article.prose, article, .prose, main');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });

    const sections = page.locator('article section, article h2, .prose h2');
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Terms Page', () => {
  test('renders with heading', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/legal/terms`, { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/regulamin|terms/i, { timeout: 15_000 });
  });

  test('has content sections', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/legal/terms`, { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const content = page.locator('article, .prose, main');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });

    const paragraphs = page.locator('article p, .prose p, main p, main section');
    const count = await paragraphs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Breach Notification Page', () => {
  test('renders with content', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/legal/breach-notification`, { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const content = page.locator('article, .prose, main p, main section');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Sub-processors Page', () => {
  test('renders with content', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/legal/sub-processors`, { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const listContent = page.locator(
      'table, [role="table"], ul, ol, [role="list"], article, .prose, main p, main section',
    );
    await expect(listContent.first()).toBeVisible({ timeout: 15_000 });
  });
});
