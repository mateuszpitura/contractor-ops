/**
 * "Mark complete" override dialog for a terminally-failed deprovisioning step.
 * Pure presentational — the consuming container injects the tRPC mutation via
 * `onSubmit`, so this file stays free of useMutation (check:web-vite-data-layer
 * compliant). Category dropdown (closed enum) + a free-text rationale with
 * client min-20 validation (server is authoritative).
 */

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
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { CheckCircle2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

const NOTE_MIN_LENGTH = 20;

export const MANUAL_OVERRIDE_CATEGORIES = [
  'verified_via_vendor_console',
  'user_already_inactive',
  'provider_endpoint_deprecated',
  'transient_provider_issue_resolved',
  'other',
] as const;

export type ManualOverrideCategory = (typeof MANUAL_OVERRIDE_CATEGORIES)[number];

export interface OverrideStepDialogProps {
  stepId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Inject the trpc mutation hook from the consuming container. */
  onSubmit: (input: {
    stepId: string;
    category: ManualOverrideCategory;
    note: string;
  }) => Promise<void>;
  serverError?: string;
  pending?: boolean;
}

export function OverrideStepDialog({
  stepId,
  open,
  onOpenChange,
  onSubmit,
  serverError,
  pending,
}: OverrideStepDialogProps) {
  const t = useTranslations('Idp.OverrideStepDialog');
  const noteId = useId();
  const errorId = useId();
  const [category, setCategory] = useState<ManualOverrideCategory | ''>('');
  const [note, setNote] = useState('');

  const hasCategory = category !== '';
  const noteValid = note.trim().length >= NOTE_MIN_LENGTH;
  const submitEnabled = hasCategory && noteValid && !pending;

  const handleNoteChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!(noteValid && !pending) || category === '') return;
    await onSubmit({ stepId, category, note: note.trim() });
  }, [noteValid, pending, stepId, category, note, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${noteId}-category`}>{t('categoryLabel')}</Label>
            <Select
              value={category}
              onValueChange={value => setCategory(value as ManualOverrideCategory)}
              disabled={pending}>
              <SelectTrigger id={`${noteId}-category`} aria-label={t('categoryLabel')}>
                <SelectValue placeholder={t('categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_OVERRIDE_CATEGORIES.map(value => (
                  <SelectItem key={value} value={value}>
                    {t(`category.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={noteId}>{t('noteLabel')}</Label>
            <Textarea
              id={noteId}
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={handleNoteChange}
              disabled={pending}
              rows={4}
              aria-invalid={note.length > 0 && !noteValid}
              aria-describedby={errorId}
            />
            {note.length > 0 && !noteValid && (
              <p id={errorId} className="text-xs text-destructive">
                {t('noteClientError')}
              </p>
            )}
          </div>

          {serverError ? (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!submitEnabled}>
            {pending ? t('ctaLoading') : t('cta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
