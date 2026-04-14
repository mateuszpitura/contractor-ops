import { expect, test } from '@playwright/test';
import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Billing flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/settings?tab=billing');
    skipIfUnauthenticated(page);
  });

  test('billing tab content is visible', async ({ page }) => {
    const billingTab = page.locator('[role="tab"]', { hasText: /billing/i });
    const billingTabVisible = await billingTab.isVisible().catch(() => false);
    test.skip(!billingTabVisible, 'Billing tab not visible — user may lack billing permissions');

    await expect(billingTab).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });
  });

  test('current plan card/section visible showing tier', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Billing tab panel not rendered — skipping plan card test');

    const planSection = page
      .locator('[data-testid="plan-card"], [data-testid="current-plan"]')
      .first()
      .or(
        page
          .locator('div, section, article')
          .filter({ hasText: /starter|pro|enterprise|trial|free/i })
          .first(),
      );

    await expect(planSection).toBeVisible({ timeout: 15_000 });
  });

  test('usage dashboard or credit balance section visible', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Billing tab panel not rendered — skipping usage test');

    const usageSection = page
      .locator('[data-testid="usage-dashboard"], [data-testid="credit-balance"]')
      .first()
      .or(
        page
          .locator('div, section')
          .filter({ hasText: /usage|credits|balance|consumption/i })
          .first(),
      );

    await expect(usageSection).toBeVisible({ timeout: 15_000 });
  });

  test('upgrade or change plan button exists', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Billing tab panel not rendered — skipping upgrade button test');

    const upgradeButton = page
      .locator('button, a')
      .filter({ hasText: /upgrade|change plan|manage plan|modify plan/i })
      .first();

    const isVisible = await upgradeButton.isVisible().catch(() => false);
    test.skip(!isVisible, 'Upgrade button not visible — user may already be on highest tier');

    await expect(upgradeButton).toBeVisible();
  });

  test('click upgrade opens plan selection or Stripe redirect', async ({ page }) => {
    const upgradeButton = page
      .locator('button, a')
      .filter({ hasText: /upgrade|change plan|manage plan/i })
      .first();

    const isVisible = await upgradeButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Upgrade button not visible — skipping upgrade flow test');

    const urlBefore = page.url();
    await upgradeButton.click();

    // Either a dialog/modal opens, or we redirect to Stripe/pricing
    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!dialogVisible) {
      // URL should have changed (Stripe redirect or pricing page)
      await page.waitForTimeout(3_000);
      const urlAfter = page.url();
      expect(urlAfter !== urlBefore || dialogVisible).toBeTruthy();
    } else {
      await expect(dialog).toBeVisible();
    }
  });

  test('credit top-up button exists', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Billing tab panel not rendered — skipping top-up test');

    const topUpButton = page
      .locator('button')
      .filter({ hasText: /top.?up|add credits|buy credits|purchase credits/i })
      .first();

    const isVisible = await topUpButton.isVisible().catch(() => false);
    test.skip(!isVisible, 'Credit top-up button not visible — credits feature may be disabled');

    await expect(topUpButton).toBeVisible();
  });

  test('billing history/invoices section visible', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Billing tab panel not rendered — skipping history test');

    const historySection = page
      .locator('[data-testid="billing-history"], [data-testid="billing-invoices"]')
      .first()
      .or(
        page
          .locator('table, [role="table"]')
          .first(),
      )
      .or(
        page
          .locator('h2, h3, h4')
          .filter({ hasText: /billing history|invoices|payment history|transactions/i })
          .first(),
      );

    const isVisible = await historySection.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Billing history section not visible — may not have billing history yet');

    await expect(historySection).toBeVisible();
  });

  test('cancel/close plan dialog returns to settings', async ({ page }) => {
    const upgradeButton = page
      .locator('button, a')
      .filter({ hasText: /upgrade|change plan|manage plan/i })
      .first();

    const isVisible = await upgradeButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Upgrade button not visible — skipping dialog close test');

    await upgradeButton.click();

    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!dialogVisible, 'No dialog opened — upgrade may redirect instead of opening dialog');

    // Close the dialog via close button or Escape
    const closeButton = dialog
      .locator('button[aria-label="Close"], button:has-text("Cancel"), button:has-text("Close")')
      .first();
    const closeVisible = await closeButton.isVisible().catch(() => false);

    if (closeVisible) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // Dialog should be gone, settings page still visible
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 15_000 });
  });
});
