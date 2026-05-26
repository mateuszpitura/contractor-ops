import type { RowSelectionState } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { usePaymentRunStepSelect } from '../hooks/use-payment-run-step-select.js';
import { getColumns } from '../invoice-selection-table/columns.js';
import { StepSelect, StepSelectDataTable, StepSelectEmptyState } from './step-select.js';

interface StepSelectContainerProps {
  selectedInvoiceIds: string[];
  onSelectionChange: (ids: string[]) => void;
  groupByCurrency: boolean;
  onGroupByCurrencyChange: (value: boolean) => void;
  onCancel: () => void;
  onNext: () => void;
}

export function StepSelectContainer({
  selectedInvoiceIds,
  onSelectionChange,
  groupByCurrency,
  onGroupByCurrencyChange,
  onCancel,
  onNext,
}: StepSelectContainerProps) {
  const t = useTranslations('Payments');
  const { formatDate } = useDateFormatter();
  const select = usePaymentRunStepSelect({ selectedInvoiceIds, onSelectionChange });

  const columns = useMemo(() => getColumns(t, formatDate), [t, formatDate]);

  const rowSelection = useMemo(() => {
    const state: RowSelectionState = {};
    for (const id of selectedInvoiceIds) state[id] = true;
    return state;
  }, [selectedInvoiceIds]);

  const selectableMatchingIds = useMemo(
    () => select.filteredInvoices.filter(inv => !inv._inRunNumber).map(inv => inv.id),
    [select.filteredInvoices],
  );

  const handleSelectAllMatching = useCallback(() => {
    onSelectionChange(selectableMatchingIds);
  }, [onSelectionChange, selectableMatchingIds]);

  const selectedInvoices = useMemo(
    () => select.allInvoices.filter(inv => selectedInvoiceIds.includes(inv.id)),
    [select.allInvoices, selectedInvoiceIds],
  );

  const selectionByCurrency = useMemo(() => {
    const byCurrency = new Map<string, { count: number; totalMinor: number }>();
    for (const inv of selectedInvoices) {
      const prev = byCurrency.get(inv.currency) ?? { count: 0, totalMinor: 0 };
      byCurrency.set(inv.currency, {
        count: prev.count + 1,
        totalMinor: prev.totalMinor + inv.amountToPayMinor,
      });
    }
    return Array.from(byCurrency.entries()).map(([currency, { count, totalMinor }]) => ({
      currency,
      count,
      totalMinor,
    }));
  }, [selectedInvoices]);

  const uniqueCurrencies = selectionByCurrency.map(s => s.currency);
  const isEmpty = !select.isLoading && select.filteredInvoices.length === 0;

  const formatDateRange = useCallback(
    (from: Date, to?: Date) => `${formatDate(from)}${to ? ` - ${formatDate(to)}` : ''}`,
    [formatDate],
  );

  let pane: ReactNode;
  let selectAllMatching: { count: number; onClick: () => void } | null;
  if (isEmpty) {
    pane = <StepSelectEmptyState />;
    selectAllMatching = null;
  } else {
    pane = (
      <StepSelectDataTable
        data={select.filteredInvoices}
        columns={columns}
        isLoading={select.isLoading}
        rowSelection={rowSelection}
        onRowSelectionChange={select.handleRowSelectionChange}
      />
    );
    selectAllMatching = {
      count: selectableMatchingIds.length,
      onClick: handleSelectAllMatching,
    };
  }

  return (
    <StepSelect
      filters={{
        currency: select.currency,
        setCurrency: select.setCurrency,
        dueDateFrom: select.dueDateFrom,
        setDueDateFrom: select.setDueDateFrom,
        dueDateTo: select.dueDateTo,
        setDueDateTo: select.setDueDateTo,
        contractorSearch: select.contractorSearch,
        setContractorSearch: select.setContractorSearch,
      }}
      footer={{
        selectedInvoiceIds,
        selectedInvoiceCountsByCurrency: selectionByCurrency,
        uniqueCurrencies,
        groupByCurrency,
        onGroupByCurrencyChange,
        onCancel,
        onNext,
      }}
      formatDateRange={formatDateRange}
      selectAllMatching={selectAllMatching}>
      {pane}
    </StepSelect>
  );
}
