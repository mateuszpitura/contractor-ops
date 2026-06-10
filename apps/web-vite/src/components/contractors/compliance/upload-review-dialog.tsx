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
import { useState } from 'react';
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
  const [tab, setTab] = useState<'approve' | 'reject'>('approve');
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);
  const [reasonCategory, setReasonCategory] = useState<RejectReasonCategory | ''>('');
  const [freeText, setFreeText] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Tabs value={tab} onValueChange={value => setTab(value as 'approve' | 'reject')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="approve">{t('approveTab')}</TabsTrigger>
              <TabsTrigger value="reject">{t('rejectTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="approve" className="flex flex-col gap-2 pt-4">
              <Label htmlFor="review-expires-at">{t('expiresAtLabel')}</Label>
              <Input
                id="review-expires-at"
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="max-w-xs"
              />
            </TabsContent>

            <TabsContent value="reject" className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="review-reason">{t('reasonLabel')}</Label>
                <Select
                  value={reasonCategory}
                  onValueChange={value => setReasonCategory(value as RejectReasonCategory)}>
                  <SelectTrigger id="review-reason">
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
                <Label htmlFor="review-freetext">{t('freeTextLabel')}</Label>
                <Textarea
                  id="review-freetext"
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('cancel')}
          </Button>
          {tab === 'approve' ? (
            <Button disabled={!expiresAt || isPending} onClick={() => onApprove({ expiresAt })}>
              {t('confirmApprove')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={reasonCategory === '' || isPending}
              onClick={() => {
                if (reasonCategory !== '') {
                  onReject({ reasonCategory, freeText: freeText.trim() || undefined });
                }
              }}>
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
  const { approve, reject, isPending } = useUploadReview(() => onOpenChange(false));

  return (
    <UploadReviewDialog
      open={open}
      onOpenChange={onOpenChange}
      isPending={isPending}
      defaultExpiresAt={defaultExpiresAt}
      onApprove={({ expiresAt }) => approve({ itemId, documentId, expiresAt })}
      onReject={({ reasonCategory, freeText }) =>
        reject({ itemId, documentId, reasonCategory, freeText })
      }
    />
  );
}
