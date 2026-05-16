'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';
import { AttachDocDialog } from './attach-doc-dialog';
import { DocLinkChip } from './doc-link-chip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocLink {
  id: string;
  externalUrl: string;
  externalType: string;
  metadataJson: {
    title?: string;
    lastEditedTime?: string;
    [key: string]: unknown;
  } | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DocLinksSectionProps {
  workflowTaskRunId: string;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocLinksSection({ workflowTaskRunId, readOnly }: DocLinksSectionProps) {
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingDetachId, setPendingDetachId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const t = useTranslations('Integrations');

  // Fetch doc links
  const listQuery = useQuery({
    ...trpc.docs.list.queryOptions({ workflowTaskRunId }),
  });

  // Detach mutation
  const detachMutation = useMutation({
    ...trpc.docs.detach.mutationOptions(),
    onSuccess: () => {
      toast.success(t('docs.section.toast.removed'));
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
    },
    onError: () => {
      toast.error(t('docs.section.toast.removeFailed'));
    },
  });

  // Refresh-metadata mutation — re-fetches title/icon/lastEditedTime from
  // the provider (Notion / Confluence) and invalidates the list cache so the
  // chip re-renders with fresh data. Per-row spinner state is tracked via
  // refreshingId so concurrent refreshes don't collide.
  const refreshMutation = useMutation({
    ...trpc.docs.refreshMetadata.mutationOptions(),
    onSuccess: () => {
      toast.success(t('docs.section.toast.refreshed'));
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
    },
    onError: err => {
      toast.error(err.message || t('docs.section.toast.refreshFailed'));
    },
    onSettled: () => {
      setRefreshingId(null);
    },
  });

  const handleRefresh = useCallback(
    (externalLinkId: string) => {
      setRefreshingId(externalLinkId);
      refreshMutation.mutate({ externalLinkId });
    },
    [refreshMutation],
  );

  const handleRemove = useCallback((externalLinkId: string) => {
    setPendingDetachId(externalLinkId);
  }, []);

  const confirmRemove = useCallback(() => {
    if (pendingDetachId) {
      detachMutation.mutate({ externalLinkId: pendingDetachId });
      setPendingDetachId(null);
    }
  }, [detachMutation, pendingDetachId]);

  const openAttachDialog = useCallback(() => {
    setAttachOpen(true);
  }, []);

  const docLinks = useMemo(() => (listQuery.data ?? []) as DocLink[], [listQuery.data]);

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{t('docs.section.heading')}</span>
        </div>
        {!readOnly && (
          <Button variant="ghost" size="sm" onClick={openAttachDialog}>
            {t('docs.section.attachButton')}
          </Button>
        )}
      </div>

      {/* Body */}
      {listQuery.isLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-6 w-[140px] rounded-md" />
          <Skeleton className="h-6 w-[140px] rounded-md" />
        </div>
      ) : docLinks.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('docs.section.noDocuments')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {docLinks.map(link => {
            const metadata = link.metadataJson ?? {};
            const provider = link.externalType === 'NOTION_PAGE' ? 'notion' : 'confluence';

            return (
              <DocLinkChip
                key={link.id}
                id={link.id}
                title={(metadata.title as string) ?? t('docs.section.untitled')}
                url={link.externalUrl}
                provider={provider}
                lastEditedTime={metadata.lastEditedTime as string | undefined}
                readOnly={readOnly}
                onRemove={handleRemove}
                onRefresh={handleRefresh}
                isRefreshing={refreshingId === link.id && refreshMutation.isPending}
              />
            );
          })}
        </div>
      )}

      {/* Attach dialog */}
      {!readOnly && (
        <AttachDocDialog
          workflowTaskRunId={workflowTaskRunId}
          open={attachOpen}
          onOpenChange={setAttachOpen}
        />
      )}

      {/* Detach confirmation dialog */}
      <AlertDialog
        open={pendingDetachId !== null}
        onOpenChange={open => {
          if (!open) setPendingDetachId(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('docs.section.detachConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('docs.section.detachConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('docs.section.detachCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={detachMutation.isPending}>
              {t('docs.section.detachConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
