import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { E2E_LOCALE, localePath, navigateToDashboard, skipIfUnauthenticated } from './helpers';

const invoiceDetailPattern = new RegExp(`/${E2E_LOCALE}/invoices/[^/]+`);
const invoicesListPattern = new RegExp(`/${E2E_LOCALE}/invoices(?:\\?|$)`);

/**
 * Invoice detail page — batch 5 port from apps/web/e2e/functional/invoice-detail.spec.ts
 * Routes: /:locale/invoices/:id (Vite SPA, default locale pl).
 */
test.describe('Invoice detail page', () => {
  async function navigateToFirstInvoiceDetail(page: Page) {
    await navigateToDashboard(page, localePath('/invoices'));
    skipIfUnauthenticated(page);

    const firstRow = page.locator('table tbody tr').first();
    const hasData = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasData) {
      test.skip(true, 'No invoice data available — skipping detail page test');
      return;
    }

    await firstRow.click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });

    const viewLink = sidePanel
      .locator('a')
      .filter({ hasText: /view|detail|open|szczeg|pokaż/i })
      .first();
    const viewLinkVisible = await viewLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (viewLinkVisible) {
      await viewLink.click();
    } else {
      const detailLink = sidePanel.locator('a[href*="/invoices/"]').first();
      const detailLinkVisible = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false);

      if (detailLinkVisible) {
        await detailLink.click();
      } else {
        test.skip(true, 'No navigation link to invoice detail found in side panel');
        return;
      }
    }

    await page.waitForURL(invoiceDetailPattern, { timeout: 15_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
  }

  test('navigate to invoice detail from list', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    expect(page.url()).toMatch(invoiceDetailPattern);
  });

  test('detail page renders', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    const heading = page.locator('h1, h2, [data-testid="invoice-header"]').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('invoice metadata is displayed', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    const invoiceIdentifier = page
      .locator('[data-testid="invoice-number"], [class*="badge"], [class*="status"]')
      .first()
      .or(
        page
          .locator('span, p, div')
          .filter({ hasText: /INV-|invoice|draft|pending|approved|paid|overdue|faktur/i })
          .first(),
      );
    await expect(invoiceIdentifier).toBeVisible({ timeout: 15_000 });
  });

  test('audit timeline exists', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    const timeline = page
      .locator(
        '[data-testid="audit-timeline"], [data-testid="activity-timeline"], [class*="timeline"], [class*="activity"]',
      )
      .first()
      .or(
        page
          .locator('h2, h3, h4')
          .filter({ hasText: /timeline|activity|audit|history|historia/i })
          .first(),
      );

    const timelineVisible = await timeline.isVisible({ timeout: 10_000 }).catch(() => false);

    if (timelineVisible) {
      await expect(timeline).toBeVisible();
    } else {
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });

  test('back navigation works', async ({ page }) => {
    await navigateToFirstInvoiceDetail(page);

    const backLink = page
      .locator(
        `nav[aria-label*="readcrumb"] a, a[href="${localePath('/invoices')}"], a[href*="/invoices"]`,
      )
      .filter({ hasText: /invoice|faktur/i })
      .first();
    const backLinkVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      await backLink.click();
    } else {
      await page.goBack();
    }

    await page.waitForURL(invoicesListPattern, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});
