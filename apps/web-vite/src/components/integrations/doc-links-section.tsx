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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { FileText } from 'lucide-react';
import { useCallback } from 'react';

import { AttachDocDialog } from './attach-doc-dialog.js';
import { DocLinkChip } from './doc-link-chip.js';
import { useDocLinksSection } from './hooks/use-doc-links-section.js';

export type DocLinksSectionViewProps = Omit<ReturnType<typeof useDocLinksSection>, 'listQuery'> & {
  variant: 'empty' | 'list';
};

export function DocLinksSectionSkeleton({
  readOnly,
  t,
}: {
  readOnly?: boolean;
  t: ReturnType<typeof useDocLinksSection>['t'];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold">{t('docs.section.heading')}</span>
        </div>
        {!readOnly && (
          <Button variant="ghost" size="sm" disabled>
            {t('docs.section.attachButton')}
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-[140px] rounded-md" />
        <Skeleton className="h-6 w-[140px] rounded-md" />
      </div>
    </div>
  );
}

export function DocLinksSectionView({
  readOnly,
  workflowTaskRunId,
  attachOpen,
  setAttachOpen,
  pendingDetachId,
  setPendingDetachId,
  detachMutation,
  handleRefresh,
  handleRemove,
  confirmRemove,
  openAttachDialog,
  docLinks,
  refreshingId,
  refreshMutation,
  variant,
  t,
}: DocLinksSectionViewProps) {
  const handleDetachDialogChange = useCallback(
    (open: boolean) => {
      if (!open) setPendingDetachId(null);
    },
    [setPendingDetachId],
  );

  return (
    <div className="space-y-2">
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

      {variant === 'empty' ? (
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

      {!readOnly && (
        <AttachDocDialog
          workflowTaskRunId={workflowTaskRunId}
          open={attachOpen}
          onOpenChange={setAttachOpen}
        />
      )}

      <AlertDialog open={pendingDetachId !== null} onOpenChange={handleDetachDialogChange}>
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

interface DocLinksSectionProps {
  workflowTaskRunId: string;
  readOnly?: boolean;
}

export function DocLinksSection(props: DocLinksSectionProps) {
  const { listQuery, ...rest } = useDocLinksSection(props);
  if (listQuery.isLoading) return <DocLinksSectionSkeleton readOnly={rest.readOnly} t={rest.t} />;
  const variant = rest.docLinks.length === 0 ? 'empty' : 'list';
  return <DocLinksSectionView {...rest} variant={variant} />;
}
