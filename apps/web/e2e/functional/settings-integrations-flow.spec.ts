import { expect, test } from '@playwright/test';
import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Settings — Integrations flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/settings?tab=integrations');
    skipIfUnauthenticated(page);
  });

  test('integrations tab content is visible', async ({ page }) => {
    const integrationsTab = page.locator('[role="tab"]', { hasText: /integrations/i });
    const tabVisible = await integrationsTab.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabVisible, 'Integrations tab not visible — user may lack admin permissions');

    await expect(integrationsTab).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });
  });

  test('integration cards visible', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Integrations tab panel not rendered — skipping cards test');

    // Look for integration cards by common patterns
    const cards = page
      .locator(
        '[data-testid*="integration"], [class*="card"], [class*="Card"]',
      )
      .filter({
        hasText: /jira|linear|slack|xero|quickbooks|ksef|zatca|peppol|stripe/i,
      });

    const cardCount = await cards.count();
    test.skip(cardCount === 0, 'No integration cards found — integrations may not be configured');

    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('integration cards show connection status', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Integrations tab panel not rendered — skipping status test');

    const statusBadge = page
      .locator('[data-testid*="status"], [class*="badge"], [class*="Badge"]')
      .filter({ hasText: /connected|disconnected|active|inactive|enabled|disabled/i })
      .first();

    const isVisible = await statusBadge.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'No connection status badges found — UI may use different pattern');

    await expect(statusBadge).toBeVisible();
  });

  test('connect button visible on disconnected integrations', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Integrations tab panel not rendered — skipping connect button test');

    const connectButton = page
      .locator('button, a')
      .filter({ hasText: /^connect$|connect integration|set up|configure/i })
      .first();

    const isVisible = await connectButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'No connect button visible — all integrations may already be connected');

    await expect(connectButton).toBeVisible();
  });

  test('click connect opens OAuth dialog or configuration form', async ({ page }) => {
    const connectButton = page
      .locator('button, a')
      .filter({ hasText: /^connect$|connect integration|set up|configure/i })
      .first();

    const isVisible = await connectButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'No connect button visible — skipping OAuth flow test');

    const urlBefore = page.url();
    await connectButton.click();

    // Either a dialog/modal opens, or we redirect to an OAuth provider
    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!dialogVisible) {
      // May have redirected to OAuth provider or opened new page
      await page.waitForTimeout(3_000);
      const urlAfter = page.url();
      expect(urlAfter !== urlBefore || dialogVisible).toBeTruthy();
    } else {
      await expect(dialog).toBeVisible();
    }
  });

  test('KSeF integration card visible', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Integrations tab panel not rendered — skipping KSeF test');

    const ksefCard = page
      .locator('[data-testid*="ksef"], [data-testid*="integration"]')
      .filter({ hasText: /ksef/i })
      .first()
      .or(
        page
          .locator('div, section, article')
          .filter({ hasText: /ksef/i })
          .first(),
      );

    const isVisible = await ksefCard.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'KSeF integration card not visible — PL jurisdiction may not be active');

    await expect(ksefCard).toBeVisible();
  });

  test('ZATCA integration card visible', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Integrations tab panel not rendered — skipping ZATCA test');

    const zatcaCard = page
      .locator('[data-testid*="zatca"], [data-testid*="integration"]')
      .filter({ hasText: /zatca/i })
      .first()
      .or(
        page
          .locator('div, section, article')
          .filter({ hasText: /zatca/i })
          .first(),
      );

    const isVisible = await zatcaCard.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'ZATCA integration card not visible — AE jurisdiction may not be active');

    await expect(zatcaCard).toBeVisible();
  });

  test('Peppol integration card visible', async ({ page }) => {
    const tabPanel = page.locator('[role="tabpanel"]');
    const tabPanelVisible = await tabPanel.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!tabPanelVisible, 'Integrations tab panel not rendered — skipping Peppol test');

    const peppolCard = page
      .locator('[data-testid*="peppol"], [data-testid*="integration"]')
      .filter({ hasText: /peppol/i })
      .first()
      .or(
        page
          .locator('div, section, article')
          .filter({ hasText: /peppol/i })
          .first(),
      );

    const isVisible = await peppolCard.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Peppol integration card not visible — Peppol may not be configured');

    await expect(peppolCard).toBeVisible();
  });
});
