'use client';

import type { ConsentPurpose } from '@contractor-ops/validators';
import {
  OPTIONAL_PURPOSES,
  REQUIRED_PURPOSES,
  requiresPrivacyAcknowledgement,
  resolveJurisdiction,
} from '@contractor-ops/validators';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/trpc/init';
import { ConsentPurposeToggle } from './consent-purpose-toggle';
import { PrivacyNoticeAcknowledgement } from './privacy-notice-acknowledgement';
import { PrivacyNoticeDisplay } from './privacy-notice-display';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingConsentStepProps {
  orgCountryCode: string | null | undefined;
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Phase 51 consent step — extended in Phase 56 · Plan 08 (D-10) to gate
 * onboarding for UK + DE orgs in addition to the existing AE/SA (PDPL)
 * flow. UK/DE orgs render a privacy-notice acknowledgement checkbox that
 * must be ticked before the Continue button activates.
 */
export function OnboardingConsentStep({ orgCountryCode, onComplete }: OnboardingConsentStepProps) {
  // Skip entirely for jurisdictions that do not require onboarding consent.
  if (!requiresPrivacyAcknowledgement(orgCountryCode)) {
    return null;
  }

  return <ConsentStepContent orgCountryCode={orgCountryCode} onComplete={onComplete} />;
}

// ---------------------------------------------------------------------------
// Inner content (only renders for jurisdictions requiring acknowledgement)
// ---------------------------------------------------------------------------

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

  const { data: notice, isLoading: noticeLoading } = useQuery(
    trpc.consent.getPrivacyNotice.queryOptions(),
  );

  const bulkGrantMutation = useMutation(
    trpc.consent.bulkGrant.mutationOptions({
      onSuccess: () => {
        onComplete();
      },
    }),
  );

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
        granted: true,
      }));

    if (consentEntries.length === 0) return;

    bulkGrantMutation.mutate({
      consents: consentEntries,
      privacyNoticeAcknowledged: true,
      privacyNoticeJurisdiction: jurisdiction,
      privacyNoticeVersion: 1,
    });
  }, [consents, bulkGrantMutation, privacyAck, jurisdiction, t]);

  if (noticeLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Privacy Notice */}
      {!!notice && <PrivacyNoticeDisplay notice={notice} />}

      {/* Required Consents */}
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

      {/* Optional Consents */}
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

      {/* Privacy Notice Acknowledgement (UK/DE + PDPL) */}
      <PrivacyNoticeAcknowledgement
        checked={privacyAck}
        onChange={handleAckChange}
        jurisdictionUrl={jurisdictionUrl}
        error={ackError}
      />

      {/* Continue / Weiter Button */}
      <Button
        onClick={handleAccept}
        disabled={!canContinue || bulkGrantMutation.isPending}
        aria-disabled={!canContinue || bulkGrantMutation.isPending}
        className="w-full"
        size="lg">
        {bulkGrantMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
        {t('onboarding.continue')}
      </Button>
    </div>
  );
}
