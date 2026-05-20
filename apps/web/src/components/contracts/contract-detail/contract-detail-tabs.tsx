'use client';

import type { AppRouter } from '@contractor-ops/api';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { inferRouterOutputs } from '@trpc/server';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { tDyn } from '@/i18n/typed-keys';
import { ActivityTab } from './activity-tab';
import { AmendmentsTab } from './amendments-tab';
import { DocumentsTab } from './documents-tab';
import { LinearLinkedIssuesPanel } from './linear-linked-issues-panel';
import { OverviewTab } from './overview-tab';

const TAB_KEYS = ['overview', 'documents', 'amendments', 'activity'] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** Contract detail type derived from the tRPC router (contract.getById). */
type ContractDetail = NonNullable<inferRouterOutputs<AppRouter>['contract']['getById']>;

type ContractDetailTabsProps = {
  contract: ContractDetail;
};

export function ContractDetailTabs({ contract }: ContractDetailTabsProps) {
  const t = useTranslations('ContractDetail');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = (searchParams.get('tab') as TabKey) ?? 'overview';

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
    <Tabs value={currentTab} onValueChange={value => setTab(value as string)} className="w-full">
      <TabsList className="w-full justify-start">
        {TAB_KEYS.map(key => (
          <TabsTrigger key={key} value={key}>
            {tDyn(t, 'tabs', key)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-4 min-h-[400px]">
        <OverviewTab contract={contract} />
      </TabsContent>

      <TabsContent value="documents" className="mt-4 min-h-[400px]">
        <DocumentsTab
          contractId={contract.id}
          contractParties={
            contract.contractor
              ? [
                  {
                    name: contract.contractor.displayName,
                    email: '',
                    role: 'signer' as const,
                  },
                ]
              : []
          }
        />
      </TabsContent>

      <TabsContent value="amendments" className="mt-4 min-h-[400px]">
        <AmendmentsTab contract={contract} />
      </TabsContent>

      <TabsContent value="activity" className="mt-4 min-h-[400px] space-y-6">
        <ActivityTab contract={contract} />
        {/*
          Linear linked-issues sidebar. Linear issues are stored against
          workflow task runs server-side — when a contract has no associated
          task runs the panel renders nothing (no surface noise).
        */}
        <LinearLinkedIssuesPanel taskRunIds={extractContractTaskRunIds(contract)} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * Best-effort extraction of workflow task-run IDs reachable from a contract
 * payload. Today `contract.getById` does not eagerly include workflow runs,
 * so this returns an empty list — keeping the panel correctly hidden until
 * the contract router exposes task-run linkage.
 */
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
