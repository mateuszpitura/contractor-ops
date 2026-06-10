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
import { useState } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { OverrideReasonCategory } from './hooks/use-override-compliance-item.js';
import {
  OVERRIDE_REASON_CATEGORIES,
  useOverrideComplianceItem,
} from './hooks/use-override-compliance-item.js';

const MIN_NOTE_LENGTH = 20;

export interface OverrideComplianceItemDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (input: { reasonCategory: OverrideReasonCategory; reasonNote: string }) => void;
}

/**
 * Manual-override modal view (one shared component, mounted on the Compliance
 * tab and the dashboard rows). Content lives in DialogBody, actions in
 * DialogFooter (web-vite dialog convention). Submit is disabled until a reason
 * category is chosen AND the note is at least 20 chars.
 */
export function OverrideComplianceItemDialogView({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: OverrideComplianceItemDialogViewProps) {
  const t = useTranslations('Compliance.override');
  const [reasonCategory, setReasonCategory] = useState<OverrideReasonCategory | ''>('');
  const [reasonNote, setReasonNote] = useState('');

  const isValid = reasonCategory !== '' && reasonNote.trim().length >= MIN_NOTE_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="override-reason-category">{t('categoryLabel')}</Label>
            <Select
              value={reasonCategory}
              onValueChange={value => setReasonCategory(value as OverrideReasonCategory)}>
              <SelectTrigger id="override-reason-category">
                <SelectValue placeholder={t('categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASON_CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>
                    {tDynLoose(t, 'category', category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="override-reason-note">{t('noteLabel')}</Label>
            <Textarea
              id="override-reason-note"
              value={reasonNote}
              onChange={e => setReasonNote(e.target.value)}
              placeholder={t('notePlaceholder')}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t('noteMinHint', { min: MIN_NOTE_LENGTH })}
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button
            disabled={!isValid || isPending}
            onClick={() => {
              if (reasonCategory !== '') {
                onSubmit({ reasonCategory, reasonNote: reasonNote.trim() });
              }
            }}>
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface OverrideComplianceItemDialogContainerProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OverrideComplianceItemDialogContainer({
  itemId,
  open,
  onOpenChange,
}: OverrideComplianceItemDialogContainerProps) {
  const { override, isPending } = useOverrideComplianceItem(() => onOpenChange(false));

  return (
    <OverrideComplianceItemDialogView
      open={open}
      onOpenChange={onOpenChange}
      isPending={isPending}
      onSubmit={({ reasonCategory, reasonNote }) =>
        override({ itemId, reasonCategory, reasonNote })
      }
    />
  );
}

/** @deprecated Use OverrideComplianceItemDialog */
export { OverrideComplianceItemDialogContainer as OverrideComplianceItemDialog };
