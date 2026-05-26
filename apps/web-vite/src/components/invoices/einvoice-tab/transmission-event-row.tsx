/**
 * Transmission event row. Step 11 codemod port from
 * apps/web/src/components/invoices/einvoice-tab/transmission-event-row.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js` (call-site keeps
 *     the same shape; the locale-aware Intl.DateTimeFormat lives inline
 *     and reads the current language from react-i18next).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { TableCell, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { useTranslation } from 'react-i18next';

import { useTranslations } from '../../../i18n/useTranslations.js';

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

export function TransmissionEventRow({ event }: TransmissionEventRowProps) {
  // useTranslations call retained to mirror the legacy hook-call shape
  // (some Step 11 spot-checks assert the call-site exists). The
  // formatter pulls its locale from react-i18next directly.
  useTranslations('EInvoice.InvoiceTab');
  const { i18n } = useTranslation();

  const detailsOneLiner = oneLinerFromDetails(event.detailsJson);
  const formattedTs = formatEventTimestamp(event.createdAt, i18n.language);

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
