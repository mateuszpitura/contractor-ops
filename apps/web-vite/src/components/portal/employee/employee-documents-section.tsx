/**
 * Employee documents section — the caller's own personnel file ("akta osobowe"),
 * grouped by the self-viewable sections (section C / pay+PII is excluded
 * server-side, never fetched). Each document downloads via a short-lived signed
 * URL minted on click. Presentational views only; the tRPC boundary is
 * `use-employee-akta`.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { AlertCircle, Download, FileText, FolderOpen, Loader2 } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SectionCard, SectionMessage, SectionSkeleton } from './employee-section-shell.js';
import type { EmployeeAktaSection } from './hooks/use-employee-akta.js';
import { useEmployeeAkta } from './hooks/use-employee-akta.js';

interface EmployeeDocumentsSectionViewProps {
  sections: EmployeeAktaSection[];
  downloadingId: string | null;
  onDownload: (documentId: string) => void;
}

export function EmployeeDocumentsSectionView({
  sections,
  downloadingId,
  onDownload,
}: EmployeeDocumentsSectionViewProps) {
  const t = useTranslations('Portal.employee.documents');
  const populated = sections.filter(section => section.documents.length > 0);

  return (
    <SectionCard icon={FolderOpen} title={t('title')} description={t('description')}>
      <div className="space-y-5">
        {populated.map(section => (
          <div key={section.section}>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              {t(`section.${section.section}`)}
            </h3>
            <ul className="divide-y rounded-lg border">
              {section.documents.map(document => (
                <li
                  key={document.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm">
                      {document.fileName ?? t('unnamedDocument')}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDownload(document.documentId)}
                    disabled={downloadingId === document.documentId}
                    aria-label={t('downloadAria', { name: document.fileName ?? '' })}>
                    {downloadingId === document.documentId ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function EmployeeDocumentsSection() {
  const t = useTranslations('Portal.employee.documents');
  const akta = useEmployeeAkta();

  if (akta.isLoading) return <SectionSkeleton rows={4} />;
  if (akta.isUnavailable) {
    return (
      <SectionCard icon={FolderOpen} title={t('title')}>
        <SectionMessage
          icon={FolderOpen}
          title={t('unavailableTitle')}
          description={t('unavailable')}
        />
      </SectionCard>
    );
  }
  if (akta.isError) {
    return (
      <SectionCard icon={FolderOpen} title={t('title')}>
        <SectionMessage
          icon={AlertCircle}
          tone="danger"
          title={t('errorTitle')}
          description={t('error')}
        />
      </SectionCard>
    );
  }
  if (akta.isEmpty) {
    return (
      <SectionCard icon={FolderOpen} title={t('title')} description={t('description')}>
        <SectionMessage icon={FileText} title={t('emptyTitle')} description={t('empty')} />
      </SectionCard>
    );
  }

  return (
    <EmployeeDocumentsSectionView
      sections={akta.sections}
      downloadingId={akta.downloadingId}
      onDownload={akta.download}
    />
  );
}
