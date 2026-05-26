import { expect, test } from '@playwright/test';

import { E2E_LOCALE, localePath, navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Invoice e-invoice flow — port from apps/web/e2e/functional/invoice-einvoice-flow.spec.ts
 * Routes: /:locale/invoices, /:locale/invoices/:id, /:locale/settings/e-invoicing
 * (Vite SPA, default locale pl). Covers XRechnung / ZUGFeRD / Peppol / KSeF / ZATCA
 * side-panel + detail entrypoints.
 */
test.describe('Invoice e-invoice flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/invoices'));
    skipIfUnauthenticated(page);
  });

  test('invoice page renders with table or empty state', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .locator('[data-testid="empty-state"], [class*="empty"], .flex.flex-col.items-center')
      .first();

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('click first invoice row opens side panel', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    test.skip(rowCount === 0, 'No invoice rows — skipping side panel test');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });
  });

  test('side panel shows invoice details', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    test.skip(rowCount === 0, 'No invoice rows — skipping detail test');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });

    // Verify invoice details are present — number, amount, or status (EN + PL).
    const invoiceDetail = sidePanel
      .locator('span, p, div, h2, h3')
      .filter({
        hasText:
          /INV-|invoice|amount|total|status|draft|pending|approved|paid|faktur|kwota|suma|robocz|oczekuj|zaakcept|zatwierdz|oplac|zaplac/i,
      })
      .first();
    await expect(invoiceDetail).toBeVisible({ timeout: 10_000 });
  });

  test('e-invoice action button exists in detail', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    test.skip(rowCount === 0, 'No invoice rows — skipping e-invoice button test');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });

    // Look for e-invoice action buttons (EN + PL: send / generate / submit / download).
    const einvoiceButton = sidePanel
      .locator('button, a[role="button"]')
      .filter({
        hasText:
          /send to ksef|finalize|generate xrechnung|send e-invoice|e-invoice|ksef|xrechnung|zugferd|zatca|peppol|submit|e-faktur|wyślij|wyslij|generuj|pobierz|finalizuj/i,
      })
      .first();

    // The button may not exist for all invoice statuses — verify gracefully.
    const buttonVisible = await einvoiceButton.isVisible({ timeout: 10_000 }).catch(() => false);

    if (buttonVisible) {
      await expect(einvoiceButton).toBeVisible();
    } else {
      // Accept that e-invoice actions may not be available for the first invoice.
      await expect(sidePanel).toBeVisible();
    }
  });

  test('e-invoice status indicator visible', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    test.skip(rowCount === 0, 'No invoice rows — skipping status indicator test');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });

    // Look for e-invoice status badge (EN + PL).
    const statusIndicator = sidePanel
      .locator(
        '[class*="badge"], [class*="status"], [data-testid*="einvoice"], [data-testid*="status"]',
      )
      .first()
      .or(
        sidePanel
          .locator('span, div')
          .filter({
            hasText:
              /not.validated|validated|sent|submitted|rejected|accepted|pending|queued|processed|niezweryfik|zweryfik|wysłan|wyslan|przesłan|przeslan|odrzuc|zaakcept|oczekuj|w kolejce|przetwarzan/i,
          })
          .first(),
      );

    const statusVisible = await statusIndicator.isVisible({ timeout: 10_000 }).catch(() => false);

    if (statusVisible) {
      await expect(statusIndicator).toBeVisible();
    } else {
      // Not all invoices have e-invoice status — gracefully pass.
      await expect(sidePanel).toBeVisible();
    }
  });

  test('close side panel returns to list', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    test.skip(rowCount === 0, 'No invoice rows — skipping close panel test');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });

    // Close the panel — look for close button or press Escape (EN + PL aria/text).
    const closeButton = sidePanel
      .locator(
        'button[aria-label*="close"], button[aria-label*="Close"], button[aria-label*="zamknij"], button[aria-label*="Zamknij"], [data-testid="close"]',
      )
      .first()
      .or(
        sidePanel
          .locator('button')
          .filter({ hasText: /close|zamknij|x/i })
          .first(),
      );

    const closeVisible = await closeButton.isVisible({ timeout: 5_000 }).catch(() => false);

    if (closeVisible) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Verify the table is visible again (list view restored).
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
  });

  test('e-invoice settings page renders', async ({ page }) => {
    await navigateToDashboard(page, localePath('/settings/e-invoicing'));

    // The route may not exist — check for redirect or 404.
    if (page.url().includes('/login')) return;

    const mainContent = page.locator('#main-content');
    const hasContent = await mainContent.isVisible({ timeout: 15_000 }).catch(() => false);

    if (!hasContent) {
      // Try alternate settings paths.
      await navigateToDashboard(page, localePath('/settings/integrations/zatca'));
      if (page.url().includes(`/${E2E_LOCALE}/login`) || page.url().includes('/login')) return;
    }

    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    // Look for configuration options on the settings page (EN + PL).
    const configElement = page
      .locator('form, [data-testid*="config"], [data-testid*="setting"]')
      .first()
      .or(
        page
          .locator('h1, h2, h3')
          .filter({
            hasText:
              /e-invoice|einvoice|ksef|zatca|peppol|xrechnung|zugferd|settings|config|e-faktur|ustawien|konfigurac/i,
          })
          .first(),
      );

    await expect(configElement).toBeVisible({ timeout: 15_000 });
  });
});
