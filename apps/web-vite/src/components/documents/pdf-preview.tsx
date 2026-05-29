import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Download, Loader2 } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { usePdfPreview } from './hooks/use-pdf-preview.js';

type PdfPreviewContainerProps = {
  documentId: string;
  filename: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PdfPreviewContainer({
  documentId,
  filename,
  open,
  onOpenChange,
}: PdfPreviewContainerProps) {
  const { pdfUrl, loading } = usePdfPreview(documentId, open);
  return (
    <PdfPreviewView
      filename={filename}
      open={open}
      onOpenChange={onOpenChange}
      pdfUrl={pdfUrl}
      loading={loading}
    />
  );
}

// Back-compat export for callers that haven't migrated to the container name.
export const PdfPreview = PdfPreviewContainer;

type PdfPreviewViewProps = PdfPreviewContainerProps & {
  pdfUrl: string | null;
  loading: boolean;
};

export function PdfPreviewView({
  filename,
  open,
  onOpenChange,
  pdfUrl,
  loading,
}: Omit<PdfPreviewViewProps, 'documentId'>) {
  const t = useTranslations('Documents');

  const handleDownload = useCallback(() => {
    if (pdfUrl) window.open(pdfUrl, '_blank');
  }, [pdfUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <DialogTitle className="truncate">{filename}</DialogTitle>
          {!!pdfUrl && (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="me-1.5 size-3.5" />
              {t('download')}
            </Button>
          )}
        </DialogHeader>

        <div className="min-h-[480px] flex-1 overflow-hidden rounded-md border bg-muted">
          {loading ? (
            <div className="flex h-full min-h-[480px] items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : pdfUrl ? (
            <object data={pdfUrl} type="application/pdf" className="h-full min-h-[480px] w-full">
              <div className="flex h-full min-h-[480px] items-center justify-center">
                <p className="text-sm text-muted-foreground">{t('pdfFallback')}</p>
              </div>
            </object>
          ) : (
            <div className="flex h-full min-h-[480px] items-center justify-center">
              <p className="text-sm text-muted-foreground">{t('pdfLoadError')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
