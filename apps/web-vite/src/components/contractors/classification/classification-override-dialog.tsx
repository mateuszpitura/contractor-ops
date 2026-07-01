// US classification override dialog.
//
// Pure presentational — the consuming section injects the tRPC mutation via
// `onSubmit`, so this file stays free of useMutation (check:web-vite-data-layer
// compliant). Overriding the advisory outcome requires a chosen verdict, a
// non-empty reason, and an explicit acknowledgement; the server audit-logs the
// override. Uses the repo Dialog body/footer convention (scrollable DialogBody
// + pinned DialogFooter).

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
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
import { PencilLine } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { UsOverrideVerdict } from './hooks/use-us-classification.js';

export const US_OVERRIDE_VERDICTS: readonly UsOverrideVerdict[] = [
  'employee',
  'independent-contractor',
  'indeterminate',
] as const;

export interface ClassificationOverrideDialogProps {
  engagementName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { overrideVerdict: UsOverrideVerdict; reason: string }) => Promise<unknown>;
  serverError?: string;
  pending?: boolean;
}

export function ClassificationOverrideDialog({
  engagementName,
  open,
  onOpenChange,
  onSubmit,
  serverError,
  pending,
}: ClassificationOverrideDialogProps) {
  const t = useTranslations('UsClassification');
  const verdictId = useId();
  const reasonId = useId();
  const ackId = useId();
  const errorId = useId();
  const [verdict, setVerdict] = useState<UsOverrideVerdict | ''>('');
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const hasVerdict = verdict !== '';
  const reasonValid = reason.trim().length > 0;
  const submitEnabled = hasVerdict && reasonValid && acknowledged && !pending;

  const handleVerdictChange = useCallback(
    (value: UsOverrideVerdict | '' | null) => setVerdict((value ?? '') as UsOverrideVerdict | ''),
    [],
  );
  const handleReasonChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value),
    [],
  );
  const handleAckChange = useCallback((checked: boolean | 'indeterminate') => {
    setAcknowledged(checked === true);
  }, []);
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (verdict === '' || !reasonValid || !acknowledged || pending) return;
    await onSubmit({ overrideVerdict: verdict, reason: reason.trim() });
  }, [verdict, reasonValid, acknowledged, pending, onSubmit, reason]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="size-4" aria-hidden="true" />
            {t('override.title')}
          </DialogTitle>
          <DialogDescription>
            {t('override.descriptionPrefix')} <Bdi>{engagementName}</Bdi>{' '}
            {t('override.descriptionSuffix')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={verdictId}>{t('override.verdictLabel')}</Label>
            <Select value={verdict} onValueChange={handleVerdictChange} disabled={pending}>
              <SelectTrigger id={verdictId} aria-label={t('override.verdictLabel')}>
                <SelectValue placeholder={t('override.verdictPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {US_OVERRIDE_VERDICTS.map(value => (
                  <SelectItem key={value} value={value}>
                    {t(`verdict.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t('override.reasonLabel')}</Label>
            <Textarea
              id={reasonId}
              placeholder={t('override.reasonPlaceholder')}
              value={reason}
              onChange={handleReasonChange}
              disabled={pending}
              rows={4}
              maxLength={1000}
              aria-invalid={reason.length > 0 && !reasonValid}
              aria-describedby={errorId}
            />
            <p className="text-xs text-muted-foreground">{t('override.reasonHint')}</p>
          </div>

          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id={ackId}
              checked={acknowledged}
              onCheckedChange={handleAckChange}
              disabled={pending}
            />
            <Label htmlFor={ackId} className="cursor-pointer text-xs font-normal leading-relaxed">
              {t('override.ackLabel')}
            </Label>
          </div>

          {serverError ? (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            <Badge variant="secondary" className="me-2">
              {t('override.auditBadge')}
            </Badge>
            {t('override.auditNote')}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={pending}>
            {t('override.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!submitEnabled}>
            {pending ? t('override.submitting') : t('override.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
