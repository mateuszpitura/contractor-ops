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
import type { useIntakeXmlPreview as UseIntakeXmlPreview } from '../hooks/use-intake-detail-pdf.js';
import { useIntakeDetailPdf, useIntakeXmlPreview } from '../hooks/use-intake-detail-pdf.js';

export interface IntakeDetailPdfPaneViewProps {
  url: string;
  isXml: boolean;
  xmlPreview: ReturnType<typeof UseIntakeXmlPreview>;
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

export function IntakeDetailPdfPaneView({
  url,
  isXml,
  xmlPreview,
  className,
}: IntakeDetailPdfPaneViewProps) {
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
  xmlPreview: ReturnType<typeof UseIntakeXmlPreview>;
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
    <section className="max-h-[600px] overflow-auto bg-muted/30" aria-label={tTab('xmlSourceAria')}>
      <pre className="p-4 font-mono text-xs whitespace-pre-wrap break-all">{xmlPreview.text}</pre>
    </section>
  );
}

type SourceKind = 'UPLOAD_XML' | 'UPLOAD_PDF';

export interface IntakeDetailPdfPaneProps {
  intakeId: string;
  sourceKind: SourceKind;
  className?: string;
}

export function IntakeDetailPdfPane({ intakeId, sourceKind, className }: IntakeDetailPdfPaneProps) {
  const pdf = useIntakeDetailPdf(intakeId, sourceKind);
  const xmlPreview = useIntakeXmlPreview(pdf.isXml ? pdf.url : undefined);

  if (pdf.isLoading) return <IntakeDetailPdfPaneSkeleton className={className} isXml={pdf.isXml} />;
  if (!pdf.url) return <IntakeDetailPdfPaneNotAvailable className={className} isXml={pdf.isXml} />;

  return (
    <IntakeDetailPdfPaneView
      className={className}
      url={pdf.url}
      isXml={pdf.isXml}
      xmlPreview={xmlPreview}
    />
  );
}
