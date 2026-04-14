import { expect, test } from '@playwright/test';
import {
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
  waitForSidebar,
} from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/settings');
    skipIfUnauthenticated(page);
  });

  test('settings page renders with tabs', async ({ page }) => {
    await expectPageHeading(page, /settings/i);
    await waitForSidebar(page);

    const tabTriggers = page.locator('[role="tablist"] [role="tab"]');
    await expect(tabTriggers.first()).toBeVisible({ timeout: 15_000 });

    const count = await tabTriggers.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('default tab is General', async ({ page }) => {
    const generalTab = page.locator('[role="tab"]', { hasText: /general/i });
    await expect(generalTab).toBeVisible({ timeout: 15_000 });
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');

    // General tab panel content should be visible
    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });
  });

  test('tab navigation updates URL', async ({ page }) => {
    const notificationsTab = page.locator('[role="tab"]', { hasText: /notifications/i });
    await expect(notificationsTab).toBeVisible({ timeout: 15_000 });
    await notificationsTab.click();

    // URL should reflect the selected tab via nuqs query param
    await page.waitForURL(/tab=notifications/, { timeout: 10_000 });
    expect(page.url()).toMatch(/tab=notifications/);

    // Tab panel should update
    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });
  });

  test('Approvals tab loads', async ({ page }) => {
    const approvalsTab = page.locator('[role="tab"]', { hasText: /approvals/i });
    await expect(approvalsTab).toBeVisible({ timeout: 15_000 });
    await approvalsTab.click();

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });

    // Verify no error state within the panel
    const errorState = tabPanel.locator('[data-error], [role="alert"]');
    await expect(errorState).toHaveCount(0);
  });

  test('Integrations tab loads', async ({ page }) => {
    const integrationsTab = page.locator('[role="tab"]', { hasText: /integrations/i });

    // Tab may be hidden for non-admin users
    const isVisible = await integrationsTab.isVisible().catch(() => false);
    test.skip(!isVisible, 'Integrations tab not visible — user may lack admin permissions');

    await integrationsTab.click();

    const tabPanel = page.locator('[role="tabpanel"]');
    await expect(tabPanel).toBeVisible({ timeout: 15_000 });

    const errorState = tabPanel.locator('[data-error], [role="alert"]');
    await expect(errorState).toHaveCount(0);
  });

  test('settings tabs are keyboard navigable', async ({ page }) => {
    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    // Focus the first tab
    const firstTab = page.locator('[role="tab"]').first();
    await firstTab.focus();
    await expect(firstTab).toBeFocused();

    // Arrow right should move focus to the next tab
    await page.keyboard.press('ArrowRight');

    const secondTab = page.locator('[role="tab"]').nth(1);
    await expect(secondTab).toBeFocused();

    // Enter/Space should activate the focused tab
    await page.keyboard.press('Enter');
    await expect(secondTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
  });
});
