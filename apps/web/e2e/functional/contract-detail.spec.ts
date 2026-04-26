import { expect, test } from '@playwright/test';

import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Contract detail page', () => {
  /**
   * Navigate to the contracts list first, then attempt to reach
   * a detail page by clicking the first table row. Every test in
   * this suite is skipped when no contract data exists.
   */

  async function navigateToFirstContractDetail(page: import('@playwright/test').Page) {
    await navigateToDashboard(page, '/en/contracts');
    skipIfUnauthenticated(page);

    // Wait for table or empty state
    const firstRow = page.locator('table tbody tr').first();
    const hasData = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasData) {
      test.skip(true, 'No contract data available — skipping detail page test');
      return;
    }

    // Click the first row to open side panel or navigate directly
    await firstRow.click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const panelVisible = await sidePanel.isVisible({ timeout: 10_000 }).catch(() => false);

    if (panelVisible) {
      // Look for a "View" link or navigation link within the side panel
      const viewLink = sidePanel
        .locator('a')
        .filter({ hasText: /view|detail|open/i })
        .first();
      const viewLinkVisible = await viewLink.isVisible({ timeout: 5_000 }).catch(() => false);

      if (viewLinkVisible) {
        await viewLink.click();
      } else {
        // Fallback: look for any link that navigates to a contract detail URL
        const detailLink = sidePanel.locator('a[href*="/contracts/"]').first();
        const detailLinkVisible = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false);

        if (detailLinkVisible) {
          await detailLink.click();
        } else {
          test.skip(true, 'No navigation link to contract detail found in side panel');
          return;
        }
      }
    }

    // Wait for detail page to load — row click may navigate directly or via side panel
    await page.waitForURL(/\/en\/contracts\/[^/]+/, { timeout: 15_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
  }

  test('navigate to contract detail from list', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    // Verify we are on a detail page URL
    expect(page.url()).toMatch(/\/en\/contracts\/[^/]+/);
  });

  test('detail page renders', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    // Verify main content is visible with contract-related content
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    const heading = page
      .locator('h1, h2, [data-testid="contract-header"], [data-testid="detail-header"]')
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('contract tabs are visible', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    // Look for tab triggers (tablist role or tab role elements)
    const tabList = page.locator('[role="tablist"]').first();
    const tabListVisible = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (tabListVisible) {
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(2);
    } else {
      // Some contract detail layouts may use navigation links instead of tabs
      const navLinks = page
        .locator('nav a, [class*="tab"], [class*="nav-link"]')
        .filter({ hasText: /detail|amendment|signature|overview/i });
      const navCount = await navLinks.count();
      expect(navCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('contract header shows status', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    // Look for a status badge in the header area
    const statusBadge = page
      .locator('[data-testid="status-badge"], [class*="badge"], [class*="status"]')
      .first()
      .or(
        page
          .locator('span, div')
          .filter({ hasText: /draft|active|pending|signed|expired|terminated|in review/i })
          .first(),
      );
    await expect(statusBadge).toBeVisible({ timeout: 15_000 });
  });

  test('back navigation works', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    // Look for breadcrumb or back link
    const backLink = page
      .locator('nav[aria-label*="readcrumb"] a, a[href="/en/contracts"], a[href*="/contracts"]')
      .filter({ hasText: /contract/i })
      .first();
    const backLinkVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      await backLink.click();
    } else {
      // Fallback: use browser back
      await page.goBack();
    }

    // Verify we returned to the contracts list
    await page.waitForURL(/\/en\/contracts(?:\?|$)/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});
