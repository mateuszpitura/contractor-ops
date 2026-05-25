/**
 * Legacy `pdf-preview` view test — superseded by the hook test at
 * `apps/web-vite/src/components/documents/hooks/__tests__/use-pdf-preview.test.tsx`.
 *
 * The presentational `<PdfPreviewView>` is now purely props-driven (URL +
 * loading flag), so the data-fetching contract lives entirely in the hook
 * and is exercised there. Keeping a skip-stub for grep parity with the
 * legacy port set.
 */

import { describe } from 'vitest';

describe.skip('[SUPERSEDED] pdf-preview view — see hooks/__tests__/use-pdf-preview.test.tsx', () => {
  // Intentionally empty.
});
