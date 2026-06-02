import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import { DataTable } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Download } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { usePortalContractDetail } from './hooks/use-portal-contract-detail.js';

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: minorUnitDigits(currency),
  }).format(minorToMajor(minor, currency));
}

function formatContractType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'default' as const;
    case 'EXPIRING':
      return 'outline' as const;
    case 'EXPIRED':
      return 'secondary' as const;
    default:
      return 'secondary' as const;
  }
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

interface ContractDocumentRowProps {
  name: string;
  typeLabel: string;
  sizeLabel: string;
  downloadUrl: string;
  downloadLabel: string;
}

function ContractDocumentRow({
  name,
  typeLabel,
  sizeLabel,
  downloadUrl,
  downloadLabel,
}: ContractDocumentRowProps) {
  const handleDownload = useCallback(
    () => window.open(downloadUrl, '_blank', 'noopener,noreferrer'),
    [downloadUrl],
  );
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary">{typeLabel}</Badge>
          <span className="text-[13px] text-muted-foreground">{sizeLabel}</span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="me-1 h-4 w-4" />
        {downloadLabel}
      </Button>
    </div>
  );
}

export function PortalContractDetailContainer() {
  const t = useTranslations('Portal');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('ContractDetail');
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const { contract, isLoading, isError, isNotFound, handleRetry } = usePortalContractDetail(id);
  const { formatDate } = usePortalDateFormatter();

  function ratePeriodLabel(rateType: string): string {
    switch (rateType) {
      case 'MONTHLY':
        return t('contracts.rateUnit.monthly');
      case 'HOURLY':
        return t('contracts.rateUnit.hourly');
      case 'DAILY':
        return t('contracts.rateUnit.daily');
      case 'FIXED':
        return t('contracts.rateUnit.fixed');
      default:
        return '';
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return t('fileSize.bytes', { size: bytes });
    if (bytes < 1024 * 1024) return t('fileSize.kilobytes', { size: (bytes / 1024).toFixed(1) });
    return t('fileSize.megabytes', { size: (bytes / (1024 * 1024)).toFixed(1) });
  }

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-7 w-32" />
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`skel-${i}`} className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-36" />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    if (isNotFound) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{t('contracts.notFound')}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            render={<Link href="/portal/contracts" />}>
            <ArrowLeft className="me-1 h-4 w-4" />
            {t('contracts.backToContracts')}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        <Button variant="outline" onClick={handleRetry}>
          {tErr('error.retry')}
        </Button>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('contracts.notFound')}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          render={<Link href="/portal/contracts" />}>
          <ArrowLeft className="me-1 h-4 w-4" />
          {t('contracts.backToContracts')}
        </Button>
      </div>
    );
  }

  const rateDisplay =
    contract.rateValueMinor != null && contract.rateType
      ? `${formatAmount(contract.rateValueMinor, contract.currency)}${ratePeriodLabel(contract.rateType)}`
      : t('time.na');

  return (
    <div>
      <Button variant="ghost" size="sm" render={<Link href="/portal/contracts" />}>
        <ArrowLeft className="me-1 h-4 w-4" />
        {t('contracts.backToContracts')}
      </Button>

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">{contract.title}</h1>
        <Badge variant={statusBadgeVariant(contract.status)}>
          {contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      <Card className="mt-6">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <DetailField
            label={t('contracts.contractNumber')}
            value={contract.contractNumber ?? t('time.na')}
          />
          <DetailField label={t('contracts.type')} value={formatContractType(contract.type)} />
          <DetailField label={t('contracts.startDate')} value={formatDate(contract.startDate)} />
          <DetailField label={t('contracts.endDate')} value={formatDate(contract.endDate)} />
          <DetailField label={t('contracts.rate')} value={rateDisplay} />
          <DetailField
            label={t('contracts.billingModel')}
            value={formatContractType(contract.billingModel ?? t('time.na'))}
          />
          <DetailField
            label={t('contracts.paymentTerms')}
            value={
              contract.paymentTermsDays == null
                ? t('time.na')
                : t('contracts.paymentTermsDays', { days: contract.paymentTermsDays })
            }
          />
          <DetailField
            label={t('contracts.autoRenewal')}
            value={contract.autoRenewal ? t('contracts.yes') : t('contracts.no')}
          />
          <DetailField
            label={t('contracts.noticePeriod')}
            value={
              contract.noticePeriodDays == null
                ? t('time.na')
                : t('contracts.paymentTermsDays', { days: contract.noticePeriodDays })
            }
          />
        </CardContent>
      </Card>

      {contract.ratePeriods && contract.ratePeriods.length > 0 && (
        <RatePeriodsSection
          ratePeriods={contract.ratePeriods}
          tableHeading={t('contracts.ratePeriods')}
          rateLabel={t('contracts.columns.rate')}
          typeLabel={t('contracts.columns.type')}
          validFromLabel={t('contracts.columns.validFrom')}
          validToLabel={t('contracts.columns.validTo')}
          entityLabel={t('contracts.ratePeriods')}
          emptyTitle={t('contracts.ratePeriods')}
          formatDate={formatDate}
        />
      )}

      <div className="mt-6">
        <h2 className="text-xl font-semibold">{t('contracts.documents')}</h2>
        {contract.documents && contract.documents.length > 0 ? (
          <div className="mt-4 space-y-2">
            {contract.documents.map(doc => (
              <ContractDocumentRow
                key={doc.id}
                name={doc.name}
                typeLabel={formatContractType(doc.type ?? t('contracts.documentFallback'))}
                sizeLabel={formatFileSize(doc.sizeBytes)}
                downloadUrl={doc.downloadUrl}
                downloadLabel={t('documents.download')}
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t('contracts.noDocuments')}</p>
        )}
      </div>
    </div>
  );
}

interface RatePeriodRow {
  validFrom: string | Date;
  validTo: string | Date | null;
  rateType: string;
  rateValueMinor: number;
  currency: string;
}

interface RatePeriodsSectionProps {
  ratePeriods: RatePeriodRow[];
  tableHeading: string;
  rateLabel: string;
  typeLabel: string;
  validFromLabel: string;
  validToLabel: string;
  entityLabel: string;
  emptyTitle: string;
  formatDate: (value: Date | string | null | undefined) => string;
}

function RatePeriodsSection({
  ratePeriods,
  tableHeading,
  rateLabel,
  typeLabel,
  validFromLabel,
  validToLabel,
  entityLabel,
  emptyTitle,
  formatDate,
}: RatePeriodsSectionProps) {
  const columns = useMemo<ColumnDef<RatePeriodRow>[]>(
    () => [
      {
        id: 'rate',
        header: () => rateLabel,
        cell: ({ row }) => formatAmount(row.original.rateValueMinor, row.original.currency),
      },
      {
        id: 'type',
        header: () => typeLabel,
        cell: ({ row }) => formatContractType(row.original.rateType),
      },
      {
        id: 'validFrom',
        header: () => validFromLabel,
        cell: ({ row }) => formatDate(row.original.validFrom),
      },
      {
        id: 'validTo',
        header: () => validToLabel,
        cell: ({ row }) => formatDate(row.original.validTo),
      },
    ],
    [rateLabel, typeLabel, validFromLabel, validToLabel, formatDate],
  );

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold">{tableHeading}</h2>
      <div className="mt-4">
        <DataTable
          columns={columns}
          data={ratePeriods}
          totalRows={ratePeriods.length}
          clientPagination
          pageIndex={0}
          pageSize={ratePeriods.length || 1}
          onPageChange={() => undefined}
          onPageSizeChange={() => undefined}
          entityLabel={entityLabel}
          emptyTitle={emptyTitle}
          noResultsTitle={emptyTitle}
          hideChrome
          hideFooter
          hideDensityToggle
          constrainHeight={false}
          getRowId={row => `${String(row.validFrom)}-${row.rateType}`}
        />
      </div>
    </div>
  );
}
