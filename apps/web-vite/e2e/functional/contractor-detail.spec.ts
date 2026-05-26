import { expect, test } from '@playwright/test';

import { E2E_LOCALE, localePath, navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Contractor detail smoke — Step 13 batch 4 port from apps/web/e2e/functional/contractor-detail.spec.ts
 * Routes: /:locale/contractors/:id (Vite SPA, default locale pl).
 */
test.describe('Contractor detail page', () => {
  async function navigateToFirstContractorDetail(page: import('@playwright/test').Page) {
    await navigateToDashboard(page, localePath('/contractors'));
    skipIfUnauthenticated(page);

    const firstRow = page.locator('table tbody tr').first();
    const hasData = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasData) {
      test.skip(true, 'No contractor data available — skipping detail page test');
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
      .filter({ hasText: /view|detail|open|profile|otwórz|profil/i })
      .first();
    const viewLinkVisible = await viewLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (viewLinkVisible) {
      await viewLink.click();
    } else {
      const detailLink = sidePanel.locator('a[href*="/contractors/"]').first();
      const detailLinkVisible = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false);

      if (detailLinkVisible) {
        await detailLink.click();
      } else {
        test.skip(true, 'No navigation link to contractor detail found in side panel');
        return;
      }
    }

    await page.waitForURL(new RegExp(`/${E2E_LOCALE}/contractors/[^/]+`), { timeout: 15_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
  }

  test('navigate to contractor detail from list', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    expect(page.url()).toMatch(new RegExp(`/${E2E_LOCALE}/contractors/[^/]+`));
  });

  test('detail page renders with profile header', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    const profileHeader = page
      .locator('h1, h2, [data-testid="profile-header"], [class*="profile-header"]')
      .first();
    await expect(profileHeader).toBeVisible({ timeout: 15_000 });
  });

  test('profile tabs are visible', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    const tabList = page.locator('[role="tablist"]').first();
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);
  });

  test('tab switching works', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    test.skip(tabCount < 2, 'Not enough tabs to test switching');

    const secondTab = tabs.nth(1);

    await secondTab.click();

    await expect(secondTab)
      .toHaveAttribute('data-state', 'active', { timeout: 5_000 })
      .catch(async () => {
        await expect(secondTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
      });

    const tabPanel = page.locator('[role="tabpanel"]').first();
    await expect(tabPanel).toBeVisible({ timeout: 10_000 });
  });

  test('back navigation works', async ({ page }) => {
    await navigateToFirstContractorDetail(page);

    const backLink = page
      .locator(
        `nav[aria-label*="readcrumb"] a, a[href="/${E2E_LOCALE}/contractors"], a[href*="/contractors"]`,
      )
      .filter({ hasText: /kontrahent|contractor/i })
      .first();
    const backLinkVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      await backLink.click();
    } else {
      await page.goBack();
    }

    await page.waitForURL(new RegExp(`/${E2E_LOCALE}/contractors(?:\\?|$)`), { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});
