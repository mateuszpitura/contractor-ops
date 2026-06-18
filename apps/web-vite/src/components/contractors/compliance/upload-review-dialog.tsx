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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { useCallback, useId, useState } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { RejectReasonCategory } from './hooks/use-upload-review.js';
import { REJECT_REASON_CATEGORIES, useUploadReview } from './hooks/use-upload-review.js';

export interface UploadReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  /** Pre-filled expiry (contractor-suggested + policy default), editable on approve. */
  defaultExpiresAt: string;
  onApprove: (input: { expiresAt: string }) => void;
  onReject: (input: { reasonCategory: RejectReasonCategory; freeText?: string }) => void;
}

/**
 * Admin approve/reject UI for a PENDING_REVIEW upload. Two tabs
 * (Approve = editable expiresAt; Reject = closed-enum reason + free text).
 * Content in DialogBody, actions in DialogFooter (web-vite dialog convention).
 */
export function UploadReviewDialog({
  open,
  onOpenChange,
  isPending,
  defaultExpiresAt,
  onApprove,
  onReject,
}: UploadReviewDialogProps) {
  const t = useTranslations('Compliance.uploadReview');
  const expiresAtId = useId();
  const reasonId = useId();
  const freeTextId = useId();
  const [tab, setTab] = useState<'approve' | 'reject'>('approve');
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);
  const [reasonCategory, setReasonCategory] = useState<RejectReasonCategory | ''>('');
  const [freeText, setFreeText] = useState('');

  const handleTabChange = useCallback((value: string) => setTab(value as 'approve' | 'reject'), []);
  const handleExpiresAtChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setExpiresAt(e.target.value),
    [],
  );
  const handleReasonChange = useCallback(
    (value: RejectReasonCategory | '' | null) => setReasonCategory(value ?? ''),
    [],
  );
  const handleFreeTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setFreeText(e.target.value),
    [],
  );
  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
  const handleApprove = useCallback(() => onApprove({ expiresAt }), [onApprove, expiresAt]);
  const handleReject = useCallback(() => {
    if (reasonCategory !== '') {
      onReject({ reasonCategory, freeText: freeText.trim() || undefined });
    }
  }, [onReject, reasonCategory, freeText]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approve">{t('approveTab')}</TabsTrigger>
              <TabsTrigger value="reject">{t('rejectTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="approve" className="flex flex-col gap-2 pt-4">
              <Label htmlFor={expiresAtId}>{t('expiresAtLabel')}</Label>
              <Input
                id={expiresAtId}
                type="date"
                value={expiresAt}
                onChange={handleExpiresAtChange}
                className="max-w-xs"
              />
            </TabsContent>

            <TabsContent value="reject" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={reasonId}>{t('reasonLabel')}</Label>
                <Select value={reasonCategory} onValueChange={handleReasonChange}>
                  <SelectTrigger id={reasonId}>
                    <SelectValue placeholder={t('reasonPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {REJECT_REASON_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {tDynLoose(t, 'reason', category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={freeTextId}>{t('freeTextLabel')}</Label>
                <Textarea
                  id={freeTextId}
                  value={freeText}
                  onChange={handleFreeTextChange}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
          {tab === 'approve' ? (
            <Button disabled={!expiresAt || isPending} onClick={handleApprove}>
              {t('confirmApprove')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={reasonCategory === '' || isPending}
              onClick={handleReject}>
              {t('confirmReject')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface UploadReviewDialogContainerProps {
  itemId: string;
  documentId: string;
  defaultExpiresAt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadReviewDialogContainer({
  itemId,
  documentId,
  defaultExpiresAt,
  open,
  onOpenChange,
}: UploadReviewDialogContainerProps) {
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);
  const { approve, reject, isPending } = useUploadReview(handleClose);

  const handleApprove = useCallback(
    ({ expiresAt }: { expiresAt: string }) => approve({ itemId, documentId, expiresAt }),
    [approve, itemId, documentId],
  );
  const handleReject = useCallback(
    ({ reasonCategory, freeText }: { reasonCategory: RejectReasonCategory; freeText?: string }) =>
      reject({ itemId, documentId, reasonCategory, freeText }),
    [reject, itemId, documentId],
  );

  return (
    <UploadReviewDialog
      open={open}
      onOpenChange={onOpenChange}
      isPending={isPending}
      defaultExpiresAt={defaultExpiresAt}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
