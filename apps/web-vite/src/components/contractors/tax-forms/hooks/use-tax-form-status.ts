import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export type TaxFormType = 'W9' | 'W8BEN' | 'W8BENE';
export type TaxFormStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';

export interface TaxFormSubmissionRow {
  id: string;
  formType: TaxFormType;
  status: TaxFormStatus;
  treatyArticle: string | null;
  treatyRate: number | null;
  contractorResidency: string | null;
  signerName: string | null;
  signedAt: string | Date | null;
  expiresAt: string | Date | null;
  createdAt: string | Date;
}

/** Derived UI status — folds expiry into the persisted DRAFT/ACTIVE/SUPERSEDED. */
export type DerivedFormStatus = 'active' | 'draft' | 'superseded' | 'expiring' | 'expired';

const EXPIRY_LOOKAHEAD_MS = 60 * 24 * 60 * 60 * 1000;

export function deriveFormStatus(form: TaxFormSubmissionRow, now = Date.now()): DerivedFormStatus {
  if (form.status === 'DRAFT') return 'draft';
  if (form.status === 'SUPERSEDED') return 'superseded';
  if (form.expiresAt) {
    const expiresAt = new Date(form.expiresAt).getTime();
    if (expiresAt <= now) return 'expired';
    if (expiresAt - now <= EXPIRY_LOOKAHEAD_MS) return 'expiring';
  }
  return 'active';
}

/**
 * The only tRPC boundary for the staff tax-form status card. Reads the
 * contractor's W-form submissions (status + treaty claim + expiry only — the
 * snapshot and full SSN never leave the server). The card itself stays
 * presentational.
 */
export function useTaxFormStatus(contractorId: string) {
  const trpc = useTRPC();
  const query = useQuery(trpc.taxForm.listFormSubmissions.queryOptions({ contractorId }));

  const forms = (query.data ?? []) as TaxFormSubmissionRow[];
  const latest = forms[0] ?? null;

  return {
    isPending: query.isPending,
    error: query.error ?? null,
    isEmpty: !(query.isPending || query.error) && forms.length === 0,
    forms,
    latest,
    refetch: () => {
      void query.refetch();
    },
  } as const;
}
