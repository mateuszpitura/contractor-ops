import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { canViewSensitivePii } from '../../../lib/mask-pii.js';

/**
 * Overview-tab orchestration: pii visibility derived from role + URL-driven
 * tab switching for the deep-link `?tab=…` query param. Pure hook so the
 * container stays JSX-only and the behaviour is unit-testable.
 */
export function useContractorTabOverview() {
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const [searchParams, setSearchParams] = useSearchParams();

  const onSwitchTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('tab', tab);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return { showPii, onSwitchTab } as const;
}
