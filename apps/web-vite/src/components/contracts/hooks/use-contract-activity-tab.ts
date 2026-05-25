import { FilePlus, FileText, RefreshCw, Upload } from 'lucide-react';
import type { ComponentType } from 'react';
import { useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';

type Amendment = {
  id: string;
  title: string;
  createdAt: string | Date;
};

type ActivityContract = {
  id: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  amendments: Amendment[];
  documentCount?: number;
};

export interface ActivityEvent {
  key: string;
  icon: ComponentType<{ className?: string }>;
  text: string;
  time: Date;
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/**
 * Pure timeline derivation for the contract activity tab. Pulls i18n
 * labels from `ContractDetail.activity` and emits a sorted event list
 * along with a `formatRelativeTime` helper. Stateless; safe to call from
 * a presentational component without React Query involvement.
 */
export function useContractActivityTab(contract: ActivityContract) {
  const t = useTranslations('ContractDetail.activity');

  const events = useMemo<ActivityEvent[]>(() => {
    const out: ActivityEvent[] = [];

    const createdAt = toDate(contract.createdAt);
    out.push({
      key: `created-${contract.id}`,
      icon: FileText,
      text: t('contractCreated'),
      time: createdAt,
    });

    const updatedAt = toDate(contract.updatedAt);
    if (Math.abs(updatedAt.getTime() - createdAt.getTime()) > 60000) {
      out.push({
        key: `status-${contract.id}`,
        icon: RefreshCw,
        text: t('statusChanged', { status: contract.status }),
        time: updatedAt,
      });
    }

    for (const amendment of contract.amendments ?? []) {
      out.push({
        key: `amendment-${amendment.id}`,
        icon: FilePlus,
        text: t('amendmentAdded', { title: amendment.title }),
        time: toDate(amendment.createdAt),
      });
    }

    if (contract.documentCount && contract.documentCount > 0) {
      out.push({
        key: `documents-${contract.id}`,
        icon: Upload,
        text: t('documentsUploaded', { count: contract.documentCount }),
        time: updatedAt,
      });
    }

    out.sort((a, b) => b.time.getTime() - a.time.getTime());
    return out;
  }, [contract, t]);

  const formatRelativeTime = (date: string | Date): string => {
    const d = toDate(date);
    const diffMs = Date.now() - d.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) return formatDate(d);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  return {
    events,
    formatRelativeTime,
    isEmpty: events.length === 0,
    emptyLabel: t('noActivity'),
  } as const;
}
