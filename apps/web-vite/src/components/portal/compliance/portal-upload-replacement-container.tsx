import type { PolicyRule } from '@contractor-ops/compliance-policy';
import { defaultExpiryFromUploadDate, listPolicyRules } from '@contractor-ops/compliance-policy';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useComplDocName } from '../../compliance/hooks/use-compl-doc-name.js';
import { usePortalUploadReplacement } from './hooks/use-portal-upload-replacement.js';
import { PortalUploadReplacementForm } from './portal-upload-replacement-form.js';

function findRule(policyRuleId: string | null): PolicyRule | undefined {
  if (!policyRuleId) return;
  return listPolicyRules().find(r => r.policyRuleId === policyRuleId);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Reads the deep-link `?itemId` + `?policyRuleId` (search params live in the
 * container, not the page), auto-fills the default expiry from the policy rule
 * (D-07), and renders the upload-replacement form.
 */
export function PortalUploadReplacementContainer() {
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
