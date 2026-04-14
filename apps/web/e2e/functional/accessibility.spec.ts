import { expect, test } from '@playwright/test';
import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Basic accessibility tests using Playwright built-in assertions.
 * Verifies landmarks, headings, focus order, labels, and skip-links.
 */

test.describe('Accessibility — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);
  });

  test('skip-to-content link exists', async ({ page }) => {
    // The link may be visually hidden until focused; check it exists in the DOM
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveCount(1, { timeout: 15_000 });

    // Focus the link and verify it becomes actionable
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
  });

  test('main content landmark has id', async ({ page }) => {
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 20_000 });
  });

  test('navigation landmarks are present', async ({ page }) => {
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    // Sidebar navigation
    const navElements = page.locator('nav');
    const navCount = await navElements.count();
    expect(navCount).toBeGreaterThanOrEqual(1);
  });

  test('page has at least one heading', async ({ page }) => {
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThanOrEqual(1);
  });

  test('focus moves through interactive elements without getting trapped', async ({ page }) => {
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    const focusedTags = new Set<string>();

    // Tab through the first several focusable elements
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(
        () => document.activeElement?.tagName?.toLowerCase() ?? 'none',
      );
      focusedTags.add(tag);
    }

    // Focus should have moved to at least 2 different element types (not stuck on one)
    expect(focusedTags.size).toBeGreaterThanOrEqual(2);
    // Body means focus fell out — at least some tabs should reach interactive elements
    expect(focusedTags).not.toEqual(new Set(['body']));
  });

  test('key buttons have accessible names', async ({ page }) => {
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    // Sidebar trigger
    const sidebarTrigger = page
      .locator(
        'button[data-sidebar="trigger"], button[aria-label*="sidebar" i], button[aria-label*="menu" i]',
      )
      .first();
    if (await sidebarTrigger.isVisible().catch(() => false)) {
      const name = await sidebarTrigger.evaluate(el => {
        const ariaLabel = el.getAttribute('aria-label') ?? '';
        const textContent = (el.textContent ?? '').trim();
        return ariaLabel || textContent;
      });
      expect(name.length).toBeGreaterThan(0);
    }

    // All visible buttons should have some accessible name (aria-label, text, or aria-labelledby)
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    const maxToCheck = Math.min(buttonCount, 10);

    for (let i = 0; i < maxToCheck; i++) {
      const btn = buttons.nth(i);
      const accessibleName = await btn.evaluate(el => {
        const ariaLabel = el.getAttribute('aria-label') ?? '';
        const ariaLabelledBy = el.getAttribute('aria-labelledby') ?? '';
        const textContent = (el.textContent ?? '').trim();
        const title = el.getAttribute('title') ?? '';
        return ariaLabel || ariaLabelledBy || textContent || title;
      });
      expect(accessibleName.length, `Button index ${i} has no accessible name`).toBeGreaterThan(0);
    }
  });
});

test.describe('Accessibility — Login page', () => {
  // Use a fresh context with no auth so we land on the login page
  test.use({ storageState: { cookies: [], origins: [] } });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });

    // Email input should have a label
    const emailLabel = page.locator('label[for="email"]');
    await expect(emailLabel).toHaveCount(1);
    const emailLabelText = await emailLabel.textContent();
    expect(emailLabelText?.trim().length).toBeGreaterThan(0);

    // Password input should have a label
    const passwordLabel = page.locator('label[for="password"]');
    await expect(passwordLabel).toHaveCount(1);
    const passwordLabelText = await passwordLabel.textContent();
    expect(passwordLabelText?.trim().length).toBeGreaterThan(0);
  });
});
