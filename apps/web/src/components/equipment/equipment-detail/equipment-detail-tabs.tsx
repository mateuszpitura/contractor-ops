'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const TAB_KEYS = ['info', 'assignments', 'shipments'] as const;

type TabKey = (typeof TAB_KEYS)[number];

interface EquipmentDetailTabsProps {
  infoContent: ReactNode;
  assignmentsContent: ReactNode;
  shipmentsContent: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EquipmentDetailTabs({
  infoContent,
  assignmentsContent,
  shipmentsContent,
}: EquipmentDetailTabsProps) {
  const t = useTranslations('Equipment.detail');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = (searchParams.get('tab') as TabKey) ?? 'info';

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
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
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
