/**
 * UK / DE / PDPL privacy-notice acknowledgement gate.
 *
 * The `t.rich('label', { link })` pattern is replaced by react-i18next's
 * `<Trans>` component, which resolves `<link>...</link>` markup in the
 * translation against the `components` map natively (the shared
 * `useTranslations` wrapper's `rich` is a flat-string stub — see
 * `apps/web-vite/src/i18n/useTranslations.ts`).
 *
 * Accessibility:
 *   - `aria-required="true"` on the checkbox.
 *   - Errors associated via `aria-describedby` and announced with
 *     `role="alert"` + `aria-live="polite"`.
 *   - Link carries `rel="noopener noreferrer"` to prevent window.opener leakage.
 */

import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useCallback, useId } from 'react';
import { Trans } from 'react-i18next';

export interface PrivacyNoticeAcknowledgementProps {
  /** Whether the user has ticked the acknowledgement box. */
  checked: boolean;
  /** Called with the next checked value whenever the checkbox toggles. */
  onChange: (checked: boolean) => void;
  /**
   * Localised URL to the jurisdiction-specific privacy notice. Example:
   * `/de/legal/privacy/de` or `/en/legal/privacy/gb`.
   */
  jurisdictionUrl: string;
  /** Optional error message rendered below the checkbox. */
  error?: string;
}

export function PrivacyNoticeAcknowledgement({
  checked,
  onChange,
  jurisdictionUrl,
  error,
}: PrivacyNoticeAcknowledgementProps) {
  const id = useId();
  const errorId = `${id}-privacy-ack-error`;
  const handleCheckedChange = useCallback((value: boolean) => onChange(value === true), [onChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-privacy-ack`}
          name="privacyNoticeAcknowledged"
          checked={checked}
          onCheckedChange={handleCheckedChange}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5"
        />
        <Label htmlFor={`${id}-privacy-ack`} className="text-sm leading-5 font-normal">
          <Trans
            i18nKey="Consent.privacyAcknowledgement.label"
            components={{
              link: (
                <a
                  href={jurisdictionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              ),
            }}
          />
        </Label>
      </div>
      {error ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
