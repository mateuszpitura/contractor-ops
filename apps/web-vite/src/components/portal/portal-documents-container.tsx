import {
  AtelierEmptyState,
  AtelierTableShell,
  DocumentsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Download } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { usePortalDocuments } from './hooks/use-portal-documents.js';

function formatDocType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface DocumentRowProps {
  name: string;
  sizeLabel: string;
  typeLabel: string;
  dateLabel: string;
  downloadUrl: string;
  downloadLabel: string;
}

function DocumentRow({
  name,
  sizeLabel,
  typeLabel,
  dateLabel,
  downloadUrl,
  downloadLabel,
}: DocumentRowProps) {
  const handleDownload = useCallback(
    () => window.open(downloadUrl, '_blank', 'noopener,noreferrer'),
    [downloadUrl],
  );
  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-[13px] text-muted-foreground">{sizeLabel}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{typeLabel}</Badge>
      </TableCell>
      <TableCell className="text-sm">{dateLabel}</TableCell>
      <TableCell className="text-end">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="me-1 h-4 w-4" />
          {downloadLabel}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function PortalDocumentsContainer() {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();
  const { documents, isLoading } = usePortalDocuments();

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return t('fileSize.bytes', { size: bytes });
    if (bytes < 1024 * 1024) return t('fileSize.kilobytes', { size: (bytes / 1024).toFixed(1) });
    return t('fileSize.megabytes', { size: (bytes / (1024 * 1024)).toFixed(1) });
  }

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('documents.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('documents.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>
        {isLoading ? (
          <div>
            <AtelierTableShell isLoading constrainHeight={false}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('documents.columns.documentName')}</TableHead>
                    <TableHead>{t('documents.columns.type')}</TableHead>
                    <TableHead>{t('documents.columns.dateAdded')}</TableHead>
                    <TableHead className="text-end">{t('documents.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="text-end">
                        <Skeleton className="ms-auto h-7 w-24" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AtelierTableShell>
          </div>
        ) : documents && documents.length > 0 ? (
          <div>
            <AtelierTableShell constrainHeight={false}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('documents.columns.documentName')}</TableHead>
                    <TableHead>{t('documents.columns.type')}</TableHead>
                    <TableHead>{t('documents.columns.dateAdded')}</TableHead>
                    <TableHead className="text-end">{t('documents.columns.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map(doc => (
                    <DocumentRow
                      key={doc.id}
                      name={doc.name}
                      sizeLabel={formatFileSize(doc.sizeBytes)}
                      typeLabel={formatDocType(doc.type ?? t('documents.documentFallback'))}
                      dateLabel={formatDate(doc.addedAt)}
                      downloadUrl={doc.downloadUrl}
                      downloadLabel={t('documents.download')}
                    />
                  ))}
                </TableBody>
              </Table>
            </AtelierTableShell>
          </div>
        ) : (
          <AtelierEmptyState
            illustration={DocumentsIllustration}
            heading={t('documents.emptyTitle')}
            body={t('documents.emptyBody')}
            renderAction={renderEmptyStateAction}
          />
        )}
      </AnimateIn>
    </div>
  );
}
