import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { tDyn } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

const TAB_KEYS = [
  'overview',
  'contracts',
  'documents',
  'workflows',
  'invoices',
  'payments',
  'equipment',
  'activity',
  'compliance',
] as const;

type TabKey = (typeof TAB_KEYS)[number];

type ProfileTabsProps = {
  overviewContent: ReactNode;
  complianceContent: ReactNode;
  activityContent: ReactNode;
  contractsContent: ReactNode;
  documentsContent: ReactNode;
  workflowsContent: ReactNode;
  invoicesContent: ReactNode;
  paymentsContent: ReactNode;
  equipmentContent: ReactNode;
};

export function ProfileTabs({
  overviewContent,
  complianceContent,
  activityContent,
  contractsContent,
  documentsContent,
  workflowsContent,
  invoicesContent,
  paymentsContent,
  equipmentContent,
}: ProfileTabsProps) {
  const t = useTranslations('ContractorProfile');
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get('tab') as TabKey) ?? 'overview';

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams);
      params.set('tab', tab);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <Tabs value={currentTab} onValueChange={setTab} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {TAB_KEYS.map(key => (
          <TabsTrigger key={key} value={key}>
            {tDyn(t, 'tabs', key)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-4 min-h-[400px]">
        {overviewContent}
      </TabsContent>

      <TabsContent value="contracts" className="mt-4 min-h-[400px]">
        {contractsContent}
      </TabsContent>

      <TabsContent value="documents" className="mt-4 min-h-[400px]">
        {documentsContent}
      </TabsContent>

      <TabsContent value="workflows" className="mt-4 min-h-[400px]">
        {workflowsContent}
      </TabsContent>

      <TabsContent value="invoices" className="mt-4 min-h-[400px]">
        {invoicesContent}
      </TabsContent>

      <TabsContent value="payments" className="mt-4 min-h-[400px]">
        {paymentsContent}
      </TabsContent>

      <TabsContent value="equipment" className="mt-4 min-h-[400px]">
        {equipmentContent}
      </TabsContent>

      <TabsContent value="activity" className="mt-4 min-h-[400px]">
        {activityContent}
      </TabsContent>

      <TabsContent value="compliance" className="mt-4 min-h-[400px]">
        {complianceContent}
      </TabsContent>
    </Tabs>
  );
}

export type { TabKey };
