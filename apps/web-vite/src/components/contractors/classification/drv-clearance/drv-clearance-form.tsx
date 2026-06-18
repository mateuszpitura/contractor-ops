// DRV clearance create/edit form (shadcn Dialog + form).
//
// Zod validation mirrors the server schema in
// packages/api/src/routers/statusfeststellungsverfahren.ts. Server-side
// validation is still authoritative per CLAUDE.md "never trust client input".

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useCallback, useId, useState } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import type {
  Outcome,
  useDrvClearanceFormMutations as UseDrvClearanceFormMutations,
} from '../hooks/use-drv-clearance.js';
import { useDrvClearanceFormMutations } from '../hooks/use-drv-clearance.js';

export interface DrvClearanceFormInitial {
  id: string;
  filedAt: Date;
  drvReference: string;
  outcome: Outcome;
  validFrom: Date | null;
  validTo: Date | null;
  notes: string | null;
}

export interface DrvClearanceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorAssignmentId: string;
  initial?: DrvClearanceFormInitial;
}

function formatDateInput(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

export type DrvClearanceFormViewProps = DrvClearanceFormProps &
  ReturnType<typeof UseDrvClearanceFormMutations>;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cohesive controlled DRV clearance form — six fields with per-field error/aria branches, conditional validity-date section, and create/edit dispatch read clearest in one component
export function DrvClearanceFormView({
  open,
  onOpenChange,
  contractorAssignmentId,
  initial,
  createMutation,
  updateMutation,
}: DrvClearanceFormViewProps) {
  const t = useTranslations('Classification.polish.drvClearance');
  const formId = useId();

  const [filedAt, setFiledAt] = useState(formatDateInput(initial?.filedAt ?? new Date()));
  const [drvReference, setDrvReference] = useState(initial?.drvReference ?? '');
  const [outcome, setOutcome] = useState<Outcome>(initial?.outcome ?? 'PENDING');
  const [validFrom, setValidFrom] = useState(formatDateInput(initial?.validFrom));
  const [validTo, setValidTo] = useState(formatDateInput(initial?.validTo));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!drvReference.trim()) {
      next.drvReference = t('errorDrvReferenceRequired');
    } else if (drvReference.length > 100) {
      next.drvReference = t('errorDrvReferenceTooLong');
    }
    if (!filedAt) next.filedAt = t('errorFiledAtRequired');
    if (outcome === 'SELBSTANDIG' || outcome === 'ABHANGIG') {
      if (!validFrom) next.validFrom = t('errorValidFromRequired');
      if (!validTo) next.validTo = t('errorValidToRequired');
    }
    return next;
  }, [drvReference, filedAt, outcome, validFrom, validTo, t]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      const payload = {
        filedAt: new Date(filedAt),
        drvReference: drvReference.trim(),
        outcome,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validTo: validTo ? new Date(validTo) : undefined,
        notes: notes.trim() || undefined,
      };

      if (initial) {
        updateMutation.mutate({ id: initial.id, ...payload });
      } else {
        createMutation.mutate({ contractorAssignmentId, ...payload });
      }
    },
    [
      validate,
      initial,
      updateMutation,
      createMutation,
      contractorAssignmentId,
      filedAt,
      drvReference,
      outcome,
      validFrom,
      validTo,
      notes,
    ],
  );

  const handleFiledAtChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFiledAt(e.target.value),
    [],
  );
  const handleDrvReferenceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDrvReference(e.target.value),
    [],
  );
  const handleOutcomeChange = useCallback(
    (v: string | null) => setOutcome((v ?? 'PENDING') as Outcome),
    [],
  );
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
  const handleCancelClick = useCallback(() => onOpenChange(false), [onOpenChange]);

  const showValidityDates = outcome === 'SELBSTANDIG' || outcome === 'ABHANGIG';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t('editHeading') : t('createHeading')}</DialogTitle>
          <DialogDescription>{t('panelSubline')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={formId} onSubmit={handleSubmit} className="grid gap-4 py-2" noValidate>
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-filedAt`}>{t('filedAtLabel')}</Label>
              <Input
                id={`${formId}-filedAt`}
                type="date"
                value={filedAt}
                onChange={handleFiledAtChange}
                aria-invalid={Boolean(errors.filedAt)}
                aria-describedby={errors.filedAt ? `${formId}-filedAt-error` : undefined}
                required
              />
              {errors.filedAt ? (
                <p id={`${formId}-filedAt-error`} role="alert" className="text-sm text-destructive">
                  {errors.filedAt}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${formId}-drvReference`}>{t('drvReferenceLabel')}</Label>
              <Input
                id={`${formId}-drvReference`}
                value={drvReference}
                onChange={handleDrvReferenceChange}
                maxLength={100}
                aria-invalid={Boolean(errors.drvReference)}
                aria-describedby={`${formId}-drvReference-helper ${
                  errors.drvReference ? `${formId}-drvReference-error` : ''
                }`.trim()}
                required
              />
              <p id={`${formId}-drvReference-helper`} className="text-xs text-muted-foreground">
                {t('drvReferenceHelper')}{' '}
                <a
                  href="https://www.deutsche-rentenversicherung.de/DRV/DE/Experten/Arbeitgeber-und-Steuerberater/Versicherung-und-Beitraege/Statusfeststellung/statusfeststellung_node.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline">
                  {t('helpTextLink')}
                </a>
              </p>
              {errors.drvReference ? (
                <p
                  id={`${formId}-drvReference-error`}
                  role="alert"
                  className="text-sm text-destructive">
                  {errors.drvReference}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${formId}-outcome`}>{t('outcomeLabel')}</Label>
              <Select value={outcome} onValueChange={handleOutcomeChange}>
                <SelectTrigger id={`${formId}-outcome`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">{t('outcomePending')}</SelectItem>
                  <SelectItem value="SELBSTANDIG">{t('outcomeSelbstandig')}</SelectItem>
                  <SelectItem value="ABHANGIG">{t('outcomeAbhangig')}</SelectItem>
                  <SelectItem value="WITHDRAWN">{t('outcomeWithdrawn')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showValidityDates ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor={`${formId}-validFrom`}>{t('validFromLabel')}</Label>
                  <Input
                    id={`${formId}-validFrom`}
                    type="date"
                    value={validFrom}
                    onChange={handleValidFromChange}
                    aria-invalid={Boolean(errors.validFrom)}
                    aria-describedby={errors.validFrom ? `${formId}-validFrom-error` : undefined}
                  />
                  {errors.validFrom ? (
                    <p
                      id={`${formId}-validFrom-error`}
                      role="alert"
                      className="text-sm text-destructive">
                      {errors.validFrom}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${formId}-validTo`}>{t('validToLabel')}</Label>
                  <Input
                    id={`${formId}-validTo`}
                    type="date"
                    value={validTo}
                    onChange={handleValidToChange}
                    aria-invalid={Boolean(errors.validTo)}
                    aria-describedby={errors.validTo ? `${formId}-validTo-error` : undefined}
                  />
                  {errors.validTo ? (
                    <p
                      id={`${formId}-validTo-error`}
                      role="alert"
                      className="text-sm text-destructive">
                      {errors.validTo}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor={`${formId}-notes`}>{t('notesLabel')}</Label>
              <Textarea
                id={`${formId}-notes`}
                value={notes}
                onChange={handleNotesChange}
                maxLength={2000}
                rows={3}
              />
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancelClick}>
            {t('cancelAction')}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={createMutation.isPending || updateMutation.isPending}>
            {initial ? t('updateConfirm') : t('createConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DrvClearanceForm(props: DrvClearanceFormProps) {
  const mutations = useDrvClearanceFormMutations(() => props.onOpenChange(false));
  return <DrvClearanceFormView {...props} {...mutations} />;
}
