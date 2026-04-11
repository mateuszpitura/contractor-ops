"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { ConsentPurposeToggle } from "./consent-purpose-toggle";
import { PrivacyNoticeDisplay } from "./privacy-notice-display";
import {
  isPdplJurisdiction,
  REQUIRED_PURPOSES,
  OPTIONAL_PURPOSES,
} from "@contractor-ops/validators";
import type { ConsentPurpose } from "@contractor-ops/validators";

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

export function OnboardingConsentStep({
  orgCountryCode,
  onComplete,
}: OnboardingConsentStepProps) {
  const t = useTranslations("Consent");

  // Skip entirely for non-PDPL jurisdictions
  if (!isPdplJurisdiction(orgCountryCode)) {
    // Call onComplete on mount for non-PDPL orgs
    return null;
  }

  return <ConsentStepContent onComplete={onComplete} />;
}

// ---------------------------------------------------------------------------
// Inner content (only renders for PDPL jurisdictions)
// ---------------------------------------------------------------------------

function ConsentStepContent({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations("Consent");

  const [consents, setConsents] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of [...REQUIRED_PURPOSES, ...OPTIONAL_PURPOSES]) {
      initial[p] = false;
    }
    return initial;
  });

  const { data: notice, isLoading: noticeLoading } =
    trpc.consent.getPrivacyNotice.useQuery();

  const bulkGrantMutation = trpc.consent.bulkGrant.useMutation({
    onSuccess: () => {
      onComplete();
    },
  });

  const handleToggle = useCallback(
    (purpose: ConsentPurpose, granted: boolean) => {
      setConsents((prev) => ({ ...prev, [purpose]: granted }));
    },
    [],
  );

  const allRequiredGranted = REQUIRED_PURPOSES.every(
    (p) => consents[p] === true,
  );

  const handleAccept = useCallback(() => {
    const consentEntries = Object.entries(consents)
      .filter(([, granted]) => granted)
      .map(([purpose]) => ({
        purpose: purpose as ConsentPurpose,
        granted: true,
      }));

    if (consentEntries.length === 0) return;

    bulkGrantMutation.mutate({ consents: consentEntries });
  }, [consents, bulkGrantMutation]);

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
      {notice && <PrivacyNoticeDisplay notice={notice} />}

      {/* Required Consents */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">
          {t("onboarding.requiredConsents")}
        </h3>
        {REQUIRED_PURPOSES.map((purpose) => (
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
        <h3 className="text-sm font-semibold">
          {t("onboarding.optionalConsents")}
        </h3>
        {OPTIONAL_PURPOSES.map((purpose) => (
          <ConsentPurposeToggle
            key={purpose}
            purpose={purpose}
            required={false}
            granted={consents[purpose] ?? false}
            onToggle={handleToggle}
          />
        ))}
        <p className="text-xs text-muted-foreground">
          {t("onboarding.optionalNote")}
        </p>
      </div>

      {/* Accept Button */}
      <Button
        onClick={handleAccept}
        disabled={!allRequiredGranted || bulkGrantMutation.isPending}
        className="w-full"
        size="lg"
      >
        {bulkGrantMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {t("onboarding.acceptAndContinue")}
      </Button>
    </div>
  );
}
