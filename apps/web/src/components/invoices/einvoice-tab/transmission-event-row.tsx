'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { TableCell, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { useTranslations } from 'next-intl';

export interface LifecycleEvent {
  id: string;
  eventType: string;
  createdAt: string | Date;
  detailsJson?: unknown;
}

interface TransmissionEventRowProps {
  event: LifecycleEvent;
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

/**
 * One row of the transmission event log (EInvoiceLifecycleEvent). Renders
 * timestamp + event-type badge + a short details one-liner.
 */
export function TransmissionEventRow({ event }: TransmissionEventRowProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const locale = t('tabLabel') ? 'en' : 'en'; // placeholder — locale from next-intl context used by Intl

  const detailsOneLiner = oneLinerFromDetails(event.detailsJson);
  const formattedTs = formatEventTimestamp(event.createdAt, locale);

  return (
    <TableRow data-slot="transmission-event-row">
      <TableCell className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
        {formattedTs}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {event.eventType}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {detailsOneLiner || <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}
