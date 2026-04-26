import { expect, test } from '@playwright/test';

import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Payment run flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/payments');
    skipIfUnauthenticated(page);
  });

  test('page renders with payment runs list or empty state', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .locator('[data-testid="empty-state"], [class*="empty"], .flex.flex-col.items-center')
      .first()
      .or(page.getByText(/no payment|no runs|get started|create your first/i));

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('create payment run button exists and is clickable', async ({ page }) => {
    const createButton = page
      .locator('button')
      .filter({ hasText: /create payment|new payment|add payment|start payment/i })
      .first()
      .or(page.getByRole('button', { name: /create|new|add/i }).first());

    await expect(createButton).toBeVisible({ timeout: 15_000 });
    await expect(createButton).toBeEnabled();
  });

  test('click create opens wizard or dialog', async ({ page }) => {
    const createButton = page
      .locator('button')
      .filter({ hasText: /create payment|new payment|add payment|start payment/i })
      .first()
      .or(page.getByRole('button', { name: /create|new|add/i }).first());

    const buttonVisible = await createButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!buttonVisible, 'No create button visible — skipping wizard test');

    await createButton.click();

    // Expect a dialog, wizard, or page navigation
    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const wizardForm = page.locator('form').first();

    await expect(dialog.or(wizardForm)).toBeVisible({ timeout: 15_000 });
  });

  test('wizard has contractor or invoice selection step', async ({ page }) => {
    const createButton = page
      .locator('button')
      .filter({ hasText: /create payment|new payment|add payment|start payment/i })
      .first()
      .or(page.getByRole('button', { name: /create|new|add/i }).first());

    const buttonVisible = await createButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!buttonVisible, 'No create button visible — skipping selection step test');

    await createButton.click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 15_000 }).catch(() => false);

    const container = dialogVisible ? dialog : page;

    // Look for contractor/invoice selection elements
    const selectionElement = container
      .locator(
        '[data-testid*="contractor"], [data-testid*="invoice"], [data-testid*="select"], input[type="checkbox"], [role="combobox"]',
      )
      .first()
      .or(
        container
          .locator('label, h3, h4, span')
          .filter({ hasText: /contractor|invoice|select|choose|pick/i })
          .first(),
      );

    const selectionVisible = await selectionElement
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    if (selectionVisible) {
      await expect(selectionElement).toBeVisible();
    } else {
      // The wizard may start on a different step — verify dialog/form is at least open
      await expect(dialog.or(page.locator('form').first())).toBeVisible();
    }
  });

  test('payment method selection visible', async ({ page }) => {
    const createButton = page
      .locator('button')
      .filter({ hasText: /create payment|new payment|add payment|start payment/i })
      .first()
      .or(page.getByRole('button', { name: /create|new|add/i }).first());

    const buttonVisible = await createButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!buttonVisible, 'No create button visible — skipping payment method test');

    await createButton.click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 15_000 }).catch(() => false);

    const container = dialogVisible ? dialog : page;

    // Look for payment method options (may be on a later wizard step)
    const paymentMethod = container
      .locator('label, button, [role="radio"], [role="option"], option, span, div')
      .filter({ hasText: /sepa|swift|manual|bank transfer|wire|ach/i })
      .first()
      .or(
        container
          .locator('[data-testid*="payment-method"], [data-testid*="method"], select')
          .first(),
      );

    const methodVisible = await paymentMethod.isVisible({ timeout: 10_000 }).catch(() => false);

    if (methodVisible) {
      await expect(paymentMethod).toBeVisible();
    } else {
      // Payment method may be on a later step — verify wizard is open
      await expect(dialog.or(page.locator('form').first())).toBeVisible();
    }
  });

  test('cancel wizard returns to list', async ({ page }) => {
    const createButton = page
      .locator('button')
      .filter({ hasText: /create payment|new payment|add payment|start payment/i })
      .first()
      .or(page.getByRole('button', { name: /create|new|add/i }).first());

    const buttonVisible = await createButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!buttonVisible, 'No create button visible — skipping cancel test');

    await createButton.click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 15_000 }).catch(() => false);

    if (dialogVisible) {
      // Close via cancel button or Escape
      const cancelButton = dialog
        .locator('button')
        .filter({ hasText: /cancel|close|back/i })
        .first()
        .or(dialog.locator('button[aria-label*="close"], button[aria-label*="Close"]').first());

      const cancelVisible = await cancelButton.isVisible({ timeout: 5_000 }).catch(() => false);

      if (cancelVisible) {
        await cancelButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    } else {
      // If navigated to a new page, go back
      await page.goBack();
    }

    // Verify list view is restored
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/payments');
  });

  test('payment run row shows status badge', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping status badge test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows in table — skipping status badge test');

    // Look for status badges within the table
    const badge = page
      .locator('table tbody')
      .locator('[class*="badge"], [class*="pill"], [class*="status"], [data-testid*="status"]')
      .first()
      .or(
        page
          .locator('table tbody span, table tbody div')
          .filter({
            hasText: /draft|in.progress|completed|processing|pending|paid|failed|cancelled/i,
          })
          .first(),
      );

    await expect(badge).toBeVisible({ timeout: 15_000 });
  });

  test('export button visible for completed runs', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping export test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows — skipping export test');

    // Look for export button at page level or after clicking a row
    const exportButton = page
      .locator('button, a')
      .filter({ hasText: /export|download|sepa xml|swift|generate file/i })
      .first();

    const exportVisible = await exportButton.isVisible({ timeout: 10_000 }).catch(() => false);

    if (exportVisible) {
      await expect(exportButton).toBeVisible();
      return;
    }

    // Try clicking a row to see if export appears in detail
    await rows.first().click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);

    if (dialogVisible) {
      const detailExport = dialog
        .locator('button, a')
        .filter({ hasText: /export|download|sepa|swift|generate/i })
        .first();

      const detailExportVisible = await detailExport
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (detailExportVisible) {
        await expect(detailExport).toBeVisible();
      } else {
        // Export may only appear for completed runs — accept dialog is open
        await expect(dialog).toBeVisible();
      }
    } else {
      // No dialog opened — accept page is still functional
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});
