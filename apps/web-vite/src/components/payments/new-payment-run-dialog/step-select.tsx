/**
 * StepSelect — presentational shell + variant siblings.
 *
 * The container picks between `StepSelectEmptyState` (no rows after
 * filters) and `StepSelectDataTable` (rows present). `StepSelect`
 * renders the filter toolbar + footer that wrap both variants and
 * accepts the middle pane as `children`.
 */

import { PaymentsIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table';
import { CalendarIcon } from 'lucide-react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { useCallback, useId } from 'react';

import type { TranslateFn } from '../../../i18n/useTranslations.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatAmount } from '../../../lib/format-currency.js';
import type { ReadyInvoiceRow } from '../invoice-selection-table/columns.js';
import { InvoiceSelectionDataTable } from '../invoice-selection-table/data-table.js';

export interface StepSelectFilters {
  currency: string;
  setCurrency: (value: string) => void;
  dueDateFrom: Date | undefined;
  setDueDateFrom: (value: Date | undefined) => void;
  dueDateTo: Date | undefined;
  setDueDateTo: (value: Date | undefined) => void;
  contractorSearch: string;
  setContractorSearch: (value: string) => void;
}

export interface StepSelectFooterModel {
  selectedInvoiceIds: string[];
  selectedInvoiceCountsByCurrency: Array<{
    currency: string;
    count: number;
    totalMinor: number;
  }>;
  uniqueCurrencies: string[];
  groupByCurrency: boolean;
  onGroupByCurrencyChange: (value: boolean) => void;
  onCancel: () => void;
  onNext: () => void;
}

interface StepSelectProps {
  filters: StepSelectFilters;
  footer: StepSelectFooterModel;
  formatDateRange: (from: Date, to?: Date) => string;
  selectAllMatching?: {
    count: number;
    onClick: () => void;
  } | null;
  children: ReactNode;
}

export function StepSelect({
  filters,
  footer,
  formatDateRange,
  selectAllMatching,
  children,
}: StepSelectProps) {
  const t = useTranslations('Payments');
  const reactId = useId();

  const { setCurrency, setContractorSearch } = filters;
  const handleCurrencyChange = useCallback(
    (v: string | null) => setCurrency(v ?? 'all'),
    [setCurrency],
  );
  const handleContractorSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setContractorSearch(e.target.value),
    [setContractorSearch],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filters.currency} onValueChange={handleCurrencyChange}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue placeholder={t('step1.allCurrencies')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('step1.allCurrencies')}</SelectItem>
            <SelectItem value="PLN">PLN</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}>
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="text-xs">
              {filters.dueDateFrom
                ? formatDateRange(filters.dueDateFrom, filters.dueDateTo)
                : t('step1.dueDate')}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={filters.dueDateFrom}
                  onSelect={filters.setDueDateFrom}
                  initialFocus
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">To</p>
                <Calendar
                  mode="single"
                  selected={filters.dueDateTo}
                  onSelect={filters.setDueDateTo}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          placeholder={t('step1.searchContractors')}
          value={filters.contractorSearch}
          onChange={handleContractorSearchChange}
          className="h-8 w-[200px] text-xs"
        />
      </div>

      {selectAllMatching ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={selectAllMatching.onClick}>
            {t('step1.selectAllMatching')} ({selectAllMatching.count})
          </button>
        </div>
      ) : null}

      {children}

      <div className="flex items-start justify-between border-t pt-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {footer.selectedInvoiceIds.length > 0
              ? footer.selectedInvoiceCountsByCurrency.map(({ currency, count, totalMinor }) => (
                  <span key={currency} className="block">
                    {count} {t('step1.invoicesSelected')} &mdash;{' '}
                    {formatAmount(totalMinor, currency, 'pl-PL')}
                  </span>
                ))
              : t('step1.noSelection')}
          </p>

          {footer.uniqueCurrencies.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={footer.groupByCurrency}
                onCheckedChange={footer.onGroupByCurrencyChange}
                id={`${reactId}-group-by-currency`}
              />
              <Label htmlFor={`${reactId}-group-by-currency`} className="text-xs">
                {t('step1.groupByCurrency')}
                {footer.groupByCurrency && footer.uniqueCurrencies.length > 1 && (
                  <span className="ms-1 text-muted-foreground">
                    ({t('step1.willCreateRuns', { count: footer.uniqueCurrencies.length })})
                  </span>
                )}
              </Label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={footer.onCancel}>
            {t('step1.cancel')}
          </Button>
          <Button onClick={footer.onNext} disabled={footer.selectedInvoiceIds.length === 0}>
            {t('step1.reviewSelection')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StepSelectEmptyState() {
  const t = useTranslations('Payments');
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-primary/70">
        <PaymentsIllustration className="h-20 w-20" />
      </div>
      <h3 className="mt-4 text-[16px] font-medium">{t('step1.noInvoicesHeading')}</h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
        {t('step1.noInvoicesBody')}
      </p>
    </div>
  );
}

interface StepSelectDataTableProps {
  data: ReadyInvoiceRow[];
  columns: ColumnDef<ReadyInvoiceRow>[];
  isLoading: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: Record<string, boolean>) => void;
}

export function StepSelectDataTable({
  data,
  columns,
  isLoading,
  rowSelection,
  onRowSelectionChange,
}: StepSelectDataTableProps) {
  return (
    <InvoiceSelectionDataTable
      data={data}
      columns={columns}
      isLoading={isLoading}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
    />
  );
}

// Re-export TranslateFn type marker for tests that import it.
export type { TranslateFn };
