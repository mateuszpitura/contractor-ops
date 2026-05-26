import { expect, test } from '@playwright/test';

import { E2E_LOCALE, localePath, navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Contract detail smoke — Step 13 batch 4 port from apps/web/e2e/functional/contract-detail.spec.ts
 * Routes: /:locale/contracts/:id (Vite SPA, default locale pl).
 */
test.describe('Contract detail page', () => {
  async function navigateToFirstContractDetail(page: import('@playwright/test').Page) {
    await navigateToDashboard(page, localePath('/contracts'));
    skipIfUnauthenticated(page);

    const firstRow = page.locator('table tbody tr').first();
    const hasData = await firstRow.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasData) {
      test.skip(true, 'No contract data available — skipping detail page test');
      return;
    }

    await firstRow.click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    const panelVisible = await sidePanel.isVisible({ timeout: 10_000 }).catch(() => false);

    if (panelVisible) {
      const viewLink = sidePanel
        .locator('a')
        .filter({ hasText: /view|detail|open|otwórz|umow/i })
        .first();
      const viewLinkVisible = await viewLink.isVisible({ timeout: 5_000 }).catch(() => false);

      if (viewLinkVisible) {
        await viewLink.click();
      } else {
        const detailLink = sidePanel.locator('a[href*="/contracts/"]').first();
        const detailLinkVisible = await detailLink.isVisible({ timeout: 3_000 }).catch(() => false);

        if (detailLinkVisible) {
          await detailLink.click();
        } else {
          test.skip(true, 'No navigation link to contract detail found in side panel');
          return;
        }
      }
    }

    await page.waitForURL(new RegExp(`/${E2E_LOCALE}/contracts/[^/]+`), { timeout: 15_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
  }

  test('navigate to contract detail from list', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    expect(page.url()).toMatch(new RegExp(`/${E2E_LOCALE}/contracts/[^/]+`));
  });

  test('detail page renders', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    const heading = page
      .locator('h1, h2, [data-testid="contract-header"], [data-testid="detail-header"]')
      .first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test('contract tabs are visible', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    const tabList = page.locator('[role="tablist"]').first();
    const tabListVisible = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (tabListVisible) {
      const tabs = page.locator('[role="tab"]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(2);
    } else {
      const navLinks = page
        .locator('nav a, [class*="tab"], [class*="nav-link"]')
        .filter({ hasText: /detail|amendment|signature|overview|szczeg|aneks|podpis|przegl/i });
      const navCount = await navLinks.count();
      expect(navCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('contract header shows status', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    const statusBadge = page
      .locator('[data-testid="status-badge"], [class*="badge"], [class*="status"]')
      .first()
      .or(
        page
          .locator('span, div')
          .filter({
            hasText:
              /draft|active|pending|signed|expired|terminated|in review|szkic|aktywn|oczekuj|podpis|wygas|rozwiąz/i,
          })
          .first(),
      );
    await expect(statusBadge).toBeVisible({ timeout: 15_000 });
  });

  test('back navigation works', async ({ page }) => {
    await navigateToFirstContractDetail(page);

    const backLink = page
      .locator(
        `nav[aria-label*="readcrumb"] a, a[href="/${E2E_LOCALE}/contracts"], a[href*="/contracts"]`,
      )
      .filter({ hasText: /umow|contract/i })
      .first();
    const backLinkVisible = await backLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (backLinkVisible) {
      await backLink.click();
    } else {
      await page.goBack();
    }

    await page.waitForURL(new RegExp(`/${E2E_LOCALE}/contracts(?:\\?|$)`), { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });
});
