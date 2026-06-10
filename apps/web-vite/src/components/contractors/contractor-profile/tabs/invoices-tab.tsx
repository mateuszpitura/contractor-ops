import {
  AtelierEmptyState,
  DataTable,
  InvoicesIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import type { ColumnDef } from '@tanstack/react-table';
import { Receipt, Upload } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../../lib/format/use-date-formatter.js';
import type { InvoiceRow } from '../../../invoices/invoice-table/columns.js';
import { getColumns } from '../../../invoices/invoice-table/columns.js';
import { InvoiceUploadArea } from '../../../invoices/invoice-upload-area.js';
import { renderEmptyStateAction } from '../../../shared/atelier-bridges.js';
import {
  useContractorTabInvoices,
  type useContractorTabInvoices as UseContractorTabInvoices,
} from '../../hooks/use-contractor-tab-invoices.js';

const PAGE_SIZE = 25;

type InvoicesTabViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabInvoices>;

export type InvoicesTabEmptyProps = Pick<
  InvoicesTabViewProps,
  'uploadOpen' | 'setUploadOpen' | 'handleUploadComplete'
>;

export function InvoicesTabEmpty({
  uploadOpen,
  setUploadOpen,
  handleUploadComplete,
}: InvoicesTabEmptyProps) {
  const t = useTranslations('Invoices');
  const handleOpenUpload = useCallback(() => setUploadOpen(true), [setUploadOpen]);
  const primaryAction = useMemo(
    () => ({
      label: t('tab.uploadInvoice'),
      onClick: handleOpenUpload,
      icon: Upload,
    }),
    [t, handleOpenUpload],
  );
  return (
    <>
      <AtelierEmptyState
        variant="subview"
        illustration={InvoicesIllustration}
        heading={t('tab.noInvoicesHeading')}
        body={t('tab.noInvoicesBody')}
        primaryAction={primaryAction}
        renderAction={renderEmptyStateAction}
      />
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('upload.heading')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoicesTabView({
  contractorId: _contractorId,
  uploadOpen,
  setUploadOpen,
  page,
  setPage,
  data,
  totalRows,
  totalPages,
  isLoading,
  handleUploadComplete,
}: InvoicesTabViewProps) {
  const t = useTranslations('Invoices');
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<InvoiceRow>[] = useMemo(() => {
    const allColumns = getColumns(t, formatDate);
    return allColumns.filter(col => col.id !== 'contractor');
  }, [t, formatDate]);

  const handleOpenUpload = useCallback(() => setUploadOpen(true), [setUploadOpen]);
  const handlePageChange = useCallback(
    (nextIndex: number) => setPage(Math.max(1, Math.min(totalPages, nextIndex + 1))),
    [setPage, totalPages],
  );

  const getRowId = useCallback((row: InvoiceRow) => row.id, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={Receipt}>{t('tab.heading')}</SectionLabel>
        </div>
        <Button size="sm" disabled={isLoading} onClick={handleOpenUpload}>
          <Upload className="me-1.5 size-3.5" />
          {t('tab.uploadInvoice')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalRows={data.length}
        pageIndex={Math.max(0, page - 1)}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        onPageSizeChange={() => undefined}
        isLoading={isLoading}
        constrainHeight={false}
        hideDensityToggle
        getRowId={getRowId}
        entityLabel={t('entityLabel', { count: data.length })}
        emptyTitle={t('tab.noInvoicesHeading')}
        emptyDescription={t('tab.noInvoicesBody')}
        noResultsTitle={t('tab.noInvoicesHeading')}
        skeletonRows={6}
      />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('upload.heading')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <InvoiceUploadArea onUploadComplete={handleUploadComplete} />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type InvoicesTabContainerProps = {
  contractorId: string;
};

export function InvoicesTabContainer({ contractorId }: InvoicesTabContainerProps) {
  const invoices = useContractorTabInvoices(contractorId);

  if (!invoices.isLoading && invoices.data.length === 0) {
    return (
      <InvoicesTabEmpty
        uploadOpen={invoices.uploadOpen}
        setUploadOpen={invoices.setUploadOpen}
        handleUploadComplete={invoices.handleUploadComplete}
      />
    );
  }

  return <InvoicesTabView {...invoices} />;
}

/** @deprecated Use InvoicesTab */
export { InvoicesTabContainer as InvoicesTab };
