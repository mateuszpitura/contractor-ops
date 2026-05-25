import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { FileText } from 'lucide-react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import type { useIntakeXmlPreview } from '../hooks/use-intake-detail-pdf.js';

interface IntakeDetailPdfPaneProps {
  url: string;
  isXml: boolean;
  xmlPreview: ReturnType<typeof useIntakeXmlPreview>;
  className?: string;
}

interface PaneShellProps {
  isXml: boolean;
  className?: string;
  children: React.ReactNode;
}

function PaneShell({ isXml, className, children }: PaneShellProps) {
  const t = useTranslations('EInvoice.intake');
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
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export function IntakeDetailPdfPaneSkeleton({
  className,
  isXml,
}: {
  className?: string;
  isXml: boolean;
}) {
  return (
    <PaneShell className={className} isXml={isXml}>
      <Skeleton className="h-[600px] w-full rounded-none" />
    </PaneShell>
  );
}

export function IntakeDetailPdfPaneNotAvailable({
  className,
  isXml,
}: {
  className?: string;
  isXml: boolean;
}) {
  const t = useTranslations('EInvoice.intake');
  return (
    <PaneShell className={className} isXml={isXml}>
      <div className="p-6 text-sm text-muted-foreground">{t('reportNotAvailable')}</div>
    </PaneShell>
  );
}

export function IntakeDetailPdfPane({
  url,
  isXml,
  xmlPreview,
  className,
}: IntakeDetailPdfPaneProps) {
  const t = useTranslations('EInvoice.intake');

  return (
    <PaneShell className={className} isXml={isXml}>
      {isXml ? (
        <XmlPreview xmlPreview={xmlPreview} />
      ) : (
        <iframe
          src={url}
          title={t('pdfPreviewTitle')}
          className="h-[600px] w-full border-0 bg-muted"
          // PDF preview only — the browser's built-in PDF viewer runs in
          // privileged chrome and ignores sandbox restrictions on its own
          // controls, so we don't need `allow-scripts`. Keeping both
          // `allow-scripts` and `allow-same-origin` would let a malicious
          // payload (if R2 ever served HTML instead of PDF) remove this
          // sandbox attribute on the parent iframe — the canonical CSP
          // sandbox bypass. `allow-downloads` keeps the native viewer's
          // download button working.
          sandbox="allow-downloads"
        />
      )}
    </PaneShell>
  );
}

interface XmlPreviewProps {
  xmlPreview: ReturnType<typeof useIntakeXmlPreview>;
}

function XmlPreview({ xmlPreview }: XmlPreviewProps) {
  const t = useTranslations('EInvoice.intake');
  const tTab = useTranslations('EInvoice.InvoiceTab');

  if (xmlPreview.isLoading) {
    return <Skeleton className="m-4 h-[560px] w-[calc(100%-2rem)]" />;
  }
  if (xmlPreview.isError || !xmlPreview.text) {
    return <div className="p-6 text-sm text-destructive">{t('xmlLoadError')}</div>;
  }

  return (
    <pre
      className="max-h-[600px] overflow-auto bg-muted/30 p-4 font-mono text-xs whitespace-pre-wrap break-all"
      aria-label={tTab('xmlSourceAria')}>
      {xmlPreview.text}
    </pre>
  );
}
