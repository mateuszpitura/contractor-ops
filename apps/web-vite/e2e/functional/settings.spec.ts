import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
  waitForSidebar,
} from './helpers';

/**
 * Settings index smoke — Step 13 port from apps/web/e2e/functional/settings.spec.ts
 * Routes: /:locale/settings (Vite SPA, default locale pl).
 */
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/settings`);
    skipIfUnauthenticated(page);
  });

  test('settings page renders with tabs', async ({ page }) => {
    await expectPageHeading(page, /ustawienia|settings/i);
    await waitForSidebar(page);

    const tabTriggers = page.locator('[role="tablist"] [role="tab"]');
    await expect(tabTriggers.first()).toBeVisible({ timeout: 15_000 });

    const count = await tabTriggers.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('default tab is General', async ({ page }) => {
    const generalTab = page.locator('[role="tab"]', { hasText: /ogólne|general/i });
    await expect(generalTab).toBeVisible({ timeout: 15_000 });
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });
  });

  test('tab navigation updates URL', async ({ page }) => {
    const notificationsTab = page.locator('[role="tab"]', {
      hasText: /powiadomienia|notifications/i,
    });
    await expect(notificationsTab).toBeVisible({ timeout: 15_000 });
    await notificationsTab.click();

    await page.waitForURL(/tab=notifications/, { timeout: 10_000 });
    expect(page.url()).toMatch(/tab=notifications/);

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });
  });

  test('Approvals tab loads', async ({ page }) => {
    const approvalsTab = page.locator('[role="tab"]', { hasText: /akceptacje|approvals/i });
    await expect(approvalsTab).toBeVisible({ timeout: 15_000 });
    await approvalsTab.click();

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });

    const errorState = tabPanel.locator('[data-error], [role="alert"]');
    await expect(errorState).toHaveCount(0);
  });

  test('Integrations tab loads when visible', async ({ page }) => {
    const integrationsTab = page.locator('[role="tab"]', { hasText: /integracje|integrations/i });

    const isVisible = await integrationsTab.isVisible().catch(() => false);
    test.skip(!isVisible, 'Integrations tab not visible — user may lack admin permissions');

    await integrationsTab.click();

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });

    const errorState = tabPanel.locator('[data-error], [role="alert"]');
    await expect(errorState).toHaveCount(0);
  });
});
