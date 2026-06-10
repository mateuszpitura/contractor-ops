import { isComplDocNamePending } from '@contractor-ops/validators';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export interface ComplDocName {
  /** Per-locale display name resolved from `compliance.docName.<jx>.<ns>`. */
  label: string;
  /** True while the locked phrase still awaits legal sign-off. */
  isPending: boolean;
}

/**
 * Resolves a contractor compliance document's per-locale display name from a
 * `policyRuleId`.
 *
 * `policyRuleId` form: `<jurisdiction>.<stable-namespace>@v<N>` (e.g.
 * `uk.right_to_work@v1`). The message key drops the `@vN` suffix:
 * `compliance.docName.uk.right_to_work`. Falls back to the stable namespace
 * itself if the key is missing (never throws — i18next returns the key).
 *
 * `isPending` mirrors the signoff registry so callers can append a
 * PENDING-subscript footnote until per-jurisdiction legal review lands.
 */
export function useComplDocName(policyRuleId: string | null | undefined): ComplDocName {
  // Reuses the per-locale doc-name catalog:
  // `Compliance.documentType.compliance-policy-engine.<jx>.<stable-namespace>`.
  const t = useTranslations('Compliance.documentType.compliance-policy-engine');
  if (!policyRuleId) {
    return { label: '', isPending: false };
  }
  const withoutVersion = policyRuleId.split('@')[0] ?? policyRuleId;
  const firstDot = withoutVersion.indexOf('.');
  const jurisdiction = firstDot >= 0 ? withoutVersion.slice(0, firstDot) : withoutVersion;
  const stableNamespace = firstDot >= 0 ? withoutVersion.slice(firstDot + 1) : withoutVersion;
  // tDynLoose joins `<jx>.<ns>`; i18next returns the joined key on a miss, so
  // fall back to the stable namespace itself.
  const resolved = tDynLoose(t, jurisdiction, stableNamespace);
  const label =
    resolved.includes('MISSING_MESSAGE') || resolved === `${jurisdiction}.${stableNamespace}`
      ? stableNamespace
      : resolved;
  return { label, isPending: isComplDocNamePending(policyRuleId) };
}
