'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
  const queryClient = useQueryClient();

  // Fetch doc links
  const listQuery = useQuery({
    ...trpc.docs.list.queryOptions({ workflowTaskRunId }),
  });

  // Detach mutation
  const detachMutation = useMutation({
    ...trpc.docs.detach.mutationOptions(),
    onSuccess: () => {
      toast.success('Document link removed');
      void queryClient.invalidateQueries({
        queryKey: trpc.docs.list.queryKey({ workflowTaskRunId }),
      });
    },
    onError: () => {
      toast.error('Failed to remove document link');
    },
  });

  const handleRemove = (externalLinkId: string) => {
    detachMutation.mutate({ externalLinkId });
  };

  const docLinks = (listQuery.data ?? []) as DocLink[];

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">Documents</span>
        </div>
        {!readOnly && (
          {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
          <Button variant="ghost" size="sm" onClick={() => setAttachOpen(true)}>
            Attach Document
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
        <p className="text-xs text-muted-foreground">No documents attached.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {docLinks.map(link => {
            const metadata = link.metadataJson ?? {};
            const provider = link.externalType === 'NOTION_PAGE' ? 'notion' : 'confluence';

            return (
              <DocLinkChip
                key={link.id}
                id={link.id}
                title={(metadata.title as string) ?? 'Untitled'}
                url={link.externalUrl}
                provider={provider}
                lastEditedTime={metadata.lastEditedTime as string | undefined}
                readOnly={readOnly}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onRemove={handleRemove}
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
    </div>
  );
}
