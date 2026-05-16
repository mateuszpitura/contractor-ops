'use client';

import { CheckCircle2, MoreHorizontal, Trash2, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Bdi } from '@/components/ui/bdi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link } from '@/i18n/navigation';
import { formatMinorUnits } from '@/lib/format-currency';
import { PaymentItemBadge } from './payment-run-badge';

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
  onUpdateStatus,
  onRemoveFromRun,
  isUpdating = false,
  isRemoving = false,
}: PaymentRunItemRowProps) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const isTerminal = item.status === 'PAID' || item.status === 'FAILED';
  const isDraft = runStatus === 'DRAFT';

  // Inline form state for mark paid/failed
  const [activeAction, setActiveAction] = useState<'paid' | 'failed' | 'remove' | null>(null);
  const [reference, setReference] = useState('');
  const [failureReason, setFailureReason] = useState('');

  return (
    <div className="py-2 px-2 rounded hover:bg-muted/50 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/${item.invoiceId}`}
              className="text-primary hover:underline text-xs font-medium truncate"
              // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
              onClick={e => e.stopPropagation()}>
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

        {/* Per-item actions */}
        {!isTerminal || isDraft ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={e => {
                    e.stopPropagation();
                    props.onClick?.(e);
                  }}>
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {isTerminal ? null : (
                <>
                  <DropdownMenuItem
                    disabled={isUpdating}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => setActiveAction('paid')}>
                    <CheckCircle2 className="me-2 h-4 w-4" />
                    {t('sidePanel.markPaid')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    disabled={isUpdating}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => setActiveAction('failed')}>
                    <XCircle className="me-2 h-4 w-4" />
                    {t('sidePanel.markFailed')}
                  </DropdownMenuItem>
                </>
              )}
              {isDraft ? (
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={isRemoving}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => setActiveAction('remove')}>
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('sidePanel.removeFromRun')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Inline form for mark paid */}
      {activeAction === 'paid' ? (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t('sidePanel.referenceLabel')}</Label>
          <Input
            placeholder={t('sidePanel.referencePlaceholder')}
            value={reference}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setReference(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-6 text-xs flex-1"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                onUpdateStatus(item.id, 'PAID', reference || undefined);
                setActiveAction(null);
                setReference('');
              }}>
              {t('sidePanel.confirm')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                setActiveAction(null);
                setReference('');
              }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Inline form for mark failed */}
      {activeAction === 'failed' ? (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t('sidePanel.failureReasonLabel')}</Label>
          <Textarea
            placeholder={t('sidePanel.failureReasonPlaceholder')}
            value={failureReason}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setFailureReason(e.target.value)}
            className="h-14 text-xs resize-none"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                if (failureReason.trim()) {
                  onUpdateStatus(item.id, 'FAILED', undefined, failureReason.trim());
                  setActiveAction(null);
                  setFailureReason('');
                }
              }}
              disabled={!failureReason.trim()}>
              {t('sidePanel.confirm')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                setActiveAction(null);
                setFailureReason('');
              }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Inline confirm for remove from run */}
      {activeAction === 'remove' ? (
        <div className="mt-2 p-2 rounded border bg-destructive/5 space-y-2">
          <p className="text-xs text-muted-foreground">{t('sidePanel.removeFromRunConfirm')}</p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                onRemoveFromRun(item.invoiceId);
                setActiveAction(null);
              }}>
              {t('sidePanel.removeButton')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setActiveAction(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
