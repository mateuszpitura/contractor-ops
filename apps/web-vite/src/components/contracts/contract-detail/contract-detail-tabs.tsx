import type { AppRouter } from '@contractor-ops/api';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { inferRouterOutputs } from '@trpc/server';

import { useCallback } from 'react';

import { tDyn } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { HealthCheckPanelWired } from '../health-check-panel.js';
import { useContractDetailTabs } from '../hooks/use-contract-detail-tabs.js';
import { ActivityTab } from './activity-tab.js';
import { AmendmentsTabWired } from './amendments-tab.js';
import { DocumentsTabWired } from './documents-tab.js';
import { LinearLinkedIssuesPanelWired } from './linear-linked-issues-panel.js';
import { OverviewTabWired } from './overview-tab.js';

type ContractDetail = NonNullable<inferRouterOutputs<AppRouter>['contract']['getById']>;

type ContractDetailTabsProps = {
  contract: ContractDetail;
  contractParties: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
};

export function ContractDetailTabs({ contract, contractParties }: ContractDetailTabsProps) {
  const t = useTranslations('ContractDetail');
  const { tabKeys, currentTab, setTab, taskRunIds } = useContractDetailTabs(contract);

  const handleTabChange = useCallback(
    (value: string | null) => setTab((value ?? '') as string),
    [setTab],
  );

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="w-full justify-start">
        {tabKeys.map(key => (
          <TabsTrigger key={key} value={key}>
            {tDyn(t, 'tabs', key)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-4 min-h-[400px]">
        <OverviewTabWired contract={contract} />
      </TabsContent>

      <TabsContent value="documents" className="mt-4 min-h-[400px]">
        <DocumentsTabWired contractId={contract.id} contractParties={contractParties} />
      </TabsContent>

      <TabsContent value="amendments" className="mt-4 min-h-[400px]">
        <AmendmentsTabWired contract={contract} />
      </TabsContent>

      <TabsContent value="activity" className="mt-4 min-h-[400px] space-y-6">
        <ActivityTab contract={contract} />
        <LinearLinkedIssuesPanelWired taskRunIds={taskRunIds} />
      </TabsContent>

      <TabsContent value="compliance" className="mt-4 min-h-[400px]">
        <HealthCheckPanelWired
          contractId={contract.id}
          resultsJson={contract.complianceFlagsJson}
        />
      </TabsContent>
    </Tabs>
  );
}
