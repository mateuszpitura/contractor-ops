// Sole tRPC boundary for the staff 1042-S batch review surface.
//
// Reads the persisted 1042-S rows for a tax year (status + box figures +
// recipient legal name / FTIN last-4) and exposes the review-before-file batch
// generate mutation. Box amounts and rates are always server-derived — the
// client only asserts a tax year. The full foreign TIN never reaches this
// boundary; the row carries last-4 only.

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export interface Form1042SRecipientRow {
  id: string;
  recipientId: string;
  recipientName: string;
  /** Last four digits of the recipient FTIN, or null when none is on file. */
  ftinLast4: string | null;
  status: string;
  corrected: boolean;
  treatyArticle: string | null;
  /** Chapter-3 withholding rate as a whole percent, or null when unresolved. */
  ratePercent: number | null;
  grossIncomeMinor: number;
  withheldMinor: number;
  currency: string;
  /**
   * True when no treaty article is on the row — the recipient is reported at the
   * 30% statutory rate. Advisory only; it never blocks filing.
   */
  isStatutory: boolean;
}

export interface Form1042SBatchSummary {
  taxYear: number;
  recipientCount: number;
  totalGrossMinor: number;
  totalWithheldMinor: number;
  currency: string;
}

/**
 * A 1042-S for tax year Y is filed the following calendar year, so the default
 * review year is the prior calendar year.
 */
export function defaultFilingTaxYear(now = new Date()): number {
  return now.getUTCFullYear() - 1;
}

function toRatePercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useForm1042sBatch(taxYear?: number) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();
  const year = taxYear ?? defaultFilingTaxYear();

  const query = useQuery(trpc.form1042s.list.queryOptions({ taxYear: year }));

  const generateMutation = useResourceMutation(trpc.form1042s.generateBatch.mutationOptions(), {
    invalidate: [trpc.form1042s.pathFilter()],
    successMessage: toasts.done(),
  });

  const rows = useMemo<Form1042SRecipientRow[]>(() => {
    const data = query.data ?? [];
    return data.map(form => ({
      id: form.id,
      recipientId: form.recipientId,
      recipientName: form.recipient?.legalName ?? '',
      ftinLast4: form.recipient?.ssnLast4 ?? null,
      status: form.status,
      corrected: form.corrected,
      treatyArticle: form.treatyArticle,
      ratePercent: toRatePercent(form.box3bChap3Rate),
      grossIncomeMinor: form.box2GrossIncomeMinor,
      withheldMinor: form.box7FederalTaxWithheldMinor,
      currency: form.currency,
      isStatutory: !form.treatyArticle,
    }));
  }, [query.data]);

  const summary = useMemo<Form1042SBatchSummary>(
    () => ({
      taxYear: year,
      recipientCount: rows.length,
      totalGrossMinor: rows.reduce((sum, row) => sum + row.grossIncomeMinor, 0),
      totalWithheldMinor: rows.reduce((sum, row) => sum + row.withheldMinor, 0),
      currency: rows[0]?.currency ?? 'USD',
    }),
    [rows, year],
  );

  const generate = useCallback(
    () => generateMutation.mutate({ taxYear: year }),
    [generateMutation, year],
  );

  return {
    taxYear: year,
    isPending: query.isPending,
    error: query.error ?? null,
    isEmpty: !(query.isPending || query.error) && rows.length === 0,
    rows,
    summary,
    generate,
    isGenerating: generateMutation.isPending,
    refetch: () => {
      void query.refetch();
    },
  } as const;
}
