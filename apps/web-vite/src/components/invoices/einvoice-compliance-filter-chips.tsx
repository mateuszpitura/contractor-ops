/**
 * E-invoice compliance filter chips.
 *
 * URL binding stays on `?einvoiceStatus=<value>`. The canonical filter set
 * and parser live in `invoice-table/compliance-filter-param.ts` so the
 * table can react to URL changes without circular imports.
 */

import { Tabs, TabsList, TabsTrigger } from '@contractor-ops/ui/components/shadcn/tabs';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { EInvoiceComplianceFilter } from './invoice-table/compliance-filter-param.js';
import { parseFilterParam } from './invoice-table/compliance-filter-param.js';

export type { EInvoiceComplianceFilter } from './invoice-table/compliance-filter-param.js';
// biome-ignore lint/performance/noBarrelFile: not a barrel — component module; single re-export of the shared filter parser
export { parseFilterParam } from './invoice-table/compliance-filter-param.js';

const URL_PARAM = 'einvoiceStatus';

interface TabDef {
  value: EInvoiceComplianceFilter;
  labelKey: 'all' | 'notGenerated' | 'valid' | 'warnings' | 'invalid' | 'transmitted' | 'failed';
}

const TABS: TabDef[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'notGenerated', labelKey: 'notGenerated' },
  { value: 'valid', labelKey: 'valid' },
  { value: 'warnings', labelKey: 'warnings' },
  { value: 'invalid', labelKey: 'invalid' },
  { value: 'transmitted', labelKey: 'transmitted' },
  { value: 'failed', labelKey: 'failed' },
];

interface EInvoiceComplianceFilterChipsProps {
  value?: EInvoiceComplianceFilter[];
  onChange?: (next: EInvoiceComplianceFilter[]) => void;
  /** When true (default), tab state syncs to `?einvoiceStatus=` via router. */
  syncToUrl?: boolean;
  disabled?: boolean;
}

export function EInvoiceComplianceFilterChips({
  value,
  onChange,
  syncToUrl = true,
  disabled: tabsDisabled,
}: EInvoiceComplianceFilterChipsProps) {
  const t = useTranslations('EInvoice.InvoicesList.Filter');
  const router = useRouter();
  const [searchParams] = useSearchParams();

  const urlValue = useMemo<EInvoiceComplianceFilter[]>(
    () => parseFilterParam(searchParams.get(URL_PARAM)),
    [searchParams],
  );

  const activeFilters = value ?? urlValue;
  const activeTab = activeFilters[0] ?? 'all';

  const writeUrl = useCallback(
    (next: EInvoiceComplianceFilter[]) => {
      if (!syncToUrl) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0 || next.includes('all')) {
        params.delete(URL_PARAM);
      } else {
        params.set(URL_PARAM, next.join(','));
      }
      const query = params.toString();
      void router.replace(query ? `?${query}` : '?');
    },
    [router, searchParams, syncToUrl],
  );

  const handleTabChange = useCallback(
    (tabValue: string | number | null) => {
      if (tabValue === null) return;
      const tab = String(tabValue) as EInvoiceComplianceFilter;
      const next: EInvoiceComplianceFilter[] = tab === 'all' ? ['all'] : [tab];
      writeUrl(next);
      onChange?.(next);
    },
    [onChange, writeUrl],
  );

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="min-w-0">
      <TabsList
        className={`no-scrollbar max-w-full justify-start overflow-x-auto [&>*]:shrink-0 ${tabsDisabled ? 'pointer-events-none opacity-50' : ''}`}>
        {TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} disabled={tabsDisabled}>
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
