/**
 * Portal invoice detail — route shell with inlined page content.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { ArrowLeft, Download } from 'lucide-react';
import { Suspense } from 'react';
import { useParams } from 'react-router-dom';

import { ActivityLog } from '../../components/portal/activity-log.js';
import { usePortalInvoiceDetail } from '../../components/portal/hooks/use-portal-invoice-detail.js';
import { StatusTimeline, StatusTimelineSkeleton } from '../../components/portal/status-timeline.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { formatMoneyAmount } from '../../lib/money.js';

function getStatusDisplay(
  invoice: {
    status: string;
    approvalStatus: string;
    paymentStatus: string;
  },
  t: ReturnType<typeof useTranslations>,
): {
  label: string;
  variant: 'info' | 'warning' | 'success' | 'success-outline' | 'success-solid' | 'destructive';
} {
  if (invoice.paymentStatus === 'PAID')
    return { label: t('invoices.status.paid'), variant: 'success-solid' };
  if (invoice.paymentStatus === 'IN_RUN')
    return { label: t('invoices.status.paymentScheduled'), variant: 'success-outline' };
  if (invoice.approvalStatus === 'APPROVED')
    return { label: t('invoices.status.approved'), variant: 'success' };
  if (invoice.status === 'REJECTED')
    return { label: t('invoices.status.rejected'), variant: 'destructive' };
  if (invoice.status === 'UNDER_REVIEW' || invoice.status === 'APPROVAL_PENDING')
    return { label: t('invoices.status.inReview'), variant: 'warning' };
  return { label: t('invoices.status.submitted'), variant: 'info' };
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <StatusTimelineSkeleton />
      <Card>
        <CardContent className="space-y-4 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`skel-${i}`} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-6 w-20" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skel-${i}`} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalInvoiceDetailPageContent() {
  const t = useTranslations('Portal');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('ContractDetail');
  const { formatDate } = usePortalDateFormatter();
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const { invoice, isLoading, isError, isNotFound, handleRetry } = usePortalInvoiceDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/portal/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t('invoiceDetail.back')}
          </Button>
        </Link>
        <DetailSkeleton />
      </div>
    );
  }

  if (isError) {
    if (isNotFound) {
      return (
        <div className="space-y-6">
          <Link href="/portal/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="me-1.5 h-4 w-4" />
              {t('invoiceDetail.back')}
            </Button>
          </Link>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('invoiceDetail.notFound')}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Link href="/portal/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t('invoiceDetail.back')}
          </Button>
        </Link>
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
          <Button variant="outline" onClick={handleRetry}>
            {tErr('error.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <Link href="/portal/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="me-1.5 h-4 w-4" />
            {t('invoiceDetail.back')}
          </Button>
        </Link>
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('invoiceDetail.notFound')}
        </p>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(invoice, t);

  const submittedEntry = invoice.activityLog.find(e => e.event.toLowerCase().includes('submitted'));
  const submittedDate = submittedEntry?.timestamp;

  const rejectedEntry = invoice.activityLog.find(e => e.event.toLowerCase().includes('rejected'));

  return (
    <div className="space-y-6">
      <Link href="/portal/invoices">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="me-1.5 h-4 w-4" />
          {t('invoiceDetail.back')}
        </Button>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{invoice.invoiceNumber}</h1>
        <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
        {!!submittedDate && (
          <span className="text-[13px] text-muted-foreground">
            {t('invoiceDetail.submitted', { date: formatDate(submittedDate) })}
          </span>
        )}
      </div>

      <StatusTimeline
        status={invoice.status}
        approvalStatus={invoice.approvalStatus}
        paymentStatus={invoice.paymentStatus}
        rejectedAt={rejectedEntry?.timestamp ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceDetail.details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">{t('invoiceDetail.contract')}</span>
            {invoice.contract ? (
              <Link
                href={`/portal/contracts/${invoice.contract.id}`}
                className="text-sm text-primary hover:underline">
                {invoice.contract.title}
              </Link>
            ) : (
              <span className="text-sm">{t('invoiceDetail.fallback')}</span>
            )}
          </div>
          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t('invoiceDetail.netAmount')}
            </span>
            <span className="text-sm">
              {formatMoneyAmount(invoice.subtotalMinor, invoice.currency, 'en-US')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t('invoiceDetail.grossAmount')}
            </span>
            <span className="text-sm font-medium">
              {formatMoneyAmount(invoice.totalMinor, invoice.currency, 'en-US')}
            </span>
          </div>
          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t('invoiceDetail.issueDate')}
            </span>
            <span className="text-sm">
              {invoice.issueDate ? formatDate(invoice.issueDate) : t('invoiceDetail.fallback')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">{t('invoiceDetail.dueDate')}</span>
            <span className="text-sm">
              {invoice.dueDate ? formatDate(invoice.dueDate) : t('invoiceDetail.fallback')}
            </span>
          </div>
          <Separator />

          {invoice.files.length > 0 && (
            <div className="space-y-2">
              <span className="text-[13px] text-muted-foreground">
                {t('invoiceDetail.attachedFiles')}
              </span>
              {invoice.files.map(file => (
                <div key={file.id} className="flex items-center justify-between">
                  <span className="text-sm">{file.name}</span>
                  <a href={file.downloadUrl} target="_blank" rel="noopener noreferrer" download>
                    <Button variant="outline" size="sm">
                      <Download className="me-1.5 h-3.5 w-3.5" />
                      {t('invoiceDetail.download')}
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!!invoice.payment && (
        <Card>
          <CardHeader>
            <CardTitle>{t('invoiceDetail.payment')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('invoiceDetail.paymentDate')}
              </span>
              <span className="text-sm">
                {invoice.payment.paidAt
                  ? formatDate(invoice.payment.paidAt)
                  : t('invoiceDetail.fallback')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">{t('invoiceDetail.amount')}</span>
              <span className="text-sm font-medium">
                {formatMoneyAmount(invoice.payment.amountMinor, invoice.payment.currency, 'en-US')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">{t('invoiceDetail.activity')}</h2>
        <ActivityLog entries={invoice.activityLog} />
      </div>
    </div>
  );
}

export default function PortalInvoiceDetailPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalInvoiceDetailPageContent />
    </Suspense>
  );
}
