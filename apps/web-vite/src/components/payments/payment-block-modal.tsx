// Payment-block modal (presentational; props in / JSX out).
//
// Surfaces the structured PRECONDITION_FAILED.cause.contractorReasons payload
// at the payment-write entry points. One collapsible section per contractor, each
// listing the expired BLOCKING documents with a deep link into the compliance item.
//
// Vite SPA — NO next-intl / next/link / 'use client'. i18n via the custom
// useTranslations hook; deep links via the locale-aware TanStack Router Link.

import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { AlertTriangle, ChevronDown, ExternalLink } from 'lucide-react';
import { useCallback, useId } from 'react';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';

export interface ItemReason {
  itemId: string;
  policyRuleId: string | null;
  documentTypeLabelKey: string;
  expiredOnDate?: string; // absent when expiresAt is null on the compliance item
  jurisdictionTz: string;
  deepLinkPath: string;
}

export interface ContractorReason {
  contractorId: string;
  contractorName: string;
  reasons: ItemReason[];
}

export interface PaymentBlockModalProps {
  open: boolean;
  onClose: () => void;
  contractorReasons: ContractorReason[];
}

/**
 * The server emits documentTypeLabelKey as `Compliance.documentType.<x>` (canonical
 * bundle root casing). useTranslations('Compliance') already scopes to the `Compliance`
 * namespace, so we pass the tail after the leading `Compliance.` segment.
 */
function labelKeyTail(documentTypeLabelKey: string): string {
  return documentTypeLabelKey.replace(/^Compliance\./, '');
}

export function PaymentBlockModal({ open, onClose, contractorReasons }: PaymentBlockModalProps) {
  const t = useTranslations('Compliance');
  const titleId = useId();
  const itemCount = contractorReasons.reduce((sum, c) => sum + c.reasons.length, 0);
  const isEmpty = contractorReasons.length === 0;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="max-h-[80vh]" aria-labelledby={titleId}>
        <DialogHeader>
          <DialogTitle id={titleId} className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
            {t('paymentBlockModal.title')}
          </DialogTitle>
          <DialogDescription>
            {isEmpty
              ? t('paymentBlockModal.noReasonsDescription')
              : t('paymentBlockModal.subtitle', {
                  contractorCount: contractorReasons.length,
                  itemCount,
                })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          {isEmpty ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertTitle>{t('paymentBlockModal.noReasonsTitle')}</AlertTitle>
              <AlertDescription>{t('paymentBlockModal.noReasonsDescription')}</AlertDescription>
            </Alert>
          ) : (
            contractorReasons.map(contractor => (
              <Collapsible
                key={contractor.contractorId}
                defaultOpen
                className="rounded-md border border-border">
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-start font-medium">
                  <span className="truncate" title={contractor.contractorName}>
                    {contractor.contractorName}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
                    {t('paymentBlockModal.itemCountSuffix', { count: contractor.reasons.length })}
                    <ChevronDown
                      className="size-4 transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="space-y-1 border-border border-t px-3 py-2">
                    {contractor.reasons.map(reason => {
                      const label = t(labelKeyTail(reason.documentTypeLabelKey));
                      return (
                        <li key={reason.itemId} className="flex items-start justify-between gap-2">
                          <span className="text-sm">
                            <span className="font-medium">{label}</span>{' '}
                            <span className="text-muted-foreground">
                              {t('paymentBlockModal.expiredOn', {
                                date: reason.expiredOnDate,
                                tz: reason.jurisdictionTz,
                              })}
                            </span>
                          </span>
                          <Link
                            href={reason.deepLinkPath}
                            aria-label={t('paymentBlockModal.deepLinkAriaLabel', { label })}
                            className="flex shrink-0 items-center gap-1 text-primary text-sm hover:underline">
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </DialogBody>

        <DialogFooter>
          <Button onClick={onClose}>{t('paymentBlockModal.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
