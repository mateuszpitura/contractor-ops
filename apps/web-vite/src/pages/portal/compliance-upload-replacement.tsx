/**
 * Portal compliance upload replacement — route shell with inlined page content.
 */

import type { PolicyRule } from '@contractor-ops/compliance-policy';
import { defaultExpiryFromUploadDate, listPolicyRules } from '@contractor-ops/compliance-policy';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useComplDocName } from '../../components/compliance/hooks/use-compl-doc-name.js';
import { usePortalUploadReplacement } from '../../components/portal/compliance/hooks/use-portal-upload-replacement.js';
import { PortalUploadReplacementForm } from '../../components/portal/compliance/portal-upload-replacement-form.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function findRule(policyRuleId: string | null): PolicyRule | undefined {
  if (!policyRuleId) return;
  return listPolicyRules().find(r => r.policyRuleId === policyRuleId);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function PortalUploadReplacementPageContent() {
  const t = useTranslations('Portal.compliance');
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get('itemId') ?? '';
  const policyRuleId = searchParams.get('policyRuleId');
  const { label } = useComplDocName(policyRuleId);
  const { submit, isSubmitting } = usePortalUploadReplacement();

  const defaultExpiresAt = useMemo(() => {
    const rule = findRule(policyRuleId);
    if (!rule || rule.expirySemantic === 'no_expiry') return '';
    try {
      return toIsoDate(defaultExpiryFromUploadDate(rule, new Date()));
    } catch {
      return '';
    }
  }, [policyRuleId]);

  if (!itemId) {
    return (
      <p role="alert" className="text-destructive">
        {t('upload.missingItem')}
      </p>
    );
  }

  return (
    <PortalUploadReplacementForm
      itemId={itemId}
      documentLabel={label || t('upload.fallbackDocument')}
      defaultExpiresAt={defaultExpiresAt}
      isSubmitting={isSubmitting}
      onSubmit={submit}
    />
  );
}

export default function PortalComplianceUploadReplacementPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalUploadReplacementPageContent />
    </Suspense>
  );
}
