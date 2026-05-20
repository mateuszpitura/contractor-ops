// apps/web/src/components/contractors/leitweg-id-inline-selector.tsx
//
// Phase 61 · Plan 61-07 — Leitweg-ID inline selector for contractor profile +
// contract pages.
//
// Props:
//   - mode: 'contractor' | 'contract' — drives which tRPC query the selector
//     uses and which pre-fill key the Add-new dialog receives.
//   - contractorId / contractId — scope for the query.
//   - value: selected leitwegId row id (or null).
//   - onChange: callback when user picks an existing row or cancels.
//   - isPublicSectorBuyer: when true + no value selected, render the
//     UI-SPEC `LEITWEG_ID_MISSING` warning Alert inline.
//
// "Add new" item opens the Settings LeitwegIdCreateDialog with the scope
// pre-filled; on create success the new row is auto-selected via onChange.

'use client';

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { LeitwegIdCreateDialog } from '@/components/settings/e-invoicing/leitweg-id-create-dialog';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeitwegIdInlineSelectorProps {
  mode: 'contractor' | 'contract';
  contractorId?: string | null;
  contractId?: string | null;
  value: string | null;
  onChange: (leitwegIdRowId: string | null) => void;
  isPublicSectorBuyer?: boolean;
  label?: string;
}

interface LeitwegIdOption {
  id: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeitwegIdInlineSelector({
  mode,
  contractorId,
  contractId,
  value,
  onChange,
  isPublicSectorBuyer,
  label,
}: LeitwegIdInlineSelectorProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Scope-specific query. Falls back to the org-wide list when the relevant
  // id isn't known yet (no selection possible — dialog only).
  const query = useQuery({
    ...(mode === 'contractor' && contractorId
      ? trpc.leitwegId.listByContractor.queryOptions({ contractorId })
      : mode === 'contract' && contractId
        ? trpc.leitwegId.listByContract.queryOptions({ contractId })
        : trpc.leitwegId.list.queryOptions()),
    enabled: mode === 'contractor' ? !!contractorId : mode === 'contract' ? !!contractId : true,
  });

  const options = useMemo(
    () => (Array.isArray(query.data) ? (query.data as LeitwegIdOption[]) : []),
    [query.data],
  );

  const missingWarning = isPublicSectorBuyer && !value;

  return (
    <div className="space-y-2" data-testid="leitweg-id-inline-selector">
      {label ? <Label>{label}</Label> : null}
      <div className="flex items-center gap-2">
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className={cn(
            'flex h-10 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
          )}
          data-testid="leitweg-inline-select">
          <option value="">—</option>
          {options.map(opt => (
            <option key={opt.id} value={opt.id}>
              {opt.value}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          data-testid="leitweg-inline-add-new">
          <Plus aria-hidden="true" className="me-1 size-3.5" />
          {t('addNewLeitwegId')}
        </Button>
      </div>

      {missingWarning ? (
        <Alert variant="default" className="border-warning/50 bg-warning/10">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <AlertTitle>{t('leitwegMissingWarningHeading')}</AlertTitle>
          <AlertDescription>{t('leitwegMissingWarningBody')}</AlertDescription>
        </Alert>
      ) : null}

      <LeitwegIdCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefill={{
          contractorId: mode === 'contractor' ? (contractorId ?? null) : null,
          contractId: mode === 'contract' ? (contractId ?? null) : null,
        }}
        onSaved={id => onChange(id)}
      />
    </div>
  );
}
