/**
 * Pre-resolved Common toast strings for direct use in `toast.*` calls.
 *
 * Why this exists: `useTranslations(namespace)` returns a `t()` bound to
 * `${namespace}.`, which means a hook scoped to (say) `Billing.billingTab`
 * cannot reach `Common.toastDone` without remixing namespaces. This helper
 * binds a separate unprefixed translator and returns thunks that resolve at
 * call time, so:
 *
 *     toast.success(toasts.done());
 *
 * passes a non-literal argument to sonner — the `no-untranslated-toast`
 * Biome plugin accepts it — and i18next stays the single source of truth
 * for the rendered string.
 */

import { useTranslations } from './useTranslations.js';

export function useCommonToasts() {
  const t = useTranslations('Common');
  return {
    done: () => t('toastDone'),
    budgetMustBePositive: () => t('toastBudgetMustBePositive'),
    costCenterCreated: () => t('toastCostCenterCreated'),
    costCenterUpdated: () => t('toastCostCenterUpdated'),
    costCenterArchived: () => t('toastCostCenterArchived'),
    projectCreated: () => t('toastProjectCreated'),
    projectUpdated: () => t('toastProjectUpdated'),
    projectArchived: () => t('toastProjectArchived'),
    teamCreated: () => t('toastTeamCreated'),
    teamUpdated: () => t('toastTeamUpdated'),
    teamArchived: () => t('toastTeamArchived'),
    mergeResolved: () => t('toastMergeResolved'),
    approved: () => t('toastApproved'),
    rejected: () => t('toastRejected'),
    clarificationRequested: () => t('toastClarificationRequested'),
    delegated: () => t('toastDelegated'),
    failedToApprove: () => t('toastFailedToApprove'),
    failedToReject: () => t('toastFailedToReject'),
    failedToRequestClarification: () => t('toastFailedToRequestClarification'),
    failedToDelegate: () => t('toastFailedToDelegate'),
  };
}
