'use client';

import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * UK/DE/PDPL privacy-notice acknowledgement gate (Phase 56 · Plan 08, D-10).
 *
 * Renders a shadcn/Base UI Checkbox + Label pair with an inline link to the
 * jurisdiction-specific privacy notice (opens in a new tab, `rel="noopener
 * noreferrer"`). The parent `OnboardingConsentStep` owns the `checked` state
 * and composes it into the Continue-button gate together with the required
 * consent purposes.
 *
 * Accessibility:
 * - `aria-required="true"` on the checkbox.
 * - Errors associated via `aria-describedby` and announced with `role="alert"`
 *   + `aria-live="polite"`.
 * - Link carries `rel="noopener noreferrer"` to prevent window.opener leakage.
 */
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrivacyNoticeAcknowledgement({
  checked,
  onChange,
  jurisdictionUrl,
  error,
}: PrivacyNoticeAcknowledgementProps) {
  const t = useTranslations('Consent.privacyAcknowledgement');
  const id = useId();
  const errorId = `${id}-privacy-ack-error`;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-privacy-ack`}
          name="privacyNoticeAcknowledged"
          checked={checked}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onCheckedChange={value => onChange(value === true)}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5"
        />
        <Label htmlFor={`${id}-privacy-ack`} className="text-sm leading-5 font-normal">
          {t.rich('label', {
            link: (chunks: React.ReactNode) => (
              <a
                href={jurisdictionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {chunks}
              </a>
            ),
          })}
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
