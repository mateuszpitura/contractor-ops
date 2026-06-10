import type { ChangeRequestStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent, CardHeader } from '@contractor-ops/ui/components/shadcn/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { formatDistanceToNow } from 'date-fns';
import { XCircle } from 'lucide-react';
import type * as React from 'react';
import { useCallback } from 'react';

import { tDynLoose } from '../../i18n/typed-keys.js';
import { enumKey } from '../../lib/enum-key.js';
import type { useChangeRequestDiffCard as UseChangeRequestDiffCard } from './hooks/use-change-request-diff-card.js';
import { useChangeRequestDiffCard } from './hooks/use-change-request-diff-card.js';

const FIELD_LABEL_KEYS: Record<string, string> = {
  bankAccountNumber: 'bankAccount',
  bankName: 'bankName',
  swiftBic: 'swiftBic',
  taxId: 'taxId',
  displayName: 'displayName',
  phone: 'phone',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  postalCode: 'postalCode',
  countryCode: 'country',
};

interface ChangeRequestDiffCardBaseProps {
  request: {
    id: string;
    contractorName: string;
    contractorEmail: string;
    requestedChanges: Record<string, unknown>;
    previousValues: Record<string, unknown>;
    createdAt: Date | string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  };
}

export type ChangeRequestDiffCardProps = ChangeRequestDiffCardBaseProps &
  ReturnType<typeof UseChangeRequestDiffCard>;

export function ChangeRequestDiffCardView({
  request,
  t,
  rejectDialogOpen,
  setRejectDialogOpen,
  rejectComment,
  setRejectComment,
  approveMutation,
  rejectMutation,
  handleApprove,
  handleRejectConfirm,
}: ChangeRequestDiffCardProps) {
  const changedFields = Object.keys(request.requestedChanges);
  const createdAt =
    typeof request.createdAt === 'string' ? new Date(request.createdAt) : request.createdAt;
  const statusVariant = statusToVariant(
    'change-request',
    request.status as ChangeRequestStatusInput,
  );

  const openRejectDialog = useCallback(() => setRejectDialogOpen(true), [setRejectDialogOpen]);
  const handleRejectCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectComment(e.target.value),
    [setRejectComment],
  );

  function getFieldLabel(key: string): string {
    const labelKey = FIELD_LABEL_KEYS[key];
    if (labelKey) {
      return tDynLoose(t, 'fieldLabels', labelKey);
    }
    return key.replace(/([A-Z])/g, ' $1').trim();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold">{t('title')}</h4>
              <p className="text-sm text-muted-foreground">
                {request.contractorName} &middot; {request.contractorEmail}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </p>
            </div>
            {request.status !== 'PENDING' && (
              <AtelierStatusPill variant={statusVariant}>
                {tDynLoose(t, 'status', enumKey(request.status))}
              </AtelierStatusPill>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.field')}</TableHead>
                  <TableHead>{t('table.currentValue')}</TableHead>
                  <TableHead>{t('table.requestedValue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changedFields.map(key => (
                  <TableRow key={key} className="bg-muted">
                    <TableCell className="text-muted-foreground">{getFieldLabel(key)}</TableCell>
                    <TableCell>{String(request.previousValues[key] ?? '-')}</TableCell>
                    <TableCell className="font-semibold">
                      {String(request.requestedChanges[key] ?? '-')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {request.status === 'PENDING' && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending || rejectMutation.isPending}>
                {approveMutation.isPending ? t('approving') : t('approveChanges')}
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={openRejectDialog}
                disabled={approveMutation.isPending || rejectMutation.isPending}>
                {t('rejectChanges')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-4" />
              {t('rejectTitle')}
            </DialogTitle>
            <DialogDescription>{t('rejectDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              placeholder={t('rejectPlaceholder')}
              value={rejectComment}
              onChange={handleRejectCommentChange}
              rows={3}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? t('rejecting') : t('confirmRejection')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ChangeRequestDiffCard({
  request,
  onApproved,
  onRejected,
}: ChangeRequestDiffCardBaseProps & {
  onApproved?: () => void;
  onRejected?: () => void;
}) {
  const card = useChangeRequestDiffCard({
    requestId: request.id,
    onApproved,
    onRejected,
  });
  return <ChangeRequestDiffCardView request={request} {...card} />;
}
