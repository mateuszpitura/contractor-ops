/**
 * Shared render harness for `@contractor-ops/ui` shadcn primitive tests.
 *
 * Mirrors the surface of `apps/web/src/test/test-utils.tsx` so the ported
 * shadcn tests change ONLY their import path (`@/test/test-utils` →
 * `./test-utils`). API kept intentionally narrow — primitives don't need
 * NextIntlClientProvider or QueryClientProvider; `useUITranslations()`
 * falls back to English defaults when no provider is mounted, so most
 * primitive tests render directly without wrapping.
 *
 * Tests that exercise a localized override pass a translator via
 * `<UITranslationsProvider t={...}>` in the test body.
 */

import type { RenderOptions, RenderResult } from '@testing-library/react';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';

export type { RenderResult } from '@testing-library/react';

export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return rtlRender(ui, options);
}

/**
 * Renders the tree and returns a `user` instance from `user-event` so
 * tests can interact via realistic keyboard/pointer events.
 */
export function setup(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  const utils = rtlRender(ui, options);
  return { user, ...utils };
}

export { screen, waitFor };
