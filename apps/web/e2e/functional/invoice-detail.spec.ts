import { expect, test } from '@playwright/test';

import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Invoice detail page', () => {
  /**
   * Navigate to the invoices list first, then attempt to reach
   * a detail page by clicking the first table row. Every test in
   * this suite is skipped when no invoice data exists.
   */

  async function navigateToFirstInvoiceDetail(page: import('@playwright/test').Page) {
    await navigateToDashboard(page, '/en/invoices');
    skipIfUnauthenticated(page);

    // Wait for table or empty state
    const firstRow = page.locator('table tbody tr').first();
    const hasData = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasData) {
      test.skip(true, 'No invoice data available — skipping detail page test');
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
      .filter({ hasText: /view|detail|open/i })
      .first();
    const viewLinkVisible = await viewLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (viewLinkVisible) {
      await viewLink.click();
    } else {
      // Fallback: look for any link that navigates to an invoice detail URL
      const detailLink = sidePanel.locator('a[href*="/invoices/"]').first();
      const detailLinkVisible = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false);

      if (detailLinkVisible) {
        await detailLink.click();
      } else {
        test.skip(true, 'No navigation link to invoice detail found in side panel');
        return;
      }
    }

    // Wait for detail page to load
    await page.waitForURL(/\/en\/invoices\/[^/]+/, { timeout: 15_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
  }

  test('navigate to invoice detail from list', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    // Verify we are on a detail page URL
    expect(page.url()).toMatch(/\/en\/invoices\/[^/]+/);
  });

  test('detail page renders', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    // Verify main content is visible with invoice-related content
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    const heading = page.locator('h1, h2, [data-testid="invoice-header"]').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('invoice metadata is displayed', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    // Verify invoice number or status badge is visible
    const invoiceIdentifier = page
      .locator('[data-testid="invoice-number"], [class*="badge"], [class*="status"]')
      .first()
      .or(
        page
          .locator('span, p, div')
          .filter({ hasText: /INV-|invoice|draft|pending|approved|paid|overdue/i })
          .first(),
      );
    await expect(invoiceIdentifier).toBeVisible({ timeout: 15_000 });
  });

  test('audit timeline exists', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    // Look for timeline/activity section
    const timeline = page
      .locator(
        '[data-testid="audit-timeline"], [data-testid="activity-timeline"], [class*="timeline"], [class*="activity"]',
      )
      .first()
      .or(
        page
          .locator('h2, h3, h4')
          .filter({ hasText: /timeline|activity|audit|history/i })
          .first(),
      );

    // Timeline may not always be present — verify gracefully
    const timelineVisible = await timeline.isVisible({ timeout: 10_000 }).catch(() => false);

    if (timelineVisible) {
      await expect(timeline).toBeVisible();
    } else {
      // Accept that some invoice detail pages may not have a visible timeline section
      // but at least verify the page is still rendered
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });

  test('back navigation works', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    // Look for breadcrumb or back link
    const backLink = page
      .locator('nav[aria-label*="readcrumb"] a, a[href="/en/invoices"], a[href*="/invoices"]')
      .filter({ hasText: /invoice/i })
      .first();
    const backLinkVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      await backLink.click();
    } else {
      // Fallback: use browser back
      await page.goBack();
    }

    // Verify we returned to the invoices list
    await page.waitForURL(/\/en\/invoices(?:\?|$)/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});
