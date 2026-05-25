import type { AppRouter } from '@contractor-ops/api';
import type { inferRouterOutputs } from '@trpc/server';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';

const TAB_KEYS = ['overview', 'documents', 'amendments', 'activity'] as const;
export type ContractDetailTabKey = (typeof TAB_KEYS)[number];

type ContractDetail = NonNullable<inferRouterOutputs<AppRouter>['contract']['getById']>;

function extractContractTaskRunIds(contract: ContractDetail): string[] {
  const maybeRuns = (
    contract as unknown as { workflowRuns?: Array<{ tasks?: Array<{ id: string }> }> }
  ).workflowRuns;
  if (!Array.isArray(maybeRuns)) return [];
  const ids: string[] = [];
  for (const run of maybeRuns) {
    for (const task of run.tasks ?? []) {
      if (typeof task.id === 'string') ids.push(task.id);
    }
  }
  return ids;
}

/**
 * Owns the `?tab=` URL state for the contract detail page and derives
 * the Linear `taskRunIds` set used by the activity tab panel.
 */
export function useContractDetailTabs(contract: ContractDetail) {
  const [tabParam, setTabParam] = useQueryState('tab', parseAsString);
  const currentTab = ((tabParam as ContractDetailTabKey | null) ??
    'overview') as ContractDetailTabKey;

  const setTab = useCallback(
    (tab: string) => {
      void setTabParam(tab);
    },
    [setTabParam],
  );

  const taskRunIds = useMemo(() => extractContractTaskRunIds(contract), [contract]);

  return {
    tabKeys: TAB_KEYS,
    currentTab,
    setTab,
    taskRunIds,
  } as const;
}
