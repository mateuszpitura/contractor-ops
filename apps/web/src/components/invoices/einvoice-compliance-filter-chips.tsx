'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Supported filter values — mirrors the einvoice.listByOrg router enum
// except for `all` which renders as the "no filter" chip.
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

interface FilterChipDef {
  value: EInvoiceComplianceFilter;
  labelKey: 'all' | 'notGenerated' | 'valid' | 'warnings' | 'invalid' | 'transmitted' | 'failed';
}

const CHIPS: FilterChipDef[] = [
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
   * When true, chip click state syncs to `?einvoiceStatus=<value>` in the URL
   * via next/navigation. Exposed as a prop so tests can bypass router wiring.
   */
  syncToUrl?: boolean;
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
 * Row of 7 `role="button"` interactive shadcn `Badge` chips. Selection is
 * single-select for user clicks (`all` semantics) and multi-select when
 * driven externally by the "Review" CTA (invalid+failed).
 *
 * URL binding uses `?einvoiceStatus=invalid` — or a comma-separated list for
 * multi-select — so filtered lists are shareable.
 */
export function EInvoiceComplianceFilterChips({
  value,
  onChange,
  syncToUrl = true,
}: EInvoiceComplianceFilterChipsProps) {
  const t = useTranslations('EInvoice.InvoicesList.Filter');
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlValue = useMemo<EInvoiceComplianceFilter[]>(
    () => parseFilterParam(searchParams.get(URL_PARAM)),
    [searchParams],
  );

  const activeFilters = value ?? urlValue;
  const activeSet = useMemo(() => new Set(activeFilters), [activeFilters]);

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

  const handleClick = useCallback(
    (chip: EInvoiceComplianceFilter) => {
      // Single-select semantics: click the same chip again → back to `all`.
      const next: EInvoiceComplianceFilter[] =
        chip === 'all' || (activeSet.has(chip) && activeFilters.length === 1) ? ['all'] : [chip];
      writeUrl(next);
      onChange?.(next);
    },
    [activeSet, activeFilters.length, onChange, writeUrl],
  );

  const handleKeyDown = useCallback(
    (chip: EInvoiceComplianceFilter, event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick(chip);
      }
    },
    [handleClick],
  );

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('label')}>
      {CHIPS.map(chip => {
        const isActive = activeSet.has(chip.value);
        return (
          <Badge
            key={chip.value}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            data-active={isActive ? 'true' : 'false'}
            data-value={chip.value}
            variant={isActive ? 'default' : 'outline'}
            className={`cursor-pointer h-8 px-3 text-sm select-none ${
              isActive ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'
            }`}
            // biome-ignore lint/nursery/noJsxPropsBind: per-chip handler
            onClick={() => handleClick(chip.value)}
            // biome-ignore lint/nursery/noJsxPropsBind: per-chip keyboard handler
            onKeyDown={e => handleKeyDown(chip.value, e)}>
            {t(chip.labelKey)}
          </Badge>
        );
      })}
    </div>
  );
}
