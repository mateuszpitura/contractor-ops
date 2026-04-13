// Phase 59 · Plan 02 Task 3 — Document history list.
// Renders classificationDocument.listByEngagement results as a semantic <ul>
// and fetches getDownloadUrl on click to re-sign the persisted R2 object.

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { trpc } from '@/trpc/init';

interface DocumentHistoryListProps {
  engagementId: string;
}

type DocumentKind = 'SDS' | 'DRV_DEFENSE_BUNDLE';

function kindLabelKey(kind: DocumentKind): 'kindSds' | 'kindDrvDefenseBundle' {
  return kind === 'SDS' ? 'kindSds' : 'kindDrvDefenseBundle';
}

export function DocumentHistoryList({ engagementId }: DocumentHistoryListProps) {
  const t = useTranslations('Classification.documents');
  const formatter = useFormatter();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.classificationDocument.listByEngagement.queryOptions({
      contractorAssignmentId: engagementId,
    }),
  );

  async function handleDownload(classificationDocumentId: string): Promise<void> {
    setOpeningId(classificationDocumentId);
    try {
      const options = trpc.classificationDocument.getDownloadUrl.queryOptions({
        classificationDocumentId,
      });
      const data = await queryClient.fetchQuery(options);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setOpeningId(null);
    }
  }

  const docs = listQuery.data ?? [];

  return (
    <section aria-labelledby="document-history-heading">
      <h3 id="document-history-heading" className="mb-2 text-sm font-semibold">
        {t('documentHistory')}
      </h3>
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map(doc => {
            const kindLabel = t(kindLabelKey(doc.kind as DocumentKind));
            const generatedAt =
              doc.generatedAt instanceof Date ? doc.generatedAt : new Date(doc.generatedAt);
            const dateLabel = formatter.dateTime(generatedAt, {
              dateStyle: 'medium',
            });
            const kb = Math.round(doc.byteSize / 1024);
            const isOpening = openingId === doc.id;

            return (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-md border bg-background p-3"
              >
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
                  onClick={() => {
                    void handleDownload(doc.id);
                  }}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  {t('download')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
