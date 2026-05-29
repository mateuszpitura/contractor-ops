import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useTranslations } from '../../../i18n/useTranslations.js';

const TAB_KEYS = ['info', 'assignments', 'shipments'] as const;

type TabKey = (typeof TAB_KEYS)[number];

interface EquipmentDetailTabsProps {
  infoContent: ReactNode;
  assignmentsContent: ReactNode;
  shipmentsContent: ReactNode;
}

export function EquipmentDetailTabs({
  infoContent,
  assignmentsContent,
  shipmentsContent,
}: EquipmentDetailTabsProps) {
  const t = useTranslations('Equipment.detail');
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get('tab') as TabKey) ?? 'info';

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
            {t(key)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="info" className="mt-4 min-h-[400px]">
        {infoContent}
      </TabsContent>

      <TabsContent value="assignments" className="mt-4 min-h-[400px]">
        {assignmentsContent}
      </TabsContent>

      <TabsContent value="shipments" className="mt-4 min-h-[400px]">
        {shipmentsContent}
      </TabsContent>
    </Tabs>
  );
}
