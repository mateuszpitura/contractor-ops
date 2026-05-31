/**
 * Transmission section. Step 11 codemod port from
 * apps/web/src/components/invoices/einvoice-tab/transmission-section.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 */

import { DataTable } from '@contractor-ops/ui';
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
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Send, SendHorizontal } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { EInvoiceLifecycleShape, PeppolParticipantLike } from './types.js';

export interface LifecycleEvent {
  id: string;
  eventType: string;
  createdAt: string | Date;
  detailsJson?: unknown;
}

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

function formatEventTimestamp(raw: string | Date, locale: string): string {
  try {
    const date = typeof raw === 'string' ? new Date(raw) : raw;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return String(raw);
  }
}

function oneLinerFromDetails(details: unknown): string {
  if (!details || typeof details !== 'object') return '';
  const d = details as Record<string, unknown>;
  if (typeof d.messageId === 'string') return `msg ${d.messageId.slice(0, 16)}`;
  if (typeof d.errorCode === 'string') return String(d.errorCode);
  return '';
}

export function TransmissionSection({
  lifecycle,
  peppolParticipant,
  receiverAcceptsXRechnungCii,
  isSendPending,
  onSend,
}: TransmissionSectionProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const tErr = useTranslations('EInvoice.Errors');
  const { i18n } = useTranslation();
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

  const events = lifecycle?.events ?? [];

  const columns = useMemo<ColumnDef<LifecycleEvent, unknown>[]>(
    () => [
      {
        id: 'when',
        header: () => 'When',
        size: 192,
        enableSorting: false,
        cell: ({ row }) => (
          <span
            data-slot="transmission-event-row"
            className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
            {formatEventTimestamp(row.original.createdAt, i18n.language)}
          </span>
        ),
      },
      {
        id: 'event',
        header: () => 'Event',
        size: 160,
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs">
            {row.original.eventType}
          </Badge>
        ),
      },
      {
        id: 'details',
        header: () => 'Details',
        enableSorting: false,
        cell: ({ row }) => {
          const detailsOneLiner = oneLinerFromDetails(row.original.detailsJson);
          return (
            <span className="text-sm">
              {detailsOneLiner || <span className="text-muted-foreground">—</span>}
            </span>
          );
        },
      },
    ],
    [i18n.language],
  );

  const getRowId = useCallback((row: LifecycleEvent) => row.id, []);
  const noop = useCallback(() => undefined, []);

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

        {lifecycle && events.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-base font-semibold">{t('transmissionHistoryHeading')}</h4>
            <DataTable
              columns={columns}
              data={events}
              totalRows={events.length}
              clientPagination
              pageIndex={0}
              pageSize={events.length || 1}
              onPageChange={noop}
              onPageSizeChange={noop}
              getRowId={getRowId}
              hideChrome
              hideFooter
              hideDensityToggle
              constrainHeight={false}
              entityLabel="events"
              emptyTitle=""
              noResultsTitle=""
            />
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
            <AlertDialogDescription>{t('transmissionNotSentBody')}</AlertDialogDescription>
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
