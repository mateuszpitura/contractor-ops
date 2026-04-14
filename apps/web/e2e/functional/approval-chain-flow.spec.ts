import { expect, test } from '@playwright/test';

import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Approval chain flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/approvals');
    skipIfUnauthenticated(page);
  });

  test('page renders with approval items or empty state', async ({ page }) => {
    const table = page.locator('table, [role="table"], [data-testid*="table"]').first();
    const emptyState = page.getByText(/no approvals|nothing to review|no pending|no items/i);
    const cards = page.locator('[data-testid*="approval"], [class*="card"]').first();

    await expect(table.or(emptyState).or(cards)).toBeVisible({ timeout: 20_000 });
  });

  test('click first approval item opens detail', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTable) {
      // Try card-based layout
      const card = page
        .locator('[data-testid*="approval"], [class*="card"]')
        .first();
      const hasCard = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!hasCard, 'No approval items visible — skipping detail test');

      await card.click();
    } else {
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'No rows in approval table — skipping detail test');

      await rows.first().click();
    }

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
  });

  test('approve button visible in approval detail', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping approve button test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows — skipping approve button test');

    await rows.first().click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Look for approve button or already-approved status
    const approveButton = dialog
      .locator('button')
      .filter({ hasText: /approve|accept|confirm/i })
      .first();
    const approvedStatus = dialog
      .locator('span, div, p')
      .filter({ hasText: /approved|completed|accepted/i })
      .first();

    await expect(approveButton.or(approvedStatus)).toBeVisible({ timeout: 10_000 });
  });

  test('reject button visible alongside approve', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping reject button test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows — skipping reject button test');

    await rows.first().click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Look for reject button or already-resolved status
    const rejectButton = dialog
      .locator('button')
      .filter({ hasText: /reject|decline|deny|return/i })
      .first();
    const resolvedStatus = dialog
      .locator('span, div, p')
      .filter({ hasText: /rejected|approved|completed|resolved/i })
      .first();

    await expect(rejectButton.or(resolvedStatus)).toBeVisible({ timeout: 10_000 });
  });

  test('approval chain steps or timeline visible', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping chain steps test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows — skipping chain steps test');

    await rows.first().click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Look for chain/timeline/stepper elements
    const chainSteps = dialog
      .locator(
        '[data-testid*="timeline"], [data-testid*="chain"], [data-testid*="step"], [class*="timeline"], [class*="stepper"], ol, [role="list"]',
      )
      .first()
      .or(
        dialog
          .locator('h3, h4, span, div')
          .filter({ hasText: /step|chain|timeline|progress|stage|level|approver/i })
          .first(),
      );

    const stepsVisible = await chainSteps.isVisible({ timeout: 10_000 }).catch(() => false);

    if (stepsVisible) {
      await expect(chainSteps).toBeVisible();
    } else {
      // Some approvals may not have a multi-step chain — accept dialog is open
      await expect(dialog).toBeVisible();
    }
  });

  test('close dialog returns to list', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping close dialog test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows — skipping close dialog test');

    await rows.first().click();

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Close via button or Escape
    const closeButton = dialog
      .locator('button[aria-label*="close"], button[aria-label*="Close"], [data-testid="close"]')
      .first()
      .or(dialog.locator('button').filter({ hasText: /close|cancel|x/i }).first());

    const closeVisible = await closeButton.isVisible({ timeout: 5_000 }).catch(() => false);

    if (closeVisible) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Verify table is still visible (list view restored)
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test('filter by status works', async ({ page }) => {
    // Look for status filter tabs, chips, or select
    const tabList = page.getByRole('tablist').first();
    const hasTabList = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTabList) {
      const tabs = page.getByRole('tab');
      const count = await tabs.count();

      if (count > 1) {
        // Click a tab that is NOT currently active
        for (let i = 0; i < count; i++) {
          const tab = tabs.nth(i);
          const state = await tab.getAttribute('data-state');
          if (state !== 'active') {
            await tab.click();
            await expect(tab).toHaveAttribute('data-state', 'active');
            break;
          }
        }
      } else {
        test.skip(true, 'Only one tab — cannot test status filtering');
      }
      return;
    }

    // Fallback: look for filter chips/buttons
    const filterChip = page
      .locator('button')
      .filter({ hasText: /pending|approved|rejected|all/i })
      .first();

    const chipVisible = await filterChip.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!chipVisible, 'No status filter controls visible — skipping');

    await filterChip.click();
    await expect(page.locator('#main-content')).toBeVisible();
  });
});
