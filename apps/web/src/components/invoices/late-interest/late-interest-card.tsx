'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [isDownloadClaimPending, setIsDownloadClaimPending] = useState(false);

  // Gate: only show for GB B2B GBP invoices with flag on
  const isApplicable =
    featureEnabled && contractorCountryCode === 'GB' && isBusinessCustomer && currency === 'GBP';

  const query = useQuery(
    trpc.latePaymentInterest.getForInvoice.queryOptions({ invoiceId }, { enabled: isApplicable }),
  );

  const handleClaimClick = useCallback(() => setClaimDialogOpen(true), []);
  const handleWaiveClick = useCallback(() => setWaiveDialogOpen(true), []);
  const handleRevokeClick = useCallback(() => setRevokeDialogOpen(true), []);

  // `latePaymentInterest.downloadClaim` is a *query* returning a signed R2
  // URL alongside the PDF render status. We fetch it eagerly on click
  // rather than mounting it as a hook so the click always returns the
  // freshest URL (signed for 300s) and we avoid auto-fetching on every
  // render of the card.
  const handleDownloadClaim = useCallback(
    async (claimId: string) => {
      setIsDownloadClaimPending(true);
      try {
        const result = await queryClient.fetchQuery(
          trpc.latePaymentInterest.downloadClaim.queryOptions({ claimId }),
        );
        if (result.pdfStatus !== 'READY' || !result.downloadUrl) {
          toast.error(result.pdfError ?? t('downloadClaimNotReady'));
          return;
        }
        // `noopener,noreferrer` mitigates reverse-tabnabbing on the
        // signed-URL navigation.
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('downloadClaimError'));
      } finally {
        setIsDownloadClaimPending(false);
      }
    },
    [queryClient, t],
  );

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

  // Non-applicable scope gate (non-GB, B2C, non-GBP, etc.)
  if (!data.applicable) return null;

  // Derive display status from the router's result fields
  const latestClaim = data.claims[0] ?? null;
  const latestWaiver = data.waivers[0] ?? null;

  const status: 'NOT_YET_OVERDUE' | 'ACCRUING' | 'CLAIMED' | 'WAIVED' | 'PAID' =
    data.daysOverdue === 0
      ? 'NOT_YET_OVERDUE'
      : data.claimStatus === 'CLAIMED'
        ? 'CLAIMED'
        : data.waiverStatus === 'WAIVED'
          ? 'WAIVED'
          : 'ACCRUING';

  // Not yet overdue
  if (status === 'NOT_YET_OVERDUE') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('notYetOverdue', { days: 0 })}</p>
        </CardContent>
      </Card>
    );
  }

  // ACCRUING state
  if (status === 'ACCRUING') {
    return (
      <>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
            <LateInterestStatusPill status="ACCRUING" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <DetailRow
                label={t('principalOutstanding')}
                value={formatGBP(data.principalOutstandingMinor)}
              />
              <DetailRow label={t('daysOverdue')} value={String(data.daysOverdue)} />
              <DetailRow
                label={t('rateUsed')}
                value={`${data.rateUsed}%`}
                tooltip={<RateCalculationTooltip />}
              />
              <DetailRow label={t('dailyAccrual')} value={formatGBP(data.dailyInterestMinor)} />
              <DetailRow
                label={t('interestAccrued')}
                value={formatGBP(data.accruedInterestMinor)}
              />
              <DetailRow
                label={t('fixedCompensation')}
                value={formatGBP(data.compensationTierMinor)}
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
  if (status === 'CLAIMED') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{t('heading')}</CardTitle>
          <LateInterestStatusPill status="CLAIMED" />
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('claimedBanner', {
              date: latestClaim?.claimedAt ?? '',
              amount: formatGBP(data.totalClaimMinor),
            })}
          </p>

          <div className="space-y-2">
            <DetailRow
              label={t('principalOutstanding')}
              value={formatGBP(data.principalOutstandingMinor)}
            />
            <DetailRow label={t('daysOverdue')} value={String(data.daysOverdue)} />
            <DetailRow label={t('rateUsed')} value={`${data.rateUsed}%`} />
            <DetailRow label={t('interestAccrued')} value={formatGBP(data.accruedInterestMinor)} />
            <DetailRow
              label={t('fixedCompensation')}
              value={formatGBP(data.compensationTierMinor)}
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
            {latestClaim?.pdfStatus === 'READY' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDownloadClaimPending}
                onClick={() => handleDownloadClaim(latestClaim.id)}
                data-testid="late-interest-download-claim">
                {isDownloadClaimPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t('downloadClaimLetter')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // WAIVED state
  if (status === 'WAIVED') {
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
                date: latestWaiver?.waivedAt ?? '',
                name: '',
              })}
            </p>
            {!!latestWaiver?.reason && (
              <p className="text-sm text-muted-foreground italic">
                {t('waiveReason')}: {latestWaiver.reason}
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
          waiverId={latestWaiver?.id ?? ''}
          open={revokeDialogOpen}
          onOpenChange={setRevokeDialogOpen}
        />
      </>
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
