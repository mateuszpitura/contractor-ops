'use client';

import { FilePlus, FileText, RefreshCw, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDateFormatter } from '@/lib/format/use-date-formatter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Amendment = {
  id: string;
  title: string;
  createdAt: string | Date;
};

type ActivityTabProps = {
  contract: {
    id: string;
    status: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    amendments: Amendment[];
    documentCount?: number;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// formatRelativeTime is now defined inside the component to use the org-aware hook.

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityTab({ contract }: ActivityTabProps) {
  const t = useTranslations('ContractDetail.activity');
  const { formatDate } = useDateFormatter();

  function formatRelativeTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) return formatDate(d);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  // Build events from contract data
  const events: Array<{
    icon: typeof FileText;
    text: string;
    time: Date;
  }> = [];

  // Contract created
  const createdAt =
    typeof contract.createdAt === 'string' ? new Date(contract.createdAt) : contract.createdAt;
  events.push({
    icon: FileText,
    text: t('contractCreated'),
    time: createdAt,
  });

  // Status changed (if updated differs from created significantly)
  const updatedAt =
    typeof contract.updatedAt === 'string' ? new Date(contract.updatedAt) : contract.updatedAt;
  if (Math.abs(updatedAt.getTime() - createdAt.getTime()) > 60000) {
    events.push({
      icon: RefreshCw,
      text: t('statusChanged', { status: contract.status }),
      time: updatedAt,
    });
  }

  // Amendments
  for (const amendment of contract.amendments ?? []) {
    const amendmentDate =
      typeof amendment.createdAt === 'string' ? new Date(amendment.createdAt) : amendment.createdAt;
    events.push({
      icon: FilePlus,
      text: t('amendmentAdded', { title: amendment.title }),
      time: amendmentDate,
    });
  }

  // Document uploaded placeholder
  if (contract.documentCount && contract.documentCount > 0) {
    events.push({
      icon: Upload,
      text: t('documentsUploaded', { count: contract.documentCount }),
      time: updatedAt,
    });
  }

  // Sort newest first
  events.sort((a, b) => b.time.getTime() - a.time.getTime());

  if (events.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, i) => {
        const Icon = event.icon;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: computed timeline events lack unique id
          <div key={`activity-${i}`} className="flex items-start gap-3">
            <div className="relative mt-0.5 flex size-6 shrink-0 items-center justify-center">
              <Icon className="size-3.5 text-muted-foreground" />
              {i < events.length - 1 && (
                <div className="absolute top-6 left-1/2 h-4 w-px -translate-x-1/2 bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{event.text}</p>
              <p className="text-xs text-muted-foreground">{formatRelativeTime(event.time)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
