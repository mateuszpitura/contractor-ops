// Phase 59 · Plan 03 Task 3 — individual chain row with row-level actions.

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { tDyn } from '@/i18n/typed-keys';
import type { Ir35ChainParticipantRow } from './ir35-chain-panel';

interface ChainParticipantRowProps {
  row: Ir35ChainParticipantRow;
  onMarkDelivered: (note: string | null) => void;
  onMarkAcknowledged: (note: string | null) => void;
  onRemove: () => void;
  isMarkingDelivered?: boolean;
  isMarkingAcknowledged?: boolean;
  isRemoving?: boolean;
}

export function ChainParticipantRow({
  row,
  onMarkDelivered,
  onMarkAcknowledged,
  onRemove,
  isMarkingDelivered = false,
  isMarkingAcknowledged = false,
  isRemoving = false,
}: ChainParticipantRowProps) {
  const t = useTranslations('Ir35Chain');
  const formatter = useFormatter();
  const isAutoPopulated = row.role === 'CLIENT' || row.role === 'WORKER';

  const handleMarkDelivered = useCallback(() => onMarkDelivered(null), [onMarkDelivered]);
  const handleMarkAcknowledged = useCallback(() => onMarkAcknowledged(null), [onMarkAcknowledged]);

  const deliveredLabel = row.sdsDeliveredAt
    ? formatter.dateTime(new Date(row.sdsDeliveredAt), { dateStyle: 'medium' })
    : t('notDelivered');
  const acknowledgedLabel = row.sdsAcknowledgedAt
    ? formatter.dateTime(new Date(row.sdsAcknowledgedAt), { dateStyle: 'medium' })
    : t('notAcknowledged');

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-2 font-medium">{tDyn(t, 'role', row.role)}</td>
      <td className="py-2 pr-2">{row.displayName}</td>
      <td className="py-2 pr-2">
        <span>{deliveredLabel}</span>
      </td>
      <td className="py-2 pr-2">
        <span>{acknowledgedLabel}</span>
      </td>
      <td className="py-2 pr-2 text-right">
        <div className="inline-flex gap-2">
          <button
            type="button"
            onClick={handleMarkDelivered}
            disabled={isMarkingDelivered}
            aria-pressed={Boolean(row.sdsDeliveredAt)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
            {t('markDelivered')}
          </button>
          <button
            type="button"
            onClick={handleMarkAcknowledged}
            disabled={isMarkingAcknowledged}
            aria-pressed={Boolean(row.sdsAcknowledgedAt)}
            className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60">
            {t('markAcknowledged')}
          </button>
          {isAutoPopulated ? null : (
            <button
              type="button"
              onClick={onRemove}
              disabled={isRemoving}
              aria-label={`${t('remove')} — ${row.displayName}`}
              className="rounded-md border border-destructive px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60">
              {t('remove')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
