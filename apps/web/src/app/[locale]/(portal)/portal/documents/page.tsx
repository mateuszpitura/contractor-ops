'use client';

import { AtelierEmptyState, AtelierPageHeader, AtelierTableShell } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { portalTrpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

function formatDocType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal documents list page.
 *
 * Per UI-SPEC Documents List and PORT-05:
 * - Table with Document Name, Type badge, Date Added, Download button
 * - Loading: table header + 3 row skeletons
 * - Empty state with specific copy from UI-SPEC
 */
export default function PortalDocumentsPage() {
  const t = useTranslations('Portal');
  const documentsQuery = useQuery(portalTrpc.portal.listDocuments.queryOptions());
  const documents = documentsQuery.data;
  const isLoading = documentsQuery.isPending;

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return t('fileSize.bytes', { size: bytes });
    if (bytes < 1024 * 1024) return t('fileSize.kilobytes', { size: (bytes / 1024).toFixed(1) });
    return t('fileSize.megabytes', { size: (bytes / (1024 * 1024)).toFixed(1) });
  }

  return (
    <div>
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('documents.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        {isLoading ? (
          <div className="mt-6">
            <AtelierTableShell isLoading>
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
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
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
          <div className="mt-6">
            <AtelierTableShell>
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
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-[13px] text-muted-foreground">
                            {formatFileSize(doc.sizeBytes)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatDocType(doc.type ?? t('documents.documentFallback'))}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(doc.addedAt)}</TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="outline"
                          size="sm"
                          // biome-ignore lint/nursery/noJsxPropsBind: dynamic URL per list item
                          onClick={() => window.open(doc.downloadUrl, '_blank')}>
                          <Download className="me-1 h-4 w-4" />
                          {t('documents.download')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AtelierTableShell>
          </div>
        ) : (
          <AtelierEmptyState
            icon={FileText}
            heading={t('documents.emptyTitle')}
            body={t('documents.emptyBody')}
            renderAction={renderEmptyStateAction}
          />
        )}
      </AnimateIn>
    </div>
  );
}
