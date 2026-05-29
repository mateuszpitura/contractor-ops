import { Bdi } from '@contractor-ops/ui/components/shadcn/bdi';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { CheckCircle2, MoreHorizontal, Trash2, XCircle } from 'lucide-react';
import type * as React from 'react';
import { memo, useCallback, useState } from 'react';

import { Link, useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../lib/format-currency.js';
import { PaymentItemBadge } from './payment-run-badge.js';
import { SkontoApplyCheckboxContainer } from './run/skonto-apply-checkbox-container.js';

function stopAnchorPropagation(e: React.MouseEvent<HTMLAnchorElement>) {
  e.stopPropagation();
}

type ButtonProps = React.ComponentProps<typeof Button>;

const DropdownTriggerButton = memo(function DropdownTriggerButton({
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = useCallback<NonNullable<ButtonProps['onClick']>>(
    e => {
      e.stopPropagation();
      onClick?.(e);
    },
    [onClick],
  );
  return (
    <Button
      {...rest}
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleClick}>
      <MoreHorizontal className="h-3 w-3" />
    </Button>
  );
});

export interface PaymentRunItem {
  id: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  invoice: { invoiceNumber: string };
  contractor: { id: string; legalName: string };
}

export interface PaymentRunItemRowProps {
  item: PaymentRunItem;
  runStatus: string;
  skontoEnabled?: boolean;
  onUpdateStatus: (
    itemId: string,
    status: 'PAID' | 'FAILED',
    reference?: string,
    reason?: string,
  ) => void;
  onRemoveFromRun: (invoiceId: string) => void;
  isUpdating?: boolean;
  isRemoving?: boolean;
}

export function PaymentRunItemRow({
  item,
  runStatus,
  skontoEnabled = false,
  onUpdateStatus,
  onRemoveFromRun,
  isUpdating = false,
  isRemoving = false,
}: PaymentRunItemRowProps) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const isTerminal = item.status === 'PAID' || item.status === 'FAILED';
  const isDraft = runStatus === 'DRAFT';

  const [activeAction, setActiveAction] = useState<'paid' | 'failed' | 'remove' | null>(null);
  const [reference, setReference] = useState('');
  const [failureReason, setFailureReason] = useState('');

  const handleMarkPaidStart = useCallback(() => setActiveAction('paid'), []);
  const handleMarkFailedStart = useCallback(() => setActiveAction('failed'), []);
  const handleRemoveStart = useCallback(() => setActiveAction('remove'), []);

  const handleReferenceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setReference(e.target.value),
    [],
  );
  const handleFailureReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setFailureReason(e.target.value),
    [],
  );

  const handleConfirmPaid = useCallback(() => {
    onUpdateStatus(item.id, 'PAID', reference || undefined);
    setActiveAction(null);
    setReference('');
  }, [onUpdateStatus, item.id, reference]);
  const handleCancelPaid = useCallback(() => {
    setActiveAction(null);
    setReference('');
  }, []);

  const handleConfirmFailed = useCallback(() => {
    const trimmed = failureReason.trim();
    if (trimmed) {
      onUpdateStatus(item.id, 'FAILED', undefined, trimmed);
      setActiveAction(null);
      setFailureReason('');
    }
  }, [onUpdateStatus, item.id, failureReason]);
  const handleCancelFailed = useCallback(() => {
    setActiveAction(null);
    setFailureReason('');
  }, []);

  const handleConfirmRemove = useCallback(() => {
    onRemoveFromRun(item.invoiceId);
    setActiveAction(null);
  }, [onRemoveFromRun, item.invoiceId]);
  const handleCancelRemove = useCallback(() => setActiveAction(null), []);

  return (
    <div className="py-2 px-2 rounded hover:bg-muted/50 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/${item.invoiceId}`}
              className="text-primary hover:underline text-xs font-medium truncate"
              onClick={stopAnchorPropagation}>
              <Bdi>{item.invoice.invoiceNumber}</Bdi>
            </Link>
            <PaymentItemBadge status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            <Bdi>{item.contractor.legalName}</Bdi>
          </p>
          {item.paymentReference ? (
            <p className="text-[12px] text-muted-foreground">
              {t('paymentRef', { reference: item.paymentReference })}
            </p>
          ) : null}
        </div>
        <span className="font-mono text-xs tabular-nums whitespace-nowrap">
          {formatMinorUnits(item.amountMinor, item.currency, locale)}
        </span>

        {!isTerminal || isDraft ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<DropdownTriggerButton />} />
            <DropdownMenuContent align="end">
              {isTerminal ? null : (
                <>
                  <DropdownMenuItem disabled={isUpdating} onClick={handleMarkPaidStart}>
                    <CheckCircle2 className="me-2 h-4 w-4" />
                    {t('sidePanel.markPaid')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={isUpdating}
                    onClick={handleMarkFailedStart}>
                    <XCircle className="me-2 h-4 w-4" />
                    {t('sidePanel.markFailed')}
                  </DropdownMenuItem>
                </>
              )}
              {isDraft ? (
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={isRemoving}
                  onClick={handleRemoveStart}>
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('sidePanel.removeFromRun')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {skontoEnabled && item.currency === 'EUR' ? (
        <div className="mt-2 ps-2">
          <SkontoApplyCheckboxContainer
            paymentRunItemId={item.id}
            invoiceId={item.invoiceId}
            enabled={skontoEnabled}
          />
        </div>
      ) : null}

      {activeAction === 'paid' ? (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t('sidePanel.referenceLabel')}</Label>
          <Input
            placeholder={t('sidePanel.referencePlaceholder')}
            value={reference}
            onChange={handleReferenceChange}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-xs flex-1" onClick={handleConfirmPaid}>
              {t('sidePanel.confirm')}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleCancelPaid}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {activeAction === 'failed' ? (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t('sidePanel.failureReasonLabel')}</Label>
          <Textarea
            placeholder={t('sidePanel.failureReasonPlaceholder')}
            value={failureReason}
            onChange={handleFailureReasonChange}
            className="h-14 text-xs resize-none"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              onClick={handleConfirmFailed}
              disabled={!failureReason.trim()}>
              {t('sidePanel.confirm')}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleCancelFailed}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {activeAction === 'remove' ? (
        <div className="mt-2 p-2 rounded border bg-destructive/5 space-y-2">
          <p className="text-xs text-muted-foreground">{t('sidePanel.removeFromRunConfirm')}</p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              onClick={handleConfirmRemove}>
              {t('sidePanel.removeButton')}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleCancelRemove}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
