// Phase 61 · Plan 61-07 — Leitweg-ID inline selector for contractor profile + contract pages.
// Step 11 codemod port from apps/web/src/components/contractors/leitweg-id-inline-selector.tsx.

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { AlertTriangle, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';
import { LeitwegIdCreateDialogContainer } from '../settings/e-invoicing/leitweg-id-create-dialog-container.js';
import type { useLeitwegIdInlineSelector } from './hooks/use-leitweg-id-inline-selector.js';

export interface LeitwegIdInlineSelectorProps {
  mode: 'contractor' | 'contract';
  contractorId?: string | null;
  contractId?: string | null;
  value: string | null;
  onChange: (leitwegIdRowId: string | null) => void;
  isPublicSectorBuyer?: boolean;
  label?: string;
}

type LeitwegIdInlineSelectorViewProps = LeitwegIdInlineSelectorProps &
  Pick<ReturnType<typeof useLeitwegIdInlineSelector>, 'options'>;

export function LeitwegIdInlineSelectorView({
  mode,
  contractorId,
  contractId,
  value,
  onChange,
  isPublicSectorBuyer,
  label,
  options,
}: LeitwegIdInlineSelectorViewProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value || null),
    [onChange],
  );
  const handleOpenDialog = useCallback(() => setDialogOpen(true), []);
  const handleCreated = useCallback((id: string | null) => onChange(id), [onChange]);

  const missingWarning = isPublicSectorBuyer && !value;

  return (
    <div className="space-y-2" data-testid="leitweg-id-inline-selector">
      {label ? <Label>{label}</Label> : null}
      <div className="flex items-center gap-2">
        <select
          value={value ?? ''}
          onChange={handleSelectChange}
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
          onClick={handleOpenDialog}
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

      <LeitwegIdCreateDialogContainer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefill={{
          contractorId: mode === 'contractor' ? (contractorId ?? null) : null,
          contractId: mode === 'contract' ? (contractId ?? null) : null,
        }}
        onSaved={handleCreated}
      />
    </div>
  );
}
