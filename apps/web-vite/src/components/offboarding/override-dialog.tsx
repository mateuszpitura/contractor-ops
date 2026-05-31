/**
 * Phase 74 Plan 08 — Override IP_VERIFICATION dialog.
 *
 * Ported from legacy `apps/web/src/components/offboarding/override-dialog.tsx`
 * (commit 62a97d73). Pure presentational — caller injects the tRPC
 * mutation via `onSubmit`, so this file stays free of `useMutation`
 * (data-layer lint compliant) and the consuming container handles its
 * own tRPC plumbing.
 *
 * Dual validation:
 *   - reason: client min 20 chars (live)
 *   - acknowledged: must be true
 * Server (`workflow.overrideBlockingTask`) re-validates via Zod.
 *
 * UI behaviour:
 *   - submit disabled until both validations pass
 *   - dirty-check ESC → AlertDialog confirms "discard override reason?"
 *   - server error renders inline above CTA
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
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
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';

const REASON_MIN_LENGTH = 20;

export interface OverrideDialogProps {
  workflowRunId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Inject the trpc mutation hook from the consuming container. */
  onSubmit: (input: { workflowRunId: string; reason: string; acknowledged: true }) => Promise<void>;
  /** Server error message (rendered inline above CTA). */
  serverError?: string;
  /** Loading state during mutation. */
  pending?: boolean;
}

export function OverrideDialog({
  workflowRunId,
  open,
  onOpenChange,
  onSubmit,
  serverError,
  pending,
}: OverrideDialogProps) {
  const t = useTranslations('Offboarding.OverrideDialog');
  const reasonId = useId();
  const errorId = useId();
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const reasonValid = reason.trim().length >= REASON_MIN_LENGTH;
  const submitEnabled = reasonValid && acknowledged && !pending;
  const isDirty = reason.length > 0 || acknowledged;

  const attemptClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isDirty) {
        setConfirmDiscard(true);
        return;
      }
      onOpenChange(nextOpen);
    },
    [isDirty, onOpenChange],
  );

  const discardAndClose = useCallback(() => {
    setReason('');
    setAcknowledged(false);
    setConfirmDiscard(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (!submitEnabled) return;
    await onSubmit({ workflowRunId, reason: reason.trim(), acknowledged: true });
  }, [submitEnabled, workflowRunId, reason, onSubmit]);

  const handleReasonChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value),
    [],
  );

  const handleAcknowledgeChange = useCallback((v: boolean) => setAcknowledged(v === true), []);

  const handleCancelClick = useCallback(() => attemptClose(false), [attemptClose]);

  return (
    <>
      <Dialog open={open} onOpenChange={attemptClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4" />
              {t('title')}
            </DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={reasonId}>{t('reasonLabel')}</Label>
              <Textarea
                id={reasonId}
                placeholder={t('reasonPlaceholder')}
                value={reason}
                onChange={handleReasonChange}
                disabled={pending}
                rows={4}
                aria-invalid={reason.length > 0 && !reasonValid}
                aria-describedby={errorId}
              />
              {reason.length > 0 && !reasonValid && (
                <p id={errorId} className="text-xs text-destructive">
                  {t('reasonClientError')}
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 text-sm">
              <Checkbox
                id={`${reasonId}-ack`}
                checked={acknowledged}
                onCheckedChange={handleAcknowledgeChange}
                disabled={pending}
                aria-label={t('acknowledgement')}
              />
              <Label htmlFor={`${reasonId}-ack`} className="text-sm font-normal">
                {t('acknowledgement')}
              </Label>
            </div>

            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelClick} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSubmit}
              disabled={!submitEnabled}>
              {pending ? t('ctaLoading') : t('cta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t('discardConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('discardConfirm.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('discardConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndClose}>
              {t('discardConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
