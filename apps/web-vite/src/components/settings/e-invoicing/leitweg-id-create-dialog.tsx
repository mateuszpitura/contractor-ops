// apps/web/src/components/settings/e-invoicing/leitweg-id-create-dialog.tsx
//
// Phase 61 · Plan 61-07 — Create / Edit Leitweg-ID dialog.
//
// Form fields (UI-SPEC §Copywriting):
//   - value (text, mono; real-time leitwegIdSchema validation)
//   - description (optional, free text)
//   - contractor (select, optional — dependent for "Set default" toggle)
//   - contract (select, optional — overrides contractor default)
//   - isDefaultForContractor (switch, disabled unless contractor chosen)
//   - validFrom + validTo (optional date text inputs; date pickers are heavier
//     than needed here and a simple <input type="date"> is keyboard-accessible
//     + locale-aware via the browser)
//   - notes (optional textarea)
//
// Validation:
//   - `value` is validated against leitwegIdSchema (structure + MOD-11-10)
//     in real-time; submission is blocked until it passes.
//   - Pair constraint (D-07/D-11): enforced server-side via Prisma @@unique
//     AND client-side via the mutation's CONFLICT → UI-SPEC locked error copy.
//
// A11y: role="alert" for the inline error; aria-describedby on value input.

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFormLayoutClassName,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { leitwegIdSchema } from '@contractor-ops/validators';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils.js';
import type { useLeitwegIdCreateDialog } from './hooks/use-leitweg-id-create-dialog.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeitwegIdDialogPrefill {
  contractorId?: string | null;
  contractId?: string | null;
}

export interface LeitwegIdEditInitial {
  id: string;
  value: string;
  description?: string | null;
  contractorId?: string | null;
  contractId?: string | null;
  isDefaultForContractor?: boolean;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
  notes?: string | null;
}

interface LeitwegIdCreateDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog renders in edit mode pre-filled from this row. */
  initial?: LeitwegIdEditInitial | null;
  /** Values to pre-populate in create mode (e.g. current contractor on profile). */
  prefill?: LeitwegIdDialogPrefill;
  /** Called with the created / updated row's id after success. */
  onSaved?: (id: string) => void;
}

export type LeitwegIdCreateDialogProps = LeitwegIdCreateDialogShellProps &
  ReturnType<typeof useLeitwegIdCreateDialog> & {
    tCommon: (key: string) => string;
    formError: string | null;
    setFormError: (error: string | null) => void;
  };

export function LeitwegIdCreateDialog({
  open,
  onOpenChange,
  initial,
  prefill,
  onSaved,
  tCommon,
  formError,
  setFormError,
  t,
  contractors,
  save,
  isPending,
}: LeitwegIdCreateDialogProps) {
  const isEdit = !!initial;

  const valueId = useId();
  const descriptionId = useId();
  const contractorSelectId = useId();
  const contractSelectId = useId();
  const defaultToggleId = useId();
  const validFromId = useId();
  const validToId = useId();
  const notesId = useId();
  const valueErrId = `${valueId}-err`;
  const formErrId = `${valueId}-form-err`;

  const [value, setValue] = useState(initial?.value ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [contractorId, setContractorId] = useState<string>(
    initial?.contractorId ?? prefill?.contractorId ?? '',
  );
  const [contractId, setContractId] = useState<string>(
    initial?.contractId ?? prefill?.contractId ?? '',
  );
  const [isDefault, setIsDefault] = useState(!!initial?.isDefaultForContractor);
  const [validFrom, setValidFrom] = useState<string>(formatDateInput(initial?.validFrom));
  const [validTo, setValidTo] = useState<string>(formatDateInput(initial?.validTo));
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');

  // Reset form whenever the dialog opens with a new initial / prefill.
  useEffect(() => {
    if (!open) return;
    setValue(initial?.value ?? '');
    setDescription(initial?.description ?? '');
    setContractorId(initial?.contractorId ?? prefill?.contractorId ?? '');
    setContractId(initial?.contractId ?? prefill?.contractId ?? '');
    setIsDefault(!!initial?.isDefaultForContractor);
    setValidFrom(formatDateInput(initial?.validFrom));
    setValidTo(formatDateInput(initial?.validTo));
    setNotes(initial?.notes ?? '');
    setFormError(null);
  }, [open, initial, prefill?.contractorId, prefill?.contractId, setFormError]);

  // Real-time Zod validation on the `value` field.
  const valueValidation = useMemo(() => {
    if (!value) return { ok: false, message: null as string | null };
    const parsed = leitwegIdSchema.safeParse(value);
    if (parsed.success) return { ok: true, message: null as string | null };
    const message = parsed.error.issues[0]?.message ?? t('errorInvalidFormat');
    return { ok: false, message };
  }, [value, t]);

  // Map Zod error messages to UI-SPEC locked copy.
  const mappedValueMessage = useMemo(() => {
    if (valueValidation.ok || !valueValidation.message) return null;
    if (valueValidation.message.toLowerCase().includes('check digit')) {
      return t('errorInvalidCheckDigit');
    }
    return t('errorInvalidFormat');
  }, [valueValidation, t]);

  const saveDisabled = !valueValidation.ok || isPending;

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!valueValidation.ok) return;

      save(
        {
          value,
          description: description.trim() || undefined,
          contractorId: contractorId || null,
          contractId: contractId || null,
          isDefaultForContractor: !!(contractorId && isDefault),
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
          notes: notes.trim() || null,
        },
        isEdit,
      );
    },
    [
      valueValidation.ok,
      save,
      value,
      description,
      contractorId,
      contractId,
      isDefault,
      validFrom,
      validTo,
      notes,
      isEdit,
    ],
  );

  const defaultToggleDisabled = !contractorId;

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value.toUpperCase()),
    [],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value),
    [],
  );
  const handleContractorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setContractorId(e.target.value),
    [],
  );
  const handleContractChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setContractId(e.target.value),
    [],
  );
  const handleDefaultChange = useCallback((v: boolean) => setIsDefault(v), []);
  const handleValidFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValidFrom(e.target.value),
    [],
  );
  const handleValidToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setValidTo(e.target.value),
    [],
  );
  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value),
    [],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="size-4" /> : <Plus className="size-4" />}
            {isEdit ? t('headingEdit') : t('headingCreate')}
          </DialogTitle>
          <DialogDescription>{t('valueHelper')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={dialogFormLayoutClassName} noValidate>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={valueId}>{t('valueLabel')}</Label>
              <Input
                id={valueId}
                name="value"
                value={value}
                onChange={handleValueChange}
                aria-invalid={!valueValidation.ok && !!value}
                aria-describedby={cn(valueErrId)}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <p className="text-sm text-muted-foreground">{t('valueHelper')}</p>
              {!valueValidation.ok && value && mappedValueMessage ? (
                <p id={valueErrId} role="alert" className="text-sm text-destructive">
                  {mappedValueMessage}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={descriptionId}>{t('descriptionLabel')}</Label>
              <Input
                id={descriptionId}
                name="description"
                value={description}
                onChange={handleDescriptionChange}
                maxLength={200}
              />
              <p className="text-sm text-muted-foreground">{t('descriptionHelper')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={contractorSelectId}>{t('contractorLabel')}</Label>
                <select
                  id={contractorSelectId}
                  name="contractorId"
                  value={contractorId}
                  onChange={handleContractorChange}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
                    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
                  )}>
                  <option value="">—</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.displayName ?? c.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={contractSelectId}>{t('contractLabel')}</Label>
                <Input
                  id={contractSelectId}
                  name="contractId"
                  value={contractId}
                  onChange={handleContractChange}
                  placeholder={t('contractIdPlaceholder')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={defaultToggleId} className="text-sm">
                {t('defaultToggle')}
              </Label>
              <Switch
                id={defaultToggleId}
                name="isDefaultForContractor"
                checked={!!(contractorId && isDefault)}
                disabled={defaultToggleDisabled}
                onCheckedChange={handleDefaultChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={validFromId}>{t('validFromLabel')}</Label>
                <Input
                  id={validFromId}
                  name="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={handleValidFromChange}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={validToId}>{t('validToLabel')}</Label>
                <Input
                  id={validToId}
                  name="validTo"
                  type="date"
                  value={validTo}
                  onChange={handleValidToChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={notesId}>{t('notesLabel')}</Label>
              <Textarea
                id={notesId}
                name="notes"
                value={notes}
                onChange={handleNotesChange}
                maxLength={2000}
                rows={3}
              />
            </div>

            {formError ? (
              <p id={formErrId} role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saveDisabled} data-testid="leitweg-save">
              {isPending ? (
                <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {t('saveButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  // yyyy-mm-dd for <input type="date">
  return date.toISOString().slice(0, 10);
}
