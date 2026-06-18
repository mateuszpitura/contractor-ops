// Document history list.
// Renders classificationDocument.listByEngagement results as a semantic <ul>
// and fetches getDownloadUrl on click to re-sign the persisted R2 object.

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { useCallback, useId, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import type { useDocumentHistoryList as UseDocumentHistoryList } from '../hooks/use-classification-documents.js';
import { useDocumentHistoryList } from '../hooks/use-classification-documents.js';

interface DocumentHistoryListViewProps {
  engagementId: string;
  docs: ReturnType<typeof UseDocumentHistoryList>['docs'];
  downloadDocument: ReturnType<typeof UseDocumentHistoryList>['downloadDocument'];
}

const SKELETON_ROW_KEYS = ['skel-0', 'skel-1', 'skel-2'] as const;

type DocumentKind = 'SDS' | 'DRV_DEFENSE_BUNDLE';

function kindLabelKey(kind: DocumentKind): 'kindSds' | 'kindDrvDefenseBundle' {
  return kind === 'SDS' ? 'kindSds' : 'kindDrvDefenseBundle';
}

export function DocumentHistoryListSkeleton() {
  const t = useTranslations('Classification.documents');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-sm font-semibold">
        {t('documentHistory')}
      </h3>
      <ul className="flex flex-col gap-2" aria-busy="true">
        {SKELETON_ROW_KEYS.map(key => (
          <li key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DocumentHistoryListEmpty() {
  const t = useTranslations('Classification.documents');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-sm font-semibold">
        {t('documentHistory')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
    </section>
  );
}

export function DocumentHistoryListView({
  engagementId: _engagementId,
  docs,
  downloadDocument,
}: DocumentHistoryListViewProps) {
  const t = useTranslations('Classification.documents');
  const headingId = useId();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (classificationDocumentId: string): Promise<void> => {
      setOpeningId(classificationDocumentId);
      try {
        await downloadDocument(classificationDocumentId);
      } finally {
        setOpeningId(null);
      }
    },
    [downloadDocument],
  );

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-sm font-semibold">
        {t('documentHistory')}
      </h3>
      <ul className="flex flex-col gap-2">
        {docs.map(doc => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            isOpening={openingId === doc.id}
            onDownload={handleDownload}
          />
        ))}
      </ul>
    </section>
  );
}

interface DocumentRowProps {
  doc: {
    id: string;
    kind: string;
    generatedAt: Date | string;
    byteSize: number;
  };
  isOpening: boolean;
  onDownload: (id: string) => Promise<void>;
}

function DocumentRow({ doc, isOpening, onDownload }: DocumentRowProps) {
  const t = useTranslations('Classification.documents');
  const { formatDate } = useDateFormatter();

  const kindLabel = t(kindLabelKey(doc.kind as DocumentKind));
  const generatedAt = doc.generatedAt instanceof Date ? doc.generatedAt : new Date(doc.generatedAt);
  const dateLabel = formatDate(generatedAt);
  const kb = Math.round(doc.byteSize / 1024);

  const handleClick = useCallback(() => {
    void onDownload(doc.id);
  }, [onDownload, doc.id]);

  return (
    <li className="flex items-center justify-between rounded-md border bg-background p-3">
      <div>
        <p className="text-sm font-medium">{kindLabel}</p>
        <p className="text-xs text-muted-foreground">
          {t('generatedOn', { date: dateLabel })} · {t('byteSize', { kb })}
        </p>
      </div>
      <button
        type="button"
        aria-label={`${t('download')} — ${kindLabel} (${dateLabel})`}
        aria-busy={isOpening}
        disabled={isOpening}
        onClick={handleClick}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60">
        {t('download')}
      </button>
    </li>
  );
}

interface DocumentHistoryListContainerProps {
  engagementId: string;
}

export function DocumentHistoryListContainer({ engagementId }: DocumentHistoryListContainerProps) {
  const { listQuery, docs, downloadDocument } = useDocumentHistoryList(engagementId);

  if (listQuery.isPending) return <DocumentHistoryListSkeleton />;
  if (docs.length === 0) return <DocumentHistoryListEmpty />;

  return (
    <DocumentHistoryListView
      engagementId={engagementId}
      docs={docs}
      downloadDocument={downloadDocument}
    />
  );
}

/** @deprecated Use DocumentHistoryList */
export { DocumentHistoryListContainer as DocumentHistoryList };
