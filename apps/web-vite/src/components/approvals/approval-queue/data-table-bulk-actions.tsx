import { iconSize } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useApprovalQueueBulkActions } from '../hooks/use-approval-queue-bulk-actions.js';

interface ApprovalBulkActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  bulkActions: ReturnType<typeof useApprovalQueueBulkActions>;
}

/**
 * Inline bulk-action bar for the approvals queue. Mirrors the canonical
 * contractors `DataTableBulkActions` shape — count chip + outline icon
 * buttons rendered between the toolbar and the table shell. The rejection
 * reason dialog stays mounted alongside so reject reason capture survives
 * the visual unification.
 */
export function ApprovalBulkActions({
  selectedIds,
  onClearSelection,
  bulkActions,
}: ApprovalBulkActionsProps) {
  const t = useTranslations('Approvals');
  const reactId = useId();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const handleApprove = useCallback(() => {
    bulkActions.onBulkApprove(selectedIds);
  }, [bulkActions, selectedIds]);

  const handleReject = useCallback(() => {
    if (rejectComment.length >= 10) {
      bulkActions.onBulkReject(selectedIds, rejectComment);
      setRejectOpen(false);
      setRejectComment('');
    }
  }, [bulkActions, selectedIds, rejectComment]);

  const handleOpenReject = useCallback(() => setRejectOpen(true), []);
  const handleRejectCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectComment(e.target.value),
    [],
  );
  const handleDismissReject = useCallback(() => {
    setRejectOpen(false);
    setRejectComment('');
  }, []);

  const count = selectedIds.length;
  if (count === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{t('bulk.selectedCount', { count })}</span>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={bulkActions.isBulkApproving}
          onClick={handleApprove}>
          {bulkActions.isBulkApproving ? (
            <Loader2 className={`${iconSize.sm} animate-spin`} />
          ) : (
            <CheckCircle2 className={iconSize.sm} />
          )}
          {t('bulk.approve', { count })}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          onClick={handleOpenReject}>
          <XCircle className={iconSize.sm} />
          {t('bulk.reject', { count })}
        </Button>

        <Button variant="ghost" size="sm" className="h-8 ms-auto" onClick={onClearSelection}>
          {t('bulk.clear')}
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bulkRejectDialog.heading', { count })}</DialogTitle>
            <DialogDescription>{t('bulkRejectDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor={`${reactId}-bulk-reject-comment`}
              className="text-[12px] font-medium text-muted-foreground">
              {t('bulkRejectDialog.commentLabel')}
            </label>
            <Textarea
              id={`${reactId}-bulk-reject-comment`}
              value={rejectComment}
              onChange={handleRejectCommentChange}
              placeholder={t('bulkRejectDialog.commentPlaceholder')}
              className="min-h-[100px]"
            />
            {rejectComment.length > 0 && rejectComment.length < 10 && (
              <p className="text-[12px] text-destructive">{t('rejectPopover.minChars')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={handleDismissReject}>
              {t('bulkRejectDialog.dismiss')}
            </Button>
            <Button
              variant="destructive"
              disabled={rejectComment.length < 10 || bulkActions.isBulkRejecting}
              onClick={handleReject}>
              {!!bulkActions.isBulkRejecting && (
                <Loader2 className={`me-1 ${iconSize.sm} animate-spin`} />
              )}
              {t('bulkRejectDialog.confirm', { count })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
