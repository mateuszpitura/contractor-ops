import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { ReactNode } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useContractorListView } from '../hooks/use-contractor-list-view.js';

export interface ContractorListViewProps {
  /** The insight band ("visuals" layer). Only mounted when the mode shows it. */
  band: ReactNode;
  /** The data table ("data" layer). */
  table: ReactNode;
}

/**
 * Arranges the two list layers per the persisted view mode. `data-oriented`
 * never mounts the band (so its query never runs); `tabbed` / `single` show one
 * panel at a time and differ only in switcher chrome.
 */
export function ContractorListView({ band, table }: ContractorListViewProps) {
  const { mode } = useContractorListView();

  if (mode === 'data-oriented') {
    return <>{table}</>;
  }

  if (mode === 'tabbed' || mode === 'single') {
    return <SwitchedView band={band} table={table} variant={mode} />;
  }

  if (mode === 'visuals-last') {
    return (
      <>
        {table}
        {band}
      </>
    );
  }

  // visuals-first (default)
  return (
    <>
      {band}
      {table}
    </>
  );
}

function SwitchedView({
  band,
  table,
  variant,
}: {
  band: ReactNode;
  table: ReactNode;
  variant: 'tabbed' | 'single';
}) {
  const t = useTranslations('Contractors');

  return (
    <Tabs defaultValue="visuals" className="flex min-h-0 flex-1 flex-col gap-3">
      <TabsList className={variant === 'single' ? 'h-8 w-fit self-start' : 'w-fit self-start'}>
        <TabsTrigger value="visuals">{t('insights.tabs.visuals')}</TabsTrigger>
        <TabsTrigger value="data">{t('insights.tabs.data')}</TabsTrigger>
      </TabsList>
      <TabsContent value="visuals" className="min-h-0">
        {band}
      </TabsContent>
      <TabsContent value="data" className="flex min-h-0 flex-1 flex-col">
        {table}
      </TabsContent>
    </Tabs>
  );
}
