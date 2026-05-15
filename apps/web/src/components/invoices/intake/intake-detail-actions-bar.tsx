'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';
import type { IntakeStatus } from './intake-status-pill';
import type { ValidationStatus } from './intake-validation-status-pill';

interface IntakeDetailActionsBarProps {
  intakeId: string;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  /** True when a contractor candidate is currently highlighted in the match pane. */
  hasSelectedCandidate: boolean;
  className?: string;
}

/**
 * Intake-detail action bar. Sticky on mobile, inline on desktop. Renders
 * only the buttons applicable to the current state:
 *
 *   - Convert to invoice: always visible; disabled with tooltip until
 *     status === MATCHED AND (validation is VALID OR acknowledged).
 *   - Confirm match: visible only when a candidate is highlighted AND
 *     status is still PARSED / NEEDS_REVIEW.
 *   - Accept despite issues: visible only when validationStatus is
 *     WARNINGS / INVALID AND not yet acknowledged.
 *   - Reject import: destructive ghost; opens AlertDialog with a required
 *     reason textarea. Destructive button NEVER auto-focuses.
 *
 * Every mutation onSuccess invalidates the two queries the surrounding
 * detail page depends on (`invoiceIntake.getById` + `listByOrg`) so the
 * page + the sidebar counts stay in sync.
 */
export function IntakeDetailActionsBar({
  intakeId,
  status,
  validationStatus,
  validationAcknowledgedAt,
  hasSelectedCandidate,
  className,
}: IntakeDetailActionsBarProps) {
  const t = useTranslations('EInvoice.intake');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const invalidateBoth = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.invoiceIntake.getById.queryKey({ intakeId }),
    });
    void queryClient.invalidateQueries({
      queryKey: ['invoiceIntake', 'listByOrg'],
    });
  }, [intakeId, queryClient]);

  const convertMutation = useMutation(
    trpc.invoiceIntake.convertToInvoice.mutationOptions({
      onSuccess: result => {
        invalidateBoth();
        const converted = result as { invoiceId?: string } | undefined;
        if (converted?.invoiceId) {
          router.push(`/invoices/${converted.invoiceId}`);
        }
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const confirmMatchMutation = useMutation(
    trpc.invoiceIntake.confirmMatch.mutationOptions({
      onSuccess: () => invalidateBoth(),
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const acknowledgeMutation = useMutation(
    trpc.invoiceIntake.acknowledgeValidation.mutationOptions({
      onSuccess: () => invalidateBoth(),
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.invoiceIntake.reject.mutationOptions({
      onSuccess: () => {
        invalidateBoth();
        setRejectOpen(false);
        setRejectReason('');
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const needsValidationAck =
    (validationStatus === 'WARNINGS' || validationStatus === 'INVALID') &&
    !validationAcknowledgedAt;

  const canConvert = status === 'MATCHED' && !needsValidationAck && !convertMutation.isPending;

  let convertTooltip: string | null = null;
  if (status !== 'MATCHED') convertTooltip = t('tooltipConvertDisabledNeedsMatch');
  else if (needsValidationAck) convertTooltip = t('tooltipConvertDisabledNeedsAck');

  const showConfirmMatch =
    hasSelectedCandidate && status !== 'MATCHED' && status !== 'CONVERTED' && status !== 'REJECTED';
  const showAccept = needsValidationAck;
  const canReject = status !== 'CONVERTED' && status !== 'REJECTED';

  const handleRejectConfirm = useCallback(() => {
    if (rejectReason.trim().length < 3) {
      setRejectError(t('rejectReasonTooShort'));
      return;
    }
    setRejectError(null);
    rejectMutation.mutate({ intakeId, reason: rejectReason.trim() });
  }, [intakeId, rejectMutation, rejectReason, t]);

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t('pageTitle')}
        className={cn(
          'sticky bottom-0 left-0 z-20 flex flex-wrap items-center justify-end gap-2 border-t bg-card/95 p-4 backdrop-blur supports-backdrop-filter:bg-card/75 md:static md:rounded-xl md:border md:bg-card md:p-4',
          className,
        )}
        data-slot="intake-detail-actions-bar">
        {showAccept && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => acknowledgeMutation.mutate({ intakeId })}
            disabled={acknowledgeMutation.isPending}
            data-testid="intake-accept-despite-issues">
            {t('ctaAcceptDespiteIssues')}
          </Button>
        )}

        {canReject && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setRejectReason('');
              setRejectError(null);
              setRejectOpen(true);
            }}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            data-testid="intake-reject-trigger">
            {t('ctaRejectImport')}
          </Button>
        )}

        {showConfirmMatch && (
          <Button
            type="button"
            onClick={() => {
              // Confirm-match is fired by the match-pane which tracks the
              // selected candidate. Parents may also wire this button via
              // hasSelectedCandidate (this branch simply surfaces the CTA).
            }}
            disabled={confirmMatchMutation.isPending}
            data-testid="intake-confirm-match-placeholder">
            {t('ctaConfirmMatch')}
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                onClick={() => convertMutation.mutate({ intakeId })}
                disabled={!canConvert}
                data-testid="intake-convert-cta"
                aria-describedby={convertTooltip ? 'intake-convert-tooltip' : undefined}
              />
            }>
            {t('ctaConvert')}
          </TooltipTrigger>
          {convertTooltip && (
            <TooltipContent id="intake-convert-tooltip">{convertTooltip}</TooltipContent>
          )}
        </Tooltip>
      </div>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="size-4" />
              {t('rejectDialogTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('rejectDialogBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="intake-reject-reason">{t('rejectReasonPlaceholder')}</Label>
            <Textarea
              id="intake-reject-reason"
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
              placeholder={t('rejectReasonPlaceholder')}
              rows={3}
              minLength={3}
              maxLength={500}
              required
              data-testid="intake-reject-reason-input"
            />
            {rejectError && (
              <p role="alert" className="text-xs text-destructive">
                {rejectError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="intake-reject-cancel">
              {t('rejectDialogCancel')}
            </AlertDialogCancel>
            {/* Destructive action — NEVER auto-focused (per UI-SPEC § Accessibility). */}
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}
              data-testid="intake-reject-confirm"
              className="bg-destructive text-white hover:bg-destructive/90">
              {t('rejectDialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
