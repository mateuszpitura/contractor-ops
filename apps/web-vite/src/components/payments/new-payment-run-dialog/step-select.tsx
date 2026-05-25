/**
 * StepSelect — ported from
 * apps/web/src/components/payments/new-payment-run-dialog/step-select.tsx.
 * Swaps:
 *   - next-intl → ../../../i18n/useTranslations
 *   - @/trpc/init → useTRPC()
 *   - @/lib/format/use-date-formatter → ../../../lib/format/use-date-formatter
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
import type { RowSelectionState } from '@tanstack/react-table';
import { CalendarIcon } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import type { usePaymentRunStepSelect } from '../hooks/use-payment-run-step-select.js';
import { getColumns } from '../invoice-selection-table/columns.js';
import { InvoiceSelectionDataTable } from '../invoice-selection-table/data-table.js';

interface StepSelectProps {
  selectedInvoiceIds: string[];
  onSelectionChange: (ids: string[]) => void;
  groupByCurrency: boolean;
  onGroupByCurrencyChange: (value: boolean) => void;
  onCancel: () => void;
  onNext: () => void;
  select: ReturnType<typeof usePaymentRunStepSelect>;
}

export function StepSelect({
  selectedInvoiceIds,
  onSelectionChange,
  groupByCurrency,
  onGroupByCurrencyChange,
  onCancel,
  onNext,
  select,
}: StepSelectProps) {
  const t = useTranslations('Payments');
  const { formatDate } = useDateFormatter();
  const reactId = useId();

  const {
    currency,
    setCurrency,
    dueDateFrom,
    setDueDateFrom,
    dueDateTo,
    setDueDateTo,
    contractorSearch,
    setContractorSearch,
    allInvoices,
    filteredInvoices,
    isLoading,
    handleRowSelectionChange,
  } = select;

  const rowSelection = useMemo(() => {
    const state: RowSelectionState = {};
    for (const id of selectedInvoiceIds) {
      state[id] = true;
    }
    return state;
  }, [selectedInvoiceIds]);

  const handleSelectAllMatching = useCallback(() => {
    const ids = filteredInvoices.filter(inv => !inv._inRunNumber).map(inv => inv.id);
    onSelectionChange(ids);
  }, [filteredInvoices, onSelectionChange]);

  const columns = useMemo(() => getColumns(t, formatDate), [t, formatDate]);

  const selectedInvoices = useMemo(
    () => allInvoices.filter(inv => selectedInvoiceIds.includes(inv.id)),
    [allInvoices, selectedInvoiceIds],
  );

  const selectionSummary = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    for (const inv of selectedInvoices) {
      byCurrency[inv.currency] = (byCurrency[inv.currency] ?? 0) + inv.amountToPayMinor;
    }
    return byCurrency;
  }, [selectedInvoices]);

  const uniqueCurrencies = Object.keys(selectionSummary);
  const isEmpty = !isLoading && filteredInvoices.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
        <Select value={currency} onValueChange={v => setCurrency(v ?? 'all')}>
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
              {dueDateFrom
                ? `${formatDate(dueDateFrom)}${dueDateTo ? ` - ${formatDate(dueDateTo)}` : ''}`
                : t('step1.dueDate')}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex gap-2 p-3">
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={dueDateFrom}
                  onSelect={setDueDateFrom}
                  initialFocus
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">To</p>
                <Calendar mode="single" selected={dueDateTo} onSelect={setDueDateTo} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          placeholder={t('step1.searchContractors')}
          value={contractorSearch}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => setContractorSearch(e.target.value)}
          className="h-8 w-[200px] text-xs"
        />
      </div>

      {!isEmpty && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={handleSelectAllMatching}>
            {t('step1.selectAllMatching')} ({filteredInvoices.filter(i => !i._inRunNumber).length})
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-primary/70">
            <PaymentsIllustration className="h-20 w-20" />
          </div>
          <h3 className="mt-4 text-[16px] font-medium">{t('step1.noInvoicesHeading')}</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            {t('step1.noInvoicesBody')}
          </p>
        </div>
      ) : (
        <InvoiceSelectionDataTable
          data={filteredInvoices}
          columns={columns}
          isLoading={isLoading}
          rowSelection={rowSelection}
          onRowSelectionChange={handleRowSelectionChange}
        />
      )}

      <div className="flex items-start justify-between border-t pt-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {selectedInvoiceIds.length > 0
              ? uniqueCurrencies.map(curr => (
                  <span key={curr} className="block">
                    {selectedInvoices.filter(i => i.currency === curr).length}{' '}
                    {t('step1.invoicesSelected')} &mdash;{' '}
                    {new Intl.NumberFormat('pl-PL', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format((selectionSummary[curr] ?? 0) / 100)}{' '}
                    {curr}
                  </span>
                ))
              : t('step1.noSelection')}
          </p>

          {uniqueCurrencies.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={groupByCurrency}
                onCheckedChange={onGroupByCurrencyChange}
                id={`${reactId}-group-by-currency`}
              />
              <Label htmlFor={`${reactId}-group-by-currency`} className="text-xs">
                {t('step1.groupByCurrency')}
                {groupByCurrency && uniqueCurrencies.length > 1 && (
                  <span className="ms-1 text-muted-foreground">
                    ({t('step1.willCreateRuns', { count: uniqueCurrencies.length })})
                  </span>
                )}
              </Label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t('step1.cancel')}
          </Button>
          <Button onClick={onNext} disabled={selectedInvoiceIds.length === 0}>
            {t('step1.reviewSelection')}
          </Button>
        </div>
      </div>
    </div>
  );
}
