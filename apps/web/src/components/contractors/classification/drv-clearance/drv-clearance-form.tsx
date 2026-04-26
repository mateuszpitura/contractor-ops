// Phase 60 · CLASS-09 — DRV clearance create/edit form (shadcn Dialog + form).
// See .planning/phases/60-classification-polish/60-UI-SPEC.md §CLASS-09.
//
// Zod validation mirrors the server schema in
// packages/api/src/routers/statusfeststellungsverfahren.ts. Server-side
// validation is still authoritative per CLAUDE.md "never trust client input".

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

type Outcome = 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';

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

export function DrvClearanceForm({
  open,
  onOpenChange,
  contractorAssignmentId,
  initial,
}: DrvClearanceFormProps) {
  const t = useTranslations('Classification.polish.drvClearance');
  const queryClient = useQueryClient();
  const formId = useId();

  const [filedAt, setFiledAt] = useState(formatDateInput(initial?.filedAt ?? new Date()));
  const [drvReference, setDrvReference] = useState(initial?.drvReference ?? '');
  const [outcome, setOutcome] = useState<Outcome>(initial?.outcome ?? 'PENDING');
  const [validFrom, setValidFrom] = useState(formatDateInput(initial?.validFrom));
  const [validTo, setValidTo] = useState(formatDateInput(initial?.validTo));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation(
    trpc.statusfeststellungsverfahren.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['statusfeststellungsverfahren', 'listByEngagement']],
        });
        onOpenChange(false);
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.statusfeststellungsverfahren.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [['statusfeststellungsverfahren', 'listByEngagement']],
        });
        onOpenChange(false);
      },
    }),
  );

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

  const showValidityDates = outcome === 'SELBSTANDIG' || outcome === 'ABHANGIG';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t('editHeading') : t('createHeading')}</DialogTitle>
          <DialogDescription>{t('panelSubline')}</DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={handleSubmit} className="grid gap-4 py-2" noValidate>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-filedAt`}>{t('filedAtLabel')}</Label>
            <Input
              id={`${formId}-filedAt`}
              type="date"
              value={filedAt}
              onChange={e => setFiledAt(e.target.value)}
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
              onChange={e => setDrvReference(e.target.value)}
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
            <Select value={outcome} onValueChange={v => setOutcome(v as Outcome)}>
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
                  onChange={e => setValidFrom(e.target.value)}
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
                  onChange={e => setValidTo(e.target.value)}
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
              onChange={e => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
