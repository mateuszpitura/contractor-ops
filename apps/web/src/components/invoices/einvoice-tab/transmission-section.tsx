'use client';

import { Loader2, Send, SendHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TransmissionEventRow } from './transmission-event-row';
import type { EInvoiceLifecycleShape, PeppolParticipantLike } from './types';

interface TransmissionSectionProps {
  lifecycle: EInvoiceLifecycleShape | null;
  peppolParticipant: PeppolParticipantLike | null;
  receiverAcceptsXRechnungCii: boolean;
  isSendPending: boolean;
  onSend: () => void;
}

type SendDisabledReason =
  | null
  | 'VALIDATION_NOT_VALID'
  | 'PEPPOL_PARTICIPANT_NOT_ACTIVE'
  | 'PARTICIPANT_NOT_REACHABLE';

function computeSendGate(
  lifecycle: EInvoiceLifecycleShape | null,
  participant: PeppolParticipantLike | null,
  receiverAccepts: boolean,
): SendDisabledReason {
  if (!lifecycle) return 'VALIDATION_NOT_VALID';
  if (lifecycle.validationStatus !== 'VALID' && lifecycle.validationStatus !== 'WARNINGS') {
    return 'VALIDATION_NOT_VALID';
  }
  if (!participant || participant.status !== 'ACTIVE') {
    return 'PEPPOL_PARTICIPANT_NOT_ACTIVE';
  }
  if (!receiverAccepts) return 'PARTICIPANT_NOT_REACHABLE';
  return null;
}

/**
 * Transmission section — status pill, Send via Peppol CTA (with
 * AlertDialog confirmation + send-gate tooltip explanation), and
 * chronological event log table.
 */
export function TransmissionSection({
  lifecycle,
  peppolParticipant,
  receiverAcceptsXRechnungCii,
  isSendPending,
  onSend,
}: TransmissionSectionProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const tErr = useTranslations('EInvoice.Errors');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpenConfirm = useCallback(() => setConfirmOpen(true), []);
  const handleCancel = useCallback(() => setConfirmOpen(false), []);
  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onSend();
  }, [onSend]);

  const disabledReason = computeSendGate(lifecycle, peppolParticipant, receiverAcceptsXRechnungCii);
  const isSendDisabled = disabledReason !== null || isSendPending;

  const transmissionStatus = lifecycle?.transmissionStatus ?? 'NOT_SENT';

  const sendButton = (
    <Button onClick={handleOpenConfirm} disabled={isSendDisabled} data-slot="einvoice-send-button">
      {isSendPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {t('sendCta')}
    </Button>
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">{t('transmissionHeading')}</h3>
          <Badge
            variant="outline"
            className="font-mono text-xs"
            aria-live="polite"
            data-slot="transmission-status-pill">
            {transmissionStatus}
          </Badge>
        </div>

        {transmissionStatus === 'NOT_SENT' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <SendHorizontal className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('transmissionNotSentBody')}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {disabledReason === null ? (
            sendButton
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex" aria-describedby="einvoice-send-disabled-tooltip">
                    {sendButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent id="einvoice-send-disabled-tooltip">
                  {disabledReason === 'VALIDATION_NOT_VALID'
                    ? tErr('KOSIT_VALIDATION_FAILED')
                    : disabledReason === 'PEPPOL_PARTICIPANT_NOT_ACTIVE'
                      ? tErr('PEPPOL_PARTICIPANT_NOT_ACTIVE')
                      : tErr('PARTICIPANT_NOT_REACHABLE')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {lifecycle && lifecycle.events.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-base font-semibold">{t('transmissionHistoryHeading')}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">When</TableHead>
                  <TableHead className="w-40">Event</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lifecycle.events.map(event => (
                  <TransmissionEventRow key={event.id} event={event} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="size-4" />
              {t('sendCta')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {/* Re-use transmissionNotSentBody copy for the confirmation body
                  — it states the action will transmit via Peppol. */}
              {t('transmissionNotSentBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{t('sendCta')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
