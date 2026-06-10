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
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Image,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
  Upload,
} from 'lucide-react';

import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import type { DocumentCardProps } from './hooks/use-document-card.js';
import { useDocumentCard } from './hooks/use-document-card.js';
import { PdfPreviewContainer } from './pdf-preview.js';
import type { DocumentListItem } from './types.js';
import { VersionHistory } from './version-history.js';

type DocumentCardViewProps = {
  versionNumber?: number;
  cardActions: DocumentCardProps;
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('spreadsheet') || mimeType.includes('xlsx')) return FileSpreadsheet;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ScanStatusBadge({ status }: { status: string }) {
  const t = useTranslations('Documents.scan');

  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {t('scanning')}
        </span>
      );
    case 'CLEAN':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <ShieldCheck className="size-3" />
          {t('clean')}
        </span>
      );
    case 'INFECTED':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <ShieldAlert className="size-3" />
          {t('infected')}
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <ShieldQuestion className="size-3" />
          {t('failed')}
        </span>
      );
    default:
      return null;
  }
}

export function DocumentCardView({ versionNumber, cardActions }: DocumentCardViewProps) {
  const t = useTranslations('Documents');
  const { formatDate } = useDateFormatter();
  const {
    document: doc,
    isPdf,
    isInfected,
    canDownload,
    canUploadNewVersion,
    previewOpen,
    onPreviewOpenChange,
    onOpenPreview,
    deleteOpen,
    onDeleteOpenChange,
    onOpenDelete,
    isDeletePending,
    onConfirmDelete,
    onDownload,
    onUploadNewVersion,
  } = cardActions;

  const FileIcon = getFileIcon(doc.mimeType);

  const downloadLabel = t('download');
  const renderDisabledDownloadTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="ghost" size="icon-sm" disabled>
        <Download className="size-3.5" />
        <span className="sr-only">{downloadLabel}</span>
      </Button>
    ),
    [downloadLabel],
  );

  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileIcon className="size-6 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{doc.originalFileName}</p>
          {versionNumber != null && (
            <Badge variant="secondary" className="shrink-0">
              {t('version', { n: versionNumber })}
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSizeBytes)}</span>
          <ScanStatusBadge status={doc.virusScanStatus} />
        </div>

        <VersionHistory documentId={doc.id} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isPdf && !isInfected && (
          <Button variant="ghost" size="icon-sm" onClick={onOpenPreview}>
            <Eye className="size-3.5" />
            <span className="sr-only">{t('preview')}</span>
          </Button>
        )}

        {canDownload ? (
          <Button variant="ghost" size="icon-sm" onClick={onDownload}>
            <Download className="size-3.5" />
            <span className="sr-only">{t('download')}</span>
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={renderDisabledDownloadTrigger} />
              <TooltipContent>{t('threatDetected')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {canUploadNewVersion && onUploadNewVersion && (
          <Button variant="ghost" size="icon-sm" onClick={onUploadNewVersion}>
            <Upload className="size-3.5" />
            <span className="sr-only">{t('uploadNewVersion')}</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={onOpenDelete}
          disabled={isDeletePending}>
          <Trash2 className="size-3.5" />
          <span className="sr-only">{t('delete')}</span>
        </Button>
      </div>

      {isPdf && (
        <PdfPreviewContainer
          documentId={doc.id}
          filename={doc.originalFileName}
          open={previewOpen}
          onOpenChange={onPreviewOpenChange}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-4" />
              {t('deleteTitle', { name: doc.originalFileName })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={isDeletePending}>
              {t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type DocumentCardContainerProps = {
  document: DocumentListItem;
  versionNumber?: number;
  onUploadNewVersion?: (documentId: string) => void;
};

export function DocumentCardContainer({
  document,
  versionNumber,
  onUploadNewVersion,
}: DocumentCardContainerProps) {
  const cardActions = useDocumentCard({ document, onUploadNewVersion });

  return <DocumentCardView versionNumber={versionNumber} cardActions={cardActions} />;
}

export function DocumentCard(props: DocumentCardContainerProps) {
  return <DocumentCardContainer {...props} />;
}
