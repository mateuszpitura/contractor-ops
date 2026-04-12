import type { Page } from '@playwright/test';
import { test } from '@playwright/test';

export function skipIfUnauthenticated(page: Page) {
  // biome-ignore lint/suspicious/noSkippedTests: conditional skip based on auth state — not a disabled test
  test.skip(
    page.url().includes('/login'),
    'Set E2E_EMAIL and E2E_PASSWORD (see e2e/perf/README.md) so global setup can log in.',
  );
}
