'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { use } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal contract detail page (read-only).
 *
 * Per UI-SPEC Contract Detail and PORT-02:
 * - Back button to contracts list
 * - Title + status badge
 * - Detail fields in 2-col grid
 * - Rate periods table (if any)
 * - Documents section with download buttons
 */
export default function PortalContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('Portal');
  const { id } = use(params);
  const contractQuery = useQuery(trpc.portal.getContract.queryOptions({ id }));
  const contract = contractQuery.data;
  const isLoading = contractQuery.isPending;

  function formatDate(date: Date | string | null): string {
    if (!date) return t('time.na');
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }

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
      {/* Back button */}
      <Button variant="ghost" size="sm" render={<Link href="/portal/contracts" />}>
        <ArrowLeft className="me-1 h-4 w-4" />
        {t('contracts.backToContracts')}
      </Button>

      {/* Header */}
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">{contract.title}</h1>
        <Badge variant={statusBadgeVariant(contract.status)}>
          {contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {/* Details grid */}
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

      {/* Rate Periods */}
      {contract.ratePeriods && contract.ratePeriods.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">{t('contracts.ratePeriods')}</h2>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>{t('contracts.columns.rate')}</TableHead>
                <TableHead>{t('contracts.columns.type')}</TableHead>
                <TableHead>{t('contracts.columns.validFrom')}</TableHead>
                <TableHead>{t('contracts.columns.validTo')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.ratePeriods.map((period, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell>{formatAmount(period.rateValueMinor, period.currency)}</TableCell>
                  <TableCell>{formatContractType(period.rateType)}</TableCell>
                  <TableCell>{formatDate(period.validFrom)}</TableCell>
                  <TableCell>{formatDate(period.validTo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Documents */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold">{t('contracts.documents')}</h2>
        {contract.documents && contract.documents.length > 0 ? (
          <div className="mt-4 space-y-2">
            {contract.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary">
                      {formatContractType(doc.type ?? t('contracts.documentFallback'))}
                    </Badge>
                    <span className="text-[13px] text-muted-foreground">
                      {formatFileSize(doc.sizeBytes)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(doc.downloadUrl, '_blank')}>
                  <Download className="me-1 h-4 w-4" />
                  {t('documents.download')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t('contracts.noDocuments')}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailField sub-component
// ---------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
