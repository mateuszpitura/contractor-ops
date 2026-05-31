import { DataTable, DocumentsIllustration, SectionLabel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { Download } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { usePortalDocuments } from './hooks/use-portal-documents.js';

function formatDocType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface DocumentRow {
  id: string;
  name: string;
  sizeBytes: number;
  type: string | null;
  addedAt: string | Date;
  downloadUrl: string;
}

function DownloadButton({ url, label }: { url: string; label: string }) {
  const handleDownload = useCallback(
    () => window.open(url, '_blank', 'noopener,noreferrer'),
    [url],
  );
  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="me-1 h-4 w-4" />
      {label}
    </Button>
  );
}

export function PortalDocumentsContainer() {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();
  const { documents, isLoading } = usePortalDocuments();

  const formatFileSize = useCallback(
    (bytes: number): string => {
      if (bytes < 1024) return t('fileSize.bytes', { size: bytes });
      if (bytes < 1024 * 1024) return t('fileSize.kilobytes', { size: (bytes / 1024).toFixed(1) });
      return t('fileSize.megabytes', { size: (bytes / (1024 * 1024)).toFixed(1) });
    },
    [t],
  );

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: 'documentName',
        header: () => t('documents.columns.documentName'),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.name}</p>
            <p className="text-[13px] text-muted-foreground">
              {formatFileSize(row.original.sizeBytes)}
            </p>
          </div>
        ),
      },
      {
        id: 'type',
        header: () => t('documents.columns.type'),
        cell: ({ row }) => (
          <Badge variant="secondary">
            {formatDocType(row.original.type ?? t('documents.documentFallback'))}
          </Badge>
        ),
      },
      {
        id: 'dateAdded',
        header: () => t('documents.columns.dateAdded'),
        cell: ({ row }) => (
          <span className="text-sm">{formatDate(row.original.addedAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-end">{t('documents.columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="text-end">
            <DownloadButton url={row.original.downloadUrl} label={t('documents.download')} />
          </div>
        ),
      },
    ],
    [t, formatDate, formatFileSize],
  );

  const data = (documents ?? []) as DocumentRow[];

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('documents.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('documents.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>
        <DataTable
          columns={columns}
          data={data}
          totalRows={data.length}
          clientPagination
          pageIndex={0}
          pageSize={data.length || 1}
          onPageChange={() => undefined}
          onPageSizeChange={() => undefined}
          isLoading={isLoading}
          entityLabel={t('documents.title')}
          hideChrome
          hideFooter
          hideDensityToggle
          constrainHeight={false}
          skeletonRows={3}
          emptyIllustration={DocumentsIllustration}
          emptyTitle={t('documents.emptyTitle')}
          emptyDescription={t('documents.emptyBody')}
          noResultsTitle={t('documents.emptyTitle')}
          noResultsDescription={t('documents.emptyBody')}
          getRowId={row => row.id}
        />
      </AnimateIn>
    </div>
  );
}
