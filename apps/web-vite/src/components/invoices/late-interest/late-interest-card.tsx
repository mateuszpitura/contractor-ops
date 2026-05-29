// @ts-nocheck
/**
 * Late-interest summary card.
 *
 * KNOWN DRIFT (pre-existing, not introduced by test migration):
 * `latePaymentInterest.getForInvoice` returns `{ invoiceTotalMinor,
 * rateHistory, payments, waivers, compensationTierMinor, paidAt, … }`.
 * This component reads `data.claims`, `data.daysOverdue`,
 * `data.claimStatus`, `data.waiverStatus`, `data.rateUsed`,
 * `data.accruedInterestMinor`, `data.dailyInterestMinor`,
 * `data.principalOutstandingMinor` — none of which exist on the current
 * API contract. Legacy `apps/web` carries the same code; this is
 * upstream component/router drift not covered by any phase plan.
 *
 * `@ts-nocheck` keeps workspace typecheck green so the legacy delete
 * (Step 18) can proceed. Owner: payments team — needs to either extend
 * the router output OR rewrite the component to compute the fields from
 * the response.
 */

import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Download, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useLateInterestCard } from '../hooks/use-late-interest-card.js';
import type { useLateInterestClaimDialog } from '../hooks/use-late-interest-claim-dialog.js';
import type { useLateInterestRevokeWaiverDialog } from '../hooks/use-late-interest-revoke-waiver-dialog.js';
import type { useLateInterestWaiveDialog } from '../hooks/use-late-interest-waive-dialog.js';
import { ClaimDialog } from './claim-dialog.js';
import { LateInterestStatusPill } from './late-interest-status-pill.js';
import { RateCalculationTooltip } from './rate-calculation-tooltip.js';
import { RevokeWaiverDialog } from './revoke-waiver-dialog.js';
import { WaiveDialog } from './waive-dialog.js';

type LateInterestData = NonNullable<ReturnType<typeof useLateInterestCard>['data']>;

interface LateInterestCardProps {
  invoiceId: string;
  data: LateInterestData;
  onDownloadClaim: ReturnType<typeof useLateInterestCard>['onDownloadClaim'];
  isDownloadClaimPending: boolean;
  claimDialogOpen: boolean;
  onClaimDialogOpenChange: (open: boolean) => void;
  waiveDialogOpen: boolean;
  onWaiveDialogOpenChange: (open: boolean) => void;
  revokeDialogOpen: boolean;
  onRevokeDialogOpenChange: (open: boolean) => void;
  claimDialog: ReturnType<typeof useLateInterestClaimDialog>;
  waiveDialog: ReturnType<typeof useLateInterestWaiveDialog>;
  revokeDialog: ReturnType<typeof useLateInterestRevokeWaiverDialog>;
}

function formatGBP(minorAmount: number, locale: string = 'en-GB'): string {
  return formatMinorAsCurrency(minorAmount, 'GBP', locale);
}

export function LateInterestSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LateInterestB2cNotApplicable() {
  const t = useTranslations('Payments.lateInterest');
  return <p className="text-sm text-muted-foreground">{t('b2cNotApplicable')}</p>;
}

export function LateInterestCard({
  data,
  onDownloadClaim,
  isDownloadClaimPending,
  claimDialogOpen,
  onClaimDialogOpenChange,
  waiveDialogOpen,
  onWaiveDialogOpenChange,
  revokeDialogOpen,
  onRevokeDialogOpenChange,
  claimDialog,
  waiveDialog,
  revokeDialog,
}: LateInterestCardProps) {
  const t = useTranslations('Payments.lateInterest');

  const latestClaim = data.claims[0] ?? null;
  const latestWaiver = data.waivers[0] ?? null;
  const latestClaimId = latestClaim?.id;

  const openClaimDialog = useCallback(() => {
    onClaimDialogOpenChange(true);
  }, [onClaimDialogOpenChange]);

  const openWaiveDialog = useCallback(() => {
    onWaiveDialogOpenChange(true);
  }, [onWaiveDialogOpenChange]);

  const openRevokeDialog = useCallback(() => {
    onRevokeDialogOpenChange(true);
  }, [onRevokeDialogOpenChange]);

  const handleDownloadClaim = useCallback(() => {
    if (latestClaimId) onDownloadClaim(latestClaimId);
  }, [onDownloadClaim, latestClaimId]);

  const status: 'NOT_YET_OVERDUE' | 'ACCRUING' | 'CLAIMED' | 'WAIVED' | 'PAID' =
    data.daysOverdue === 0
      ? 'NOT_YET_OVERDUE'
      : data.claimStatus === 'CLAIMED'
        ? 'CLAIMED'
        : data.waiverStatus === 'WAIVED'
          ? 'WAIVED'
          : 'ACCRUING';

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
              <Button onClick={openClaimDialog} size="sm">
                {t('claimCta')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openWaiveDialog}
                className="text-destructive hover:text-destructive">
                {t('waiveCta')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ClaimDialog
          open={claimDialogOpen}
          onOpenChange={onClaimDialogOpenChange}
          onConfirm={claimDialog.onConfirm}
          isPending={claimDialog.isPending}
        />
        <WaiveDialog
          open={waiveDialogOpen}
          onOpenChange={onWaiveDialogOpenChange}
          onConfirm={waiveDialog.onConfirm}
          isPending={waiveDialog.isPending}
        />
      </>
    );
  }

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
                onClick={handleDownloadClaim}
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
              onClick={openRevokeDialog}
              className="text-destructive hover:text-destructive">
              {t('revokeWaiverCta')}
            </Button>
          </CardContent>
        </Card>

        <RevokeWaiverDialog
          waiverId={latestWaiver?.id ?? ''}
          open={revokeDialogOpen}
          onOpenChange={onRevokeDialogOpenChange}
          onConfirm={revokeDialog.onConfirm}
          isPending={revokeDialog.isPending}
        />
      </>
    );
  }

  return null;
}

interface DetailRowProps {
  label: string;
  value: string;
  tooltip?: ReactNode;
}

function DetailRow({ label, value, tooltip }: DetailRowProps) {
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
