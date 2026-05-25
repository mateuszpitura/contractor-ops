import { getAllPending, getRegistry, LOCKED_DISCLAIMERS } from '@contractor-ops/validators';
import { useMemo } from 'react';

import { useFlag } from '../../layout/feature-flag-context.js';

export interface ClassificationEngineRow {
  key: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approverRole: string | null;
  isPending: boolean;
}

export interface ClassificationEngineState {
  flagEnabled: boolean;
  pendingCount: number;
  totalCount: number;
  isOverridden: boolean;
  rows: ClassificationEngineRow[];
}

export function useAdminClassificationEngine(): ClassificationEngineState {
  const flagEnabled = useFlag('module.classification-engine');

  return useMemo(() => {
    const registry = getRegistry();
    const pendingKeys = getAllPending();
    const allDisclaimerKeys = Object.keys(LOCKED_DISCLAIMERS);
    const rows: ClassificationEngineRow[] = allDisclaimerKeys.map(key => {
      const entry = registry[key];
      const isPending = !entry || entry.status === 'PENDING';
      return {
        key,
        status: entry?.status ?? 'MISSING',
        approvedBy: entry?.approvedBy ?? null,
        approvedAt: entry?.approvedAt ?? null,
        approverRole: entry?.approverRole ?? null,
        isPending,
      };
    });

    return {
      flagEnabled,
      pendingCount: pendingKeys.length,
      totalCount: allDisclaimerKeys.length,
      isOverridden: !flagEnabled && pendingKeys.length > 0,
      rows,
    };
  }, [flagEnabled]);
}
