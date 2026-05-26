/**
 * Thin presentational wrapper around `useTranslatedError`. Use this in query
 * error UI states (cards, banners, full-page error screens) instead of
 * rendering `error.message` / `String(error)` directly. The hook + component
 * combination keeps every user-facing error string flowing through the
 * `Errors` i18n namespace.
 *
 * Default markup is a `role="alert"` span — meet the goal's WCAG floor
 * without locking callers into a heavy block element. Consumers can opt
 * into a different element via `asChild` in a future iteration; the
 * initial sweep does not need it.
 */

import type { ReactElement } from 'react';
import { useTranslatedError } from '../../i18n/use-translated-error.js';

export interface ApiErrorMessageProps {
  /** Anything `query.error` or a `catch (e)` block can hand back. */
  error: unknown;
  /** Optional `className` for layout-level overrides. */
  className?: string;
}

export function ApiErrorMessage({ error, className }: ApiErrorMessageProps): ReactElement {
  const translate = useTranslatedError();
  return (
    <span role="alert" className={className}>
      {translate(error)}
    </span>
  );
}
