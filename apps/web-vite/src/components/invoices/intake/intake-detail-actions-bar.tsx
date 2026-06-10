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
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { Download, FileText, Loader2, XCircle } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import { useIntakeDetailActions } from '../hooks/use-intake-detail-actions.js';
import type { IntakeStatus } from './intake-status-pill.js';
import type { ValidationStatus } from './intake-validation-status-pill.js';

export interface IntakeDetailActionsBarViewProps {
  actions: ReturnType<typeof useIntakeDetailActions>;
  className?: string;
}

export function IntakeDetailActionsBarView({ actions, className }: IntakeDetailActionsBarViewProps) {
  const t = useTranslations('EInvoice.intake');
  const setRejectReason = actions.setRejectReason;
  const handleRejectReasonChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setRejectReason(event.target.value);
    },
    [setRejectReason],
  );

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t('pageTitle')}
        className={cn(
          'sticky bottom-0 start-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t bg-card/95 p-4 backdrop-blur supports-backdrop-filter:bg-card/75 md:static md:rounded-xl md:border md:bg-card md:p-4',
          className,
        )}
        data-slot="intake-detail-actions-bar">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={actions.onDownloadXml}
            disabled={actions.isXmlPending}
            data-testid="intake-download-xml">
            {actions.isXmlPending ? (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="me-1.5 h-3.5 w-3.5" />
            )}
            {t('ctaDownloadXml')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={actions.onDownloadReport}
            disabled={actions.isReportPending}
            data-testid="intake-download-report">
            {actions.isReportPending ? (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="me-1.5 h-3.5 w-3.5" />
            )}
            {t('ctaDownloadValidationReport')}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions.showAccept && (
            <Button
              type="button"
              variant="secondary"
              onClick={actions.onAcknowledge}
              disabled={actions.isAcknowledgePending}
              data-testid="intake-accept-despite-issues">
              {t('ctaAcceptDespiteIssues')}
            </Button>
          )}

          {actions.canReject && (
            <Button
              type="button"
              variant="ghost"
              onClick={actions.openRejectDialog}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              data-testid="intake-reject-trigger">
              {t('ctaRejectImport')}
            </Button>
          )}

          {actions.showConfirmMatch && (
            <Button
              type="button"
              onClick={actions.onConfirmMatch}
              disabled={actions.isConfirmMatchPending}
              data-testid="intake-confirm-match">
              {actions.isConfirmMatchPending ? (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {t('ctaConfirmMatch')}
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  onClick={actions.onConvert}
                  disabled={!actions.canConvert}
                  data-testid="intake-convert-cta"
                  aria-describedby={actions.convertTooltip ? 'intake-convert-tooltip' : undefined}
                />
              }>
              {t('ctaConvert')}
            </TooltipTrigger>
            {actions.convertTooltip && (
              <TooltipContent id="intake-convert-tooltip">{actions.convertTooltip}</TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      <AlertDialog open={actions.rejectOpen} onOpenChange={actions.setRejectOpen}>
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
              value={actions.rejectReason}
              onChange={handleRejectReasonChange}
              placeholder={t('rejectReasonPlaceholder')}
              rows={3}
              minLength={3}
              maxLength={500}
              required
              data-testid="intake-reject-reason-input"
            />
            {actions.rejectError && (
              <p role="alert" className="text-xs text-destructive">
                {actions.rejectError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="intake-reject-cancel">
              {t('rejectDialogCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.onRejectConfirm}
              disabled={actions.isRejectPending}
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

export interface IntakeDetailActionsBarProps {
  intakeId: string;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
  validationAcknowledgedAt: Date | string | null;
  selectedCandidateId: string | null;
  className?: string;
}

export function IntakeDetailActionsBar(props: IntakeDetailActionsBarProps) {
  const actions = useIntakeDetailActions(
    props.intakeId,
    props.status,
    props.validationStatus,
    props.validationAcknowledgedAt,
    props.selectedCandidateId,
  );

  return <IntakeDetailActionsBarView actions={actions} className={props.className} />;
}
