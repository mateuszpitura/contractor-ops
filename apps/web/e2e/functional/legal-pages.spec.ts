import { expect, test } from '@playwright/test';

/**
 * Legal / public pages — no auth required.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Privacy Page', () => {
  test('renders with heading', async ({ page }) => {
    await page.goto('/en/privacy', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/privacy/i, { timeout: 15_000 });
  });

  test('shows jurisdiction options', async ({ page }) => {
    await page.goto('/en/privacy', { waitUntil: 'domcontentloaded' });

    // Wait for page content to load
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Expect jurisdiction cards or links (GB, DE, EU, etc.)
    const jurisdictionContent = page.locator(
      'text="GB"i, text="DE"i, text="EU"i, text="United Kingdom"i, text="Germany"i, text="Europe"i',
    );

    const hasJurisdictions = await jurisdictionContent
      .first()
      .isVisible()
      .catch(() => false);

    // Also check for card-like elements or links
    const cards = page.locator(
      '[data-testid*="jurisdiction"], a[href*="privacy"], [class*="card"], article',
    );
    const hasCards = await cards
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasJurisdictions || hasCards).toBe(true);
  });
});

test.describe('Terms Page', () => {
  test('renders with heading', async ({ page }) => {
    await page.goto('/en/terms', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/terms/i, { timeout: 15_000 });
  });

  test('has content sections', async ({ page }) => {
    await page.goto('/en/terms', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Expect article/prose content with sub-headings or paragraphs
    const content = page.locator('article, .prose, main');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });

    // Should have multiple paragraphs or sections
    const paragraphs = page.locator('article p, .prose p, main p, main section');
    const count = await paragraphs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Breach Notification Page', () => {
  test('renders with content', async ({ page }) => {
    await page.goto('/en/breach-notification', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Verify meaningful content is present
    const content = page.locator('article, .prose, main p, main section');
    await expect(content.first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Sub-processors Page', () => {
  test('renders with content', async ({ page }) => {
    await page.goto('/en/sub-processors', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Expect a list or table of sub-processors
    const listContent = page.locator(
      'table, [role="table"], ul, ol, [role="list"], article, .prose, main p, main section',
    );
    await expect(listContent.first()).toBeVisible({ timeout: 15_000 });
  });
});
