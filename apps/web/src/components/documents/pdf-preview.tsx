'use client';

import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PdfPreviewProps = {
  documentId: string;
  filename: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfPreview({ documentId, filename, open, onOpenChange }: PdfPreviewProps) {
  const t = useTranslations('Documents');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPdfUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchUrl() {
      try {
        const result = await fetch(
          `/api/trpc/document.getDownloadUrl?input=${encodeURIComponent(
            JSON.stringify({ documentId }),
          )}`,
        );
        const data = await result.json();
        const url = data?.result?.data?.url;
        if (!cancelled && url) {
          setPdfUrl(url);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchUrl();
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <DialogTitle className="truncate">{filename}</DialogTitle>
          {!!pdfUrl && (
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, '_blank')}>
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
