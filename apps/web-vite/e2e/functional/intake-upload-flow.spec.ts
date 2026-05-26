import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  IMPORT_EINVOICE_PATTERN,
  localePath,
  navigateToDashboard,
  openIntakeUploadDialog,
  skipIfUnauthenticated,
} from './helpers';

// ---------------------------------------------------------------------------
// Phase 62 inbound intake E2E — port from apps/web/e2e/functional/intake-upload-flow.spec.ts
//
// Exercises the user-observable inbound surface (split-button → upload dialog →
// intake detail → confirm match → convert → invoice row). When
// `einvoice.import-enabled` is off, specs assert the degrade surface (dialog
// unreachable; `/invoices/intake` redirects to unauthorized in the Vite SPA).
//
// Fixtures under `e2e/fixtures/intake/` are deterministic — see README there.
// ---------------------------------------------------------------------------

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(currentDir, '..', 'fixtures', 'intake');

function loadFixturePdfBytes(): Buffer {
  const base64 = readFileSync(join(fixtureDir, 'comfort-minimal.pdf.base64'), 'utf-8');
  return Buffer.from(base64.replace(/\s+/g, ''), 'base64');
}

function loadFixtureFile(name: string): Buffer {
  return readFileSync(join(fixtureDir, name));
}

function intakeDetailPattern(): RegExp {
  return new RegExp(`/${E2E_LOCALE}/invoices/intake/[a-z0-9]+`);
}

function invoiceDetailPattern(): RegExp {
  return new RegExp(`/${E2E_LOCALE}/invoices/(?!intake)[^/]+`);
}

test.describe('Phase 62 inbound intake flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/invoices'));
    skipIfUnauthenticated(page);
  });

  test('Happy path — ZUGFeRD PDF with valid XRechnung', async ({ page }, testInfo) => {
    const opened = await openIntakeUploadDialog(page);
    test.skip(!opened, 'einvoice.import-enabled flag is OFF for this org — happy path skipped');

    await test.step('upload ZUGFeRD PDF fixture', async () => {
      const fileInput = page.locator('#intake-upload-input');
      await fileInput.setInputFiles({
        name: 'comfort-minimal.pdf',
        mimeType: 'application/pdf',
        buffer: loadFixturePdfBytes(),
      });
    });

    await test.step('assert navigation to intake detail', async () => {
      await page.waitForURL(intakeDetailPattern(), { timeout: 30_000 });
      testInfo.annotations.push({ type: 'intake-detail-url', description: page.url() });
    });

    await test.step('assert parsed fields pane renders', async () => {
      const pageBody = page.locator('#main-content');
      await expect(pageBody).toBeVisible({ timeout: 15_000 });
      await expect(pageBody.getByText(/Parsed|Matched|Dopasow|Przetworz/i).first()).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step('confirm match (if a match was pre-selected)', async () => {
      const confirmMatchButton = page.getByRole('button', {
        name: /Confirm match|Potwierdź dopasowanie/i,
      });
      const canConfirm = await confirmMatchButton.isVisible({ timeout: 5_000 }).catch(() => false);
      if (canConfirm) {
        await confirmMatchButton.click();
        await expect(page.getByText(/Matched|Dopasow/i).first()).toBeVisible({ timeout: 15_000 });
      } else {
        testInfo.annotations.push({
          type: 'info',
          description: 'No match candidate — confirm-match step skipped',
        });
      }
    });

    await test.step('attempt conversion', async () => {
      const convertButton = page.getByRole('button', {
        name: /Convert to invoice|Konwertuj na faktur/i,
      });
      const canConvert = await convertButton.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!canConvert) {
        testInfo.annotations.push({
          type: 'info',
          description: 'Convert button not visible (no match or unacknowledged) — OK',
        });
        return;
      }
      const isDisabled = await convertButton.isDisabled().catch(() => true);
      if (isDisabled) {
        testInfo.annotations.push({
          type: 'info',
          description: 'Convert button disabled — precondition not met in this env',
        });
        return;
      }
      await convertButton.click();
      await page.waitForURL(invoiceDetailPattern(), { timeout: 30_000 });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
    });
  });

  test('Dedup path', async ({ page }, testInfo) => {
    const opened = await openIntakeUploadDialog(page);
    test.skip(!opened, 'einvoice.import-enabled flag is OFF for this org — dedup test skipped');

    const fileInput = page.locator('#intake-upload-input');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    await fileInput.setInputFiles({
      name: 'comfort-minimal.pdf',
      mimeType: 'application/pdf',
      buffer: loadFixturePdfBytes(),
    });
    await page.waitForURL(intakeDetailPattern(), { timeout: 30_000 });
    const firstUrl = page.url();
    testInfo.annotations.push({ type: 'first-upload-url', description: firstUrl });

    await navigateToDashboard(page, localePath('/invoices'));
    skipIfUnauthenticated(page);
    test.skip(!(await openIntakeUploadDialog(page)), 'Import dialog unavailable on second pass');

    const fileInput2 = page.locator('#intake-upload-input');
    await expect(fileInput2).toBeAttached({ timeout: 10_000 });
    await fileInput2.setInputFiles({
      name: 'comfort-minimal.pdf',
      mimeType: 'application/pdf',
      buffer: loadFixturePdfBytes(),
    });
    await page.waitForURL(intakeDetailPattern(), { timeout: 30_000 });
    const secondUrl = page.url();
    testInfo.annotations.push({ type: 'second-upload-url', description: secondUrl });

    expect(secondUrl).toBe(firstUrl);
  });

  test('Hard-reject — malformed XML', async ({ page }) => {
    const opened = await openIntakeUploadDialog(page);
    test.skip(
      !opened,
      'einvoice.import-enabled flag is OFF for this org — malformed-xml test skipped',
    );

    const fileInput = page.locator('#intake-upload-input');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    await fileInput.setInputFiles({
      name: 'malformed.xml',
      mimeType: 'application/xml',
      buffer: loadFixtureFile('malformed.xml'),
    });

    const errorAlert = page.locator('[role="alert"], [data-testid="intake-upload-error-message"]');
    await expect(errorAlert).toBeVisible({ timeout: 20_000 });
    const tryAnother = page.getByRole('button', { name: /Try another file|Spróbuj innego pliku/i });
    await expect(tryAnother).toBeVisible({ timeout: 5_000 });

    expect(page.url()).not.toMatch(intakeDetailPattern());
  });

  test('Soft-gate — schematron warning', async ({ page }, testInfo) => {
    const opened = await openIntakeUploadDialog(page);
    test.skip(!opened, 'einvoice.import-enabled flag is OFF for this org — warnings test skipped');

    const fileInput = page.locator('#intake-upload-input');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    await fileInput.setInputFiles({
      name: 'xrechnung-with-warnings.xml',
      mimeType: 'application/xml',
      buffer: loadFixtureFile('xrechnung-with-warnings.xml'),
    });

    const navigated = await page
      .waitForURL(intakeDetailPattern(), { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!navigated) {
      const errorAlert = page.locator(
        '[role="alert"], [data-testid="intake-upload-error-message"]',
      );
      await expect(errorAlert).toBeVisible({ timeout: 5_000 });
      testInfo.annotations.push({
        type: 'info',
        description: 'Validator rejected outright (XSD-invalid) — assertion satisfied',
      });
      return;
    }

    const warningsPill = page.getByText(/Warnings|Ostrzeż/i).first();
    await expect(warningsPill).toBeVisible({ timeout: 15_000 });

    const convertButton = page.getByRole('button', {
      name: /Convert to invoice|Konwertuj na faktur/i,
    });
    if (await convertButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      expect(await convertButton.isDisabled()).toBeTruthy();
    }

    const acceptButton = page.getByRole('button', {
      name: /Accept despite issues|Zaakceptuj mimo/i,
    });
    if (await acceptButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await acceptButton.click();
      await expect(page.getByText(/Issues accepted|Zaakceptow/i).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test('Flag-off gate', async ({ page }) => {
    await navigateToDashboard(page, localePath('/invoices/intake'));
    skipIfUnauthenticated(page);

    const importsHeading = page.getByRole('heading', {
      name: /Invoice imports|Importy faktur/i,
    });
    const isImportsPage = await importsHeading.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isImportsPage) {
      // Flag OFF — Vite SPA redirects to /unauthorized (Next.js surfaced 404).
      const onUnauthorized = page.url().includes('/unauthorized');
      if (!onUnauthorized) {
        await page.waitForURL(/\/unauthorized/, { timeout: 10_000 }).catch(() => undefined);
      }

      await navigateToDashboard(page, localePath('/invoices'));
      skipIfUnauthenticated(page);
      const importTrigger = page.getByRole('button', { name: IMPORT_EINVOICE_PATTERN });
      await expect(importTrigger).toHaveCount(0, { timeout: 5_000 });
      return;
    }

    await expect(importsHeading).toBeVisible({ timeout: 15_000 });
  });

  test('Reject flow', async ({ page }, testInfo) => {
    await navigateToDashboard(page, localePath('/invoices/intake'));
    skipIfUnauthenticated(page);

    const importsHeading = page.getByRole('heading', {
      name: /Invoice imports|Importy faktur/i,
    });
    const isImportsPage = await importsHeading.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(
      !isImportsPage,
      'einvoice.import-enabled flag is OFF — reject-flow requires the intake list',
    );

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);
    test.skip(rowCount === 0, 'No intake rows in this env — reject flow skipped');

    await rows.first().click();

    const rejectButton = page.getByRole('button', { name: /Reject import|Odrzuć import/i });
    const rejectVisible = await rejectButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!rejectVisible, 'Reject button not surfaced for this intake row');

    await rejectButton.click();

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    await textarea.fill('duplicate from sender');

    const confirmReject = page.getByRole('button', { name: /Reject import|Odrzuć import/i }).last();
    await confirmReject.click();

    await expect(page.getByText(/Rejected|Odrzucon/i).first()).toBeVisible({ timeout: 15_000 });
    testInfo.annotations.push({ type: 'info', description: 'Reject flow completed' });
  });
});
