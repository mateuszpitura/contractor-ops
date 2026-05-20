'use client';

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, RefreshCw, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/init';

type RightRailProps = {
  contractor: {
    id: string;
    notes: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    lifecycleStage: string;
  };
};

function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function ActivityTimeline({
  createdAt,
  updatedAt,
  lifecycleStage,
}: {
  createdAt: string | Date;
  updatedAt: string | Date;
  lifecycleStage: string;
}) {
  const t = useTranslations('ContractorProfile.rightRail');

  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const updated = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const hasUpdate = Math.abs(updated.getTime() - created.getTime()) > 60000;

  const events: Array<{
    icon: typeof UserPlus;
    text: string;
    time: Date;
  }> = [];

  events.push({
    icon: UserPlus,
    text: t('created'),
    time: created,
  });

  if (hasUpdate) {
    events.push({
      icon: RefreshCw,
      text: t('profileUpdated'),
      time: updated,
    });
  }

  events.push({
    icon: Clock,
    text: t('lifecycleStage', { stage: lifecycleStage }),
    time: updated,
  });

  events.sort((a, b) => b.time.getTime() - a.time.getTime());

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noActivity')}</p>;
  }

  return (
    <div className="space-y-3">
      {events.map((event, i) => {
        const Icon = event.icon;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: computed timeline events lack unique id
          <div key={`skel-${i}`} className="flex items-start gap-3">
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

export function RightRail({ contractor }: RightRailProps) {
  const t = useTranslations('ContractorProfile.rightRail');
  const tToast = useTranslations('ContractorProfile.toast');
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(contractor.notes ?? '');
  const [isDirty, setIsDirty] = useState(false);

  const noteSaveMutation = useMutation(
    trpc.contractor.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('saved'));
        setIsDirty(false);
        queryClient.invalidateQueries({
          queryKey: trpc.contractor.getById.queryKey(),
        });
      },
      onError: (error: unknown) => {
        const message =
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message ?? '')
            : '';
        toast.error(message || tToast('noteFailed'));
      },
    }),
  );

  function handleSaveNotes() {
    noteSaveMutation.mutate({ id: contractor.id, notes });
  }

  return (
    <div className="sticky top-[80px] space-y-0 rounded-xl border bg-card">
      {/* Activity section */}
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium">{t('activity')}</h4>
        <ActivityTimeline
          createdAt={contractor.createdAt}
          updatedAt={contractor.updatedAt}
          lifecycleStage={contractor.lifecycleStage}
        />
      </div>

      <Separator />

      {/* Quick notes section */}
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium">{t('notes')}</h4>
        <textarea
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          rows={3}
          placeholder={t('notesPlaceholder')}
          value={notes}
          // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
          onChange={e => {
            setNotes(e.target.value);
            setIsDirty(true);
          }}
        />
        {!!isDirty && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full"
            disabled={noteSaveMutation.isPending}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={handleSaveNotes}>
            {noteSaveMutation.isPending ? t('saving') : t('save')}
          </Button>
        )}
      </div>

      <Separator />

      {/* Reminders section */}
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium">{t('reminders')}</h4>
        <p className="text-sm text-muted-foreground">{t('noReminders')}</p>
      </div>
    </div>
  );
}
