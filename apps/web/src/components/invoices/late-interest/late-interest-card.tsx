'use client';

import { Download, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

import { ClaimDialog } from './claim-dialog';
import { LateInterestStatusPill } from './late-interest-status-pill';
import { RateCalculationTooltip } from './rate-calculation-tooltip';
import { RevokeWaiverDialog } from './revoke-waiver-dialog';
import { WaiveDialog } from './waive-dialog';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LateInterestCardProps {
  invoiceId: string;
  /** PAY_LATE_INTEREST_ENABLED feature flag value — checked server-side too. */
  featureEnabled: boolean;
  /** Contractor country code — only renders for GB. */
  contractorCountryCode: string;
  /** Whether the contractor is a business customer. */
  isBusinessCustomer: boolean;
  /** Invoice currency — only renders for GBP. */
  currency: string;
}

// ---------------------------------------------------------------------------
// Currency formatter for GBP
// ---------------------------------------------------------------------------

function formatGBP(minorAmount: number, locale: string = 'en-GB'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorAmount / 100);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LateInterestSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`skel-${i}`} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LateInterestCard({
  invoiceId,
  featureEnabled,
  contractorCountryCode,
  isBusinessCustomer,
  currency,
}: LateInterestCardProps) {
  const t = useTranslations('Payments.lateInterest');

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  // Gate: only show for GB B2B GBP invoices with flag on
  const isApplicable =
    featureEnabled && contractorCountryCode === 'GB' && isBusinessCustomer && currency === 'GBP';

  const query = trpc.latePaymentInterest.getForInvoice.useQuery(
    { invoiceId },
    { enabled: isApplicable },
  );

  const handleClaimClick = useCallback(() => setClaimDialogOpen(true), []);
  const handleWaiveClick = useCallback(() => setWaiveDialogOpen(true), []);
  const handleRevokeClick = useCallback(() => setRevokeDialogOpen(true), []);

  // Not applicable — no render
  if (!isApplicable) return null;

  // B2C banner
  if (isApplicable && !isBusinessCustomer) {
    return <p className="text-sm text-muted-foreground">{t('b2cNotApplicable')}</p>;
  }

  // Loading
  if (query.isLoading) return <LateInterestSkeleton />;

  // Error
  if (query.isError) return null;

  const data = query.data;
  if (!data) return null;

  // Not yet overdue
  if (data.status === 'NOT_YET_OVERDUE') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('notYetOverdue', { days: data.daysUntilDue })}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ACCRUING state
  if (data.status === 'ACCRUING') {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
            <LateInterestStatusPill status="ACCRUING" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <DetailRow label={t('principalOutstanding')} value={formatGBP(data.principalMinor)} />
              <DetailRow label={t('daysOverdue')} value={String(data.daysOverdue)} />
              <DetailRow
                label={t('rateUsed')}
                value={`${data.ratePercent}%`}
                tooltip={<RateCalculationTooltip />}
              />
              <DetailRow label={t('dailyAccrual')} value={formatGBP(data.dailyAccrualMinor)} />
              <DetailRow
                label={t('interestAccrued')}
                value={formatGBP(data.interestAccruedMinor)}
              />
              <DetailRow
                label={t('fixedCompensation')}
                value={formatGBP(data.fixedCompensationMinor)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t('totalStatutoryClaim')}</span>
              <span className="text-base font-semibold tabular-nums">
                {formatGBP(data.totalClaimMinor)}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleClaimClick} size="sm">
                {t('claimCta')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleWaiveClick}
                className="text-destructive hover:text-destructive">
                {t('waiveCta')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ClaimDialog
          invoiceId={invoiceId}
          open={claimDialogOpen}
          onOpenChange={setClaimDialogOpen}
        />
        <WaiveDialog
          invoiceId={invoiceId}
          open={waiveDialogOpen}
          onOpenChange={setWaiveDialogOpen}
        />
      </>
    );
  }

  // CLAIMED state
  if (data.status === 'CLAIMED') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
          <LateInterestStatusPill status="CLAIMED" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('claimedBanner', {
              date: data.snapshotDate,
              amount: formatGBP(data.totalClaimMinor),
            })}
          </p>

          <div className="space-y-2">
            <DetailRow label={t('principalOutstanding')} value={formatGBP(data.principalMinor)} />
            <DetailRow label={t('daysOverdue')} value={String(data.daysOverdue)} />
            <DetailRow label={t('rateUsed')} value={`${data.ratePercent}%`} />
            <DetailRow label={t('interestAccrued')} value={formatGBP(data.interestAccruedMinor)} />
            <DetailRow
              label={t('fixedCompensation')}
              value={formatGBP(data.fixedCompensationMinor)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('totalStatutoryClaim')}</span>
            <span className="text-base font-semibold tabular-nums">
              {formatGBP(data.totalClaimMinor)}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {data.claimPdfUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={data.claimPdfUrl} download>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t('downloadClaimLetter')}
                </a>
              </Button>
            )}
            {data.secondaryInvoiceNumber && (
              <Button variant="ghost" size="sm" asChild>
                <a href={`/invoices?search=${data.secondaryInvoiceNumber}`}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  {t('viewSecondaryInvoice', { number: data.secondaryInvoiceNumber })}
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // WAIVED state
  if (data.status === 'WAIVED') {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
            <LateInterestStatusPill status="WAIVED" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('waivedBanner', {
                date: data.waivedDate,
                name: data.waivedBy,
              })}
            </p>
            {data.waiveReason && (
              <p className="text-sm text-muted-foreground italic">
                {t('waiveReason')}: {data.waiveReason}
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevokeClick}
              className="text-destructive hover:text-destructive">
              {t('revokeWaiverCta')}
            </Button>
          </CardContent>
        </Card>

        <RevokeWaiverDialog
          invoiceId={invoiceId}
          open={revokeDialogOpen}
          onOpenChange={setRevokeDialogOpen}
        />
      </>
    );
  }

  // PAID state
  if (data.status === 'PAID') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
          <LateInterestStatusPill status="PAID" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('paidBanner', { amount: formatGBP(data.totalClaimMinor) })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Detail row sub-component
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1 text-muted-foreground">
        {label}
        {tooltip}
      </span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}
