'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';
import { PdfPreview } from './pdf-preview';
import { VersionHistory } from './version-history';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentCardProps = {
  document: {
    id: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    virusScanStatus: string;
    createdAt: string | Date;
    uploadedByUserId: string | null;
    status: string;
  };
  /** version number to display (1-indexed from query position) */
  versionNumber?: number;
  onUploadNewVersion?: (documentId: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scan status inline badge
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentCard({
  document: doc,
  versionNumber,
  onUploadNewVersion,
}: DocumentCardProps) {
  const t = useTranslations('Documents');
  const { formatDate } = useDateFormatter();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation(
    trpc.document.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t('deleted'));
        queryClient.invalidateQueries(trpc.document.pathFilter());
        setDeleteOpen(false);
      },
      onError: err => toast.error(err.message),
    }),
  );

  const FileIcon = getFileIcon(doc.mimeType);
  const isPdf = doc.mimeType === 'application/pdf';
  const isInfected = doc.virusScanStatus === 'INFECTED';

  async function handleDownload() {
    try {
      // Use fetch to call the download URL query
      const result = await fetch(
        `/api/trpc/document.getDownloadUrl?input=${encodeURIComponent(
          JSON.stringify({ documentId: doc.id }),
        )}`,
      );
      const data = await result.json();
      const url = data?.result?.data?.url;
      if (url) {
        window.open(url, '_blank');
      }
    } catch {
      // Silently fail for download
    }
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      {/* File type icon */}
      <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileIcon className="size-6 text-muted-foreground" />
      </div>

      {/* Content */}
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

        {/* Version history */}
        <VersionHistory documentId={doc.id} />
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {isPdf && !isInfected && (
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          <Button variant="ghost" size="icon-sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-3.5" />
            <span className="sr-only">{t('preview')}</span>
          </Button>
        )}

        {isInfected ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
                render={props => (
                  <Button {...props} variant="ghost" size="icon-sm" disabled>
                    <Download className="size-3.5" />
                    <span className="sr-only">{t('download')}</span>
                  </Button>
                )}
              />
              <TooltipContent>{t('threatDetected')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          <Button variant="ghost" size="icon-sm" onClick={handleDownload}>
            <Download className="size-3.5" />
            <span className="sr-only">{t('download')}</span>
          </Button>
        )}

        {onUploadNewVersion && doc.status === 'ACTIVE' && (
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          <Button variant="ghost" size="icon-sm" onClick={() => onUploadNewVersion(doc.id)}>
            <Upload className="size-3.5" />
            <span className="sr-only">{t('uploadNewVersion')}</span>
          </Button>
        )}

        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={deleteMutation.isPending}>
          <Trash2 className="size-3.5" />
          <span className="sr-only">{t('delete')}</span>
        </Button>
      </div>

      {/* PDF Preview dialog */}
      {isPdf && (
        <PdfPreview
          documentId={doc.id}
          filename={doc.originalFileName}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => deleteMutation.mutate({ documentId: doc.id })}
              disabled={deleteMutation.isPending}>
              {t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
