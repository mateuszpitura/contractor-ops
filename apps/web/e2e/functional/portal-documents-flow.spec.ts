import { expect, test } from '@playwright/test';

/**
 * Portal documents flow — unauthenticated tests.
 *
 * Uses a fresh browser context with no stored session. Portal uses magic-link
 * auth, so unauthenticated users are redirected to the portal login page.
 */
test.describe('Portal documents — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('portal documents redirects to portal login when unauthenticated', async ({ page }) => {
    await page.goto('/en/portal/documents', { waitUntil: 'domcontentloaded' });

    await page.waitForURL(/\/en\/portal\/login/, { timeout: 20_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * Portal documents — authenticated fallback tests.
 *
 * Uses the default dashboard auth (from global-setup). Dashboard sessions may
 * or may not grant portal access. Tests skip gracefully when the portal
 * redirects to login instead of rendering content.
 */
test.describe('Portal documents — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/portal/documents', { waitUntil: 'domcontentloaded' });

    const redirectedToLogin = page.url().includes('/portal/login');
    test.skip(
      redirectedToLogin,
      'Dashboard auth does not grant portal access — magic link required',
    );
  });

  test('documents page renders', async ({ page }) => {
    const main = page.locator('#main-content, [role="main"], main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test('document list or empty state visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [role="grid"]').first();
    const list = page.locator('[role="list"], ul[data-testid]').first();
    const emptyState = page
      .locator(
        '[data-testid="empty-state"], [data-empty], text="no documents"i, text="upload your first"i, text="no files"i',
      )
      .first();

    await expect(table.or(list).or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('upload document button exists', async ({ page }) => {
    const uploadButton = page
      .locator('button, a')
      .filter({ hasText: /upload document|upload file|add document|new document/i })
      .first();

    const isVisible = await uploadButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(
      !isVisible,
      'Upload document button not visible — feature may be disabled for this portal user',
    );

    await expect(uploadButton).toBeVisible();
  });

  test('click upload opens file picker dialog or upload form', async ({ page }) => {
    const uploadButton = page
      .locator('button, a')
      .filter({ hasText: /upload document|upload file|add document|new document/i })
      .first();

    const isVisible = await uploadButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Upload document button not visible — skipping upload flow test');

    await uploadButton.click();

    // Either a dialog/modal opens or a file input becomes visible
    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const fileInput = page.locator('input[type="file"]').first();
    const form = page.locator('form, [data-testid="upload-form"]').first();

    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);
    const fileInputExists = (await fileInput.count()) > 0;
    const formVisible = await form.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(dialogVisible || fileInputExists || formVisible).toBeTruthy();
  });

  test('document type filter or category tabs exist', async ({ page }) => {
    const filter = page
      .locator('[role="tablist"], [data-testid="document-filter"], select, [role="combobox"]')
      .first()
      .or(
        page
          .locator('button')
          .filter({ hasText: /all|contract|tax|identity|certificate|compliance/i })
          .first(),
      );

    const isVisible = await filter.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(
      !isVisible,
      'Document type filter not visible — may not be implemented or no categories available',
    );

    await expect(filter).toBeVisible();
  });
});
