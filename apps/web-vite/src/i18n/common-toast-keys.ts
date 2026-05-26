/**
 * Branded `TranslationKey` constants for the 12 recurring sonner messages
 * carried by `Common.toast*`. Use these in `useResourceMutation` configs:
 *
 *     successMessage: COMMON_TOAST.done,
 *     errorMessage: COMMON_TOAST.failedToApprove,
 *
 * `useCommonToasts` (the thunk hook) stays available for direct
 * `toast.<level>(...)` callers that need a pre-rendered string. Both APIs
 * point at the same locale keys; this module is the typed contract.
 */

import type { TranslationKey } from '../generated/i18n/keys.js';

export const COMMON_TOAST = {
  done: 'Common.toastDone',
  budgetMustBePositive: 'Common.toastBudgetMustBePositive',
  costCenterCreated: 'Common.toastCostCenterCreated',
  costCenterUpdated: 'Common.toastCostCenterUpdated',
  costCenterArchived: 'Common.toastCostCenterArchived',
  projectCreated: 'Common.toastProjectCreated',
  projectUpdated: 'Common.toastProjectUpdated',
  projectArchived: 'Common.toastProjectArchived',
  teamCreated: 'Common.toastTeamCreated',
  teamUpdated: 'Common.toastTeamUpdated',
  teamArchived: 'Common.toastTeamArchived',
  mergeResolved: 'Common.toastMergeResolved',
  approved: 'Common.toastApproved',
  rejected: 'Common.toastRejected',
  clarificationRequested: 'Common.toastClarificationRequested',
  delegated: 'Common.toastDelegated',
  failedToApprove: 'Common.toastFailedToApprove',
  failedToReject: 'Common.toastFailedToReject',
  failedToRequestClarification: 'Common.toastFailedToRequestClarification',
  failedToDelegate: 'Common.toastFailedToDelegate',
} as const satisfies Record<string, TranslationKey>;
