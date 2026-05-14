'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Supported filter values — mirrors the einvoice.listByOrg router enum
// except for `all` which renders as the "no filter" tab.
// ---------------------------------------------------------------------------

const FILTER_VALUES = [
  'all',
  'notGenerated',
  'valid',
  'warnings',
  'invalid',
  'transmitted',
  'failed',
] as const;

export type EInvoiceComplianceFilter = (typeof FILTER_VALUES)[number];

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
  /** Multi-selection is exposed so "Review N invoices" can set invalid+failed. */
  value?: EInvoiceComplianceFilter[];
  onChange?: (next: EInvoiceComplianceFilter[]) => void;
  /**
   * When true, tab state syncs to `?einvoiceStatus=<value>` in the URL
   * via next/navigation. Exposed as a prop so tests can bypass router wiring.
   */
  syncToUrl?: boolean;
  /** Disable all tabs (initial data load). */
  disabled?: boolean;
}

/**
 * Parses a URL value like `invalid,failed` into a normalised filter set.
 * Unknown tokens are dropped silently (defence against tampering — server
 * re-validates via Zod, this is just UX sugar).
 */
export function parseFilterParam(raw: string | null): EInvoiceComplianceFilter[] {
  if (!raw) return ['all'];
  const tokens = raw.split(',').map(t => t.trim());
  const allowed = new Set<EInvoiceComplianceFilter>(FILTER_VALUES);
  const parsed = tokens.filter((t): t is EInvoiceComplianceFilter =>
    allowed.has(t as EInvoiceComplianceFilter),
  );
  if (parsed.length === 0) return ['all'];
  // `all` short-circuits any other selection.
  if (parsed.includes('all')) return ['all'];
  return parsed;
}

/**
 * Row of tabs for e-invoice compliance status filtering. Single-select for
 * user clicks, multi-select when driven externally by the "Review" CTA
 * (invalid+failed).
 *
 * URL binding uses `?einvoiceStatus=invalid` so filtered lists are shareable.
 */
export function EInvoiceComplianceFilterChips({
  value,
  onChange,
  syncToUrl = true,
  disabled: tabsDisabled,
}: EInvoiceComplianceFilterChipsProps) {
  const t = useTranslations('EInvoice.InvoicesList.Filter');
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlValue = useMemo<EInvoiceComplianceFilter[]>(
    () => parseFilterParam(searchParams.get(URL_PARAM)),
    [searchParams],
  );

  const activeFilters = value ?? urlValue;
  // For tabs, use the first active filter as the selected tab value
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
      router.replace(query ? `?${query}` : '?');
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
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className={tabsDisabled ? 'opacity-50 pointer-events-none' : ''}>
        {TABS.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} disabled={tabsDisabled}>
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
