import { useIntakeDetailPdf, useIntakeXmlPreview } from '../hooks/use-intake-detail-pdf.js';
import {
  IntakeDetailPdfPane,
  IntakeDetailPdfPaneNotAvailable,
  IntakeDetailPdfPaneSkeleton,
} from './intake-detail-pdf-pane.js';

type SourceKind = 'UPLOAD_XML' | 'UPLOAD_PDF';

interface IntakeDetailPdfPaneContainerProps {
  intakeId: string;
  sourceKind: SourceKind;
  className?: string;
}

export function IntakeDetailPdfPaneContainer({
  intakeId,
  sourceKind,
  className,
}: IntakeDetailPdfPaneContainerProps) {
  const pdf = useIntakeDetailPdf(intakeId, sourceKind);
  const xmlPreview = useIntakeXmlPreview(pdf.isXml ? pdf.url : undefined);

  if (pdf.isLoading) return <IntakeDetailPdfPaneSkeleton className={className} isXml={pdf.isXml} />;
  if (!pdf.url) return <IntakeDetailPdfPaneNotAvailable className={className} isXml={pdf.isXml} />;

  return (
    <IntakeDetailPdfPane
      className={className}
      url={pdf.url}
      isXml={pdf.isXml}
      xmlPreview={xmlPreview}
    />
  );
}
