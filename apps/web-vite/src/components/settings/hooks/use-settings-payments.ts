import { usePermissions } from '../../../hooks/use-permissions.js';
import { useFlag } from '../../layout/feature-flag-context.js';

export interface UseSettingsPaymentsResult {
  canManageSettings: boolean;
  bacsEnabled: boolean;
}

/**
 * Resolves the gating flags for the BACS payments settings page: the
 * organisation permission required to view/edit the form and the
 * `payments.bacs-enabled` feature flag that controls the banner state.
 */
export function useSettingsPayments(): UseSettingsPaymentsResult {
  const bacsEnabled = useFlag('payments.bacs-enabled');
  const { can } = usePermissions();
  const canManageSettings = can('settings', ['update']);
  return { canManageSettings, bacsEnabled };
}
