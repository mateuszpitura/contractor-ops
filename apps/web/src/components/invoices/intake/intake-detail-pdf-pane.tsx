'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

type SourceKind = 'UPLOAD_XML' | 'UPLOAD_PDF';

interface IntakeDetailPdfPaneProps {
  intakeId: string;
  sourceKind: SourceKind;
  className?: string;
}

/**
 * Preview pane for the inbound file. For PDF sources, renders the signed
 * R2 URL inside an <iframe> (browsers handle PDF rendering natively — no
 * need to add react-pdf as a dependency for read-only preview). For XML
 * sources, fetches the raw text and shows it in a mono `<pre>` block.
 *
 * Includes a visually-hidden "Skip preview" anchor so keyboard users can
 * jump straight to the parsed-fields heading (a11y best practice per
 * UI-SPEC § Accessibility).
 */
export function IntakeDetailPdfPane({ intakeId, sourceKind, className }: IntakeDetailPdfPaneProps) {
  const t = useTranslations('EInvoice.intake');
  const rawQuery = useQuery(trpc.invoiceIntake.downloadRawFile.queryOptions({ intakeId }));
  const url = (rawQuery.data as { url?: string } | undefined)?.url;

  const isXml = sourceKind === 'UPLOAD_XML';

  return (
    <Card className={cn('overflow-hidden', className)} data-slot="intake-detail-pdf-pane">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" aria-hidden="true" />
          <span>{isXml ? 'XML' : 'PDF'}</span>
        </CardTitle>
        <a href="#parsed-fields" className="sr-only focus:not-sr-only focus:underline">
          {t('skipPreview')}
        </a>
      </CardHeader>
      <CardContent className="p-0">
        {rawQuery.isLoading ? (
          <Skeleton className="h-[600px] w-full rounded-none" />
        ) : url ? (
          isXml ? (
            <XmlPreview url={url} />
          ) : (
            <iframe
              src={url}
              title={isXml ? 'XML preview' : 'PDF preview'}
              className="h-[600px] w-full border-0 bg-muted"
              sandbox="allow-scripts allow-same-origin"
            />
          )
        ) : (
          <div className="p-6 text-sm text-muted-foreground">{t('reportNotAvailable')}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// XML preview — fetches the signed URL and renders as plain mono text.
// Uses `useQuery` with the URL as the key so re-renders don't re-fetch.
// ---------------------------------------------------------------------------

interface XmlPreviewProps {
  url: string;
}

function XmlPreview({ url }: XmlPreviewProps) {
  const textQuery = useQuery({
    queryKey: ['intake-xml-preview', url],
    queryFn: async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
    staleTime: 60_000,
  });

  if (textQuery.isLoading) {
    return <Skeleton className="m-4 h-[560px] w-[calc(100%-2rem)]" />;
  }
  if (textQuery.isError || !textQuery.data) {
    return <div className="p-6 text-sm text-destructive">Failed to load XML.</div>;
  }

  return (
    <pre
      className="max-h-[600px] overflow-auto bg-muted/30 p-4 font-mono text-xs whitespace-pre-wrap break-all"
      aria-label="Raw XRechnung XML source">
      {textQuery.data}
    </pre>
  );
}
