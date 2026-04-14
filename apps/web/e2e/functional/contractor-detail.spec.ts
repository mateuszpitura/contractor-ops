import { expect, test } from '@playwright/test';

import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Contractor detail page', () => {
  /**
   * Navigate to the contractors list first, then attempt to reach
   * a detail page by clicking the first table row. Every test in
   * this suite is skipped when no contractor data exists.
   */

  async function navigateToFirstContractorDetail(page: import('@playwright/test').Page) {
    await navigateToDashboard(page, '/en/contractors');
    skipIfUnauthenticated(page);

    // Wait for table or empty state
    const firstRow = page.locator('table tbody tr').first();
    const hasData = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasData) {
      test.skip(true, 'No contractor data available — skipping detail page test');
      return;
    }

    // Click the first row to open side panel
    await firstRow.click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });

    // Look for a "View" link or navigation link within the side panel to go to full detail
    const viewLink = sidePanel
      .locator('a')
      .filter({ hasText: /view|detail|open|profile/i })
      .first();
    const viewLinkVisible = await viewLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (viewLinkVisible) {
      await viewLink.click();
    } else {
      // Fallback: look for any link that navigates to a contractor detail URL
      const detailLink = sidePanel.locator('a[href*="/contractors/"]').first();
      const detailLinkVisible = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false);

      if (detailLinkVisible) {
        await detailLink.click();
      } else {
        test.skip(true, 'No navigation link to contractor detail found in side panel');
        return;
      }
    }

    // Wait for detail page to load
    await page.waitForURL(/\/en\/contractors\/[^/]+/, { timeout: 15_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
  }

  test('navigate to contractor detail from list', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    // Verify we are on a detail page URL
    expect(page.url()).toMatch(/\/en\/contractors\/[^/]+/);
  });

  test('detail page renders with profile header', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    // Verify a heading or profile header section exists
    const profileHeader = page
      .locator('h1, h2, [data-testid="profile-header"], [class*="profile-header"]')
      .first();
    await expect(profileHeader).toBeVisible({ timeout: 15_000 });
  });

  test('profile tabs are visible', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    // Look for tab triggers (tablist role or tab role elements)
    const tabList = page.locator('[role="tablist"]').first();
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    // Verify at least some expected tabs exist
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);
  });

  test('tab switching works', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    test.skip(tabCount < 2, 'Not enough tabs to test switching');

    // Get the initially active tab
    const _firstTab = tabs.first();
    const secondTab = tabs.nth(1);

    // Click the second tab
    await secondTab.click();

    // Verify the second tab is now selected
    await expect(secondTab)
      .toHaveAttribute('data-state', 'active', { timeout: 5_000 })
      .catch(async () => {
        // Fallback: check aria-selected
        await expect(secondTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
      });

    // Verify a tab panel is visible
    const tabPanel = page.locator('[role="tabpanel"]').first();
    await expect(tabPanel).toBeVisible({ timeout: 10_000 });
  });

  test('back navigation works', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    // Look for breadcrumb or back link
    const backLink = page
      .locator('nav[aria-label*="readcrumb"] a, a[href="/en/contractors"], a[href*="/contractors"]')
      .filter({ hasText: /contractor/i })
      .first();
    const backLinkVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      await backLink.click();
    } else {
      // Fallback: use browser back
      await page.goBack();
    }

    // Verify we returned to the contractors list
    await page.waitForURL(/\/en\/contractors(?:\?|$)/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});
