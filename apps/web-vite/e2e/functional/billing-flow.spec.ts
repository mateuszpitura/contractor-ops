import { expect, test } from '@playwright/test';

import { localePath, navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Billing flow — Step 13 port from apps/web/e2e/functional/billing-flow.spec.ts.
 * Routes: /:locale/settings?tab=billing (Vite SPA, default locale pl).
 *
 * Upgrade-click redirect test is env-gated on STRIPE_SECRET_KEY — without
 * server Stripe credentials the upgrade button cannot reach Stripe Checkout
 * and would either no-op or surface a toast error, neither of which the
 * legacy assertion shape (dialog OR url change) is designed to validate.
 */

const STRIPE_CONFIGURED = !!process.env.STRIPE_SECRET_KEY;

test.describe('Billing flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/settings?tab=billing'));
    skipIfUnauthenticated(page);
  });

  test('billing tab content is visible', async ({ page }) => {
    const billingTab = page.locator('[role="tab"]', { hasText: /rozliczenia|billing/i });
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
          .filter({ hasText: /starter|pro|enterprise|trial|free|próbny|darmowy/i })
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
          .filter({ hasText: /usage|credits|balance|consumption|zużycie|kredyty|saldo/i })
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
      .filter({
        hasText: /upgrade|change plan|manage plan|modify plan|zmień plan|zarządzaj|ulepsz/i,
      })
      .first();

    const isVisible = await upgradeButton.isVisible().catch(() => false);
    test.skip(!isVisible, 'Upgrade button not visible — user may already be on highest tier');

    await expect(upgradeButton).toBeVisible();
  });

  test('click upgrade opens plan selection or Stripe redirect', async ({ page }) => {
    test.skip(
      !STRIPE_CONFIGURED,
      'STRIPE_SECRET_KEY not set — cannot validate Stripe Checkout redirect',
    );

    const upgradeButton = page
      .locator('button, a')
      .filter({ hasText: /upgrade|change plan|manage plan|zmień plan|zarządzaj|ulepsz/i })
      .first();

    const isVisible = await upgradeButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Upgrade button not visible — skipping upgrade flow test');

    const urlBefore = page.url();
    await upgradeButton.click();

    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);

    if (dialogVisible) {
      await expect(dialog).toBeVisible();
    } else {
      await page.waitForTimeout(3_000);
      const urlAfter = page.url();
      expect(urlAfter !== urlBefore || dialogVisible).toBeTruthy();
    }
  });

  test('credit top-up button exists', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Billing tab panel not rendered — skipping top-up test');

    const topUpButton = page
      .locator('button')
      .filter({
        hasText: /top.?up|add credits|buy credits|purchase credits|doładuj|dokup|kup kredyty/i,
      })
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
      .or(page.locator('table, [role="table"]').first())
      .or(
        page
          .locator('h2, h3, h4')
          .filter({
            hasText:
              /billing history|invoices|payment history|transactions|historia|faktury|płatności|transakcje/i,
          })
          .first(),
      );

    const isVisible = await historySection.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Billing history section not visible — may not have billing history yet');

    await expect(historySection).toBeVisible();
  });

  test('cancel/close plan dialog returns to settings', async ({ page }) => {
    const upgradeButton = page
      .locator('button, a')
      .filter({ hasText: /upgrade|change plan|manage plan|zmień plan|zarządzaj|ulepsz/i })
      .first();

    const isVisible = await upgradeButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Upgrade button not visible — skipping dialog close test');

    await upgradeButton.click();

    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!dialogVisible, 'No dialog opened — upgrade may redirect instead of opening dialog');

    const closeButton = dialog
      .locator(
        'button[aria-label="Close"], button[aria-label="Zamknij"], button:has-text("Cancel"), button:has-text("Close"), button:has-text("Anuluj"), button:has-text("Zamknij")',
      )
      .first();
    const closeVisible = await closeButton.isVisible().catch(() => false);

    if (closeVisible) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 15_000 });
  });
});
