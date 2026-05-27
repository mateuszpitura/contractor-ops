/**
 * Onboarding consent step — Phase 51 / Phase 56 · Plan 08 D-10.
 *
 * Ported from legacy `apps/web/src/components/consent/onboarding-consent-step.tsx`
 * (commit 62a97d73). Rewired for the Vite SPA:
 *   - tRPC/React-Query data fetching moved into `./hooks/use-onboarding-consent-step.ts`
 *     to satisfy `scripts/check-web-vite-data-layer.mjs`.
 *   - `next-intl#useLocale` → `../../i18n/navigation#useLocale`.
 *
 * UK / DE / AE / SA orgs render this step before the rest of onboarding;
 * everyone else short-circuits to `null` (return value of the outer
 * jurisdiction guard) so the wizard simply skips the consent slot.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ConsentPurpose } from '@contractor-ops/validators';
import {
  OPTIONAL_PURPOSES,
  REQUIRED_PURPOSES,
  requiresPrivacyAcknowledgement,
  resolveJurisdiction,
} from '@contractor-ops/validators';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { ConsentPurposeToggle } from './consent-purpose-toggle.js';
import { useOnboardingConsentStep } from './hooks/use-onboarding-consent-step.js';
import { PrivacyNoticeAcknowledgement } from './privacy-notice-acknowledgement.js';
import { PrivacyNoticeDisplay } from './privacy-notice-display.js';

interface OnboardingConsentStepProps {
  orgCountryCode: string | null | undefined;
  onComplete: () => void;
}

export function OnboardingConsentStep({ orgCountryCode, onComplete }: OnboardingConsentStepProps) {
  if (!requiresPrivacyAcknowledgement(orgCountryCode)) {
    return null;
  }

  return <ConsentStepContent orgCountryCode={orgCountryCode} onComplete={onComplete} />;
}

function ConsentStepContent({
  orgCountryCode,
  onComplete,
}: {
  orgCountryCode: string | null | undefined;
  onComplete: () => void;
}) {
  const t = useTranslations('Consent');
  const locale = useLocale();
  const jurisdiction = resolveJurisdiction(orgCountryCode);
  const jurisdictionUrl = `/${locale}/legal/privacy/${jurisdiction.toLowerCase()}`;

  const [consents, setConsents] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of [...REQUIRED_PURPOSES, ...OPTIONAL_PURPOSES]) {
      initial[p] = false;
    }
    return initial;
  });
  const [privacyAck, setPrivacyAck] = useState(false);
  const [ackError, setAckError] = useState<string | undefined>(undefined);

  const { notice, noticeLoading, submit, isSubmitting } = useOnboardingConsentStep(onComplete);

  const handleToggle = useCallback((purpose: ConsentPurpose, granted: boolean) => {
    setConsents(prev => ({ ...prev, [purpose]: granted }));
  }, []);

  const handleAckChange = useCallback((next: boolean) => {
    setPrivacyAck(next);
    if (next) setAckError(undefined);
  }, []);

  const allRequiredGranted = REQUIRED_PURPOSES.every(p => consents[p] === true);
  const canContinue = allRequiredGranted && privacyAck;

  const handleAccept = useCallback(() => {
    if (!privacyAck) {
      setAckError(t('privacyAcknowledgement.error'));
      return;
    }

    const consentEntries = Object.entries(consents)
      .filter(([, granted]) => granted)
      .map(([purpose]) => ({
        purpose: purpose as ConsentPurpose,
        granted: true as const,
      }));

    if (consentEntries.length === 0) return;

    submit({
      consents: consentEntries,
      privacyNoticeAcknowledged: true,
      privacyNoticeJurisdiction: jurisdiction,
      privacyNoticeVersion: 1,
    });
  }, [consents, submit, privacyAck, jurisdiction, t]);

  if (noticeLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && <PrivacyNoticeDisplay notice={notice} />}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t('onboarding.requiredConsents')}</h3>
        {REQUIRED_PURPOSES.map(purpose => (
          <ConsentPurposeToggle
            key={purpose}
            purpose={purpose}
            required={true}
            granted={consents[purpose] ?? false}
            onToggle={handleToggle}
          />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{t('onboarding.optionalConsents')}</h3>
        {OPTIONAL_PURPOSES.map(purpose => (
          <ConsentPurposeToggle
            key={purpose}
            purpose={purpose}
            required={false}
            granted={consents[purpose] ?? false}
            onToggle={handleToggle}
          />
        ))}
        <p className="text-xs text-muted-foreground">{t('onboarding.optionalNote')}</p>
      </div>

      <PrivacyNoticeAcknowledgement
        checked={privacyAck}
        onChange={handleAckChange}
        jurisdictionUrl={jurisdictionUrl}
        error={ackError}
      />

      <Button
        onClick={handleAccept}
        disabled={!canContinue || isSubmitting}
        aria-disabled={!canContinue || isSubmitting}
        className="w-full"
        size="lg">
        {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
        {t('onboarding.continue')}
      </Button>
    </div>
  );
}
