/**
 * Late-interest summary card.
 *
 * Data source: `latePaymentInterest.getForInvoice`. That procedure spreads
 * the `LateInterestResult` from `calculateLateInterest` (daysOverdue,
 * principalOutstandingMinor, rateUsed, dailyInterestMinor,
 * accruedInterestMinor, compensationTierMinor, totalClaimMinor) and adds
 * `waiverStatus`, `claimStatus`, `waivers`, and `claims`. The wrapper below
 * narrows the discriminated union to the applicable branch before rendering.
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
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useLateInterestCard as UseLateInterestCard } from '../hooks/use-late-interest-card.js';
import { useLateInterestCard } from '../hooks/use-late-interest-card.js';
import type { useLateInterestClaimDialog as UseLateInterestClaimDialog } from '../hooks/use-late-interest-claim-dialog.js';
import { useLateInterestClaimDialog } from '../hooks/use-late-interest-claim-dialog.js';
import type { useLateInterestRevokeWaiverDialog as UseLateInterestRevokeWaiverDialog } from '../hooks/use-late-interest-revoke-waiver-dialog.js';
import { useLateInterestRevokeWaiverDialog } from '../hooks/use-late-interest-revoke-waiver-dialog.js';
import type { useLateInterestWaiveDialog as UseLateInterestWaiveDialog } from '../hooks/use-late-interest-waive-dialog.js';
import { useLateInterestWaiveDialog } from '../hooks/use-late-interest-waive-dialog.js';
import { ClaimDialog } from './claim-dialog.js';
import { LateInterestStatusPill } from './late-interest-status-pill.js';
import { RateCalculationTooltip } from './rate-calculation-tooltip.js';
import { RevokeWaiverDialog } from './revoke-waiver-dialog.js';
import { WaiveDialog } from './waive-dialog.js';

type LateInterestResponse = NonNullable<ReturnType<typeof UseLateInterestCard>['data']>;

/**
 * `getForInvoice` is a discriminated union: scope-gate misses return
 * `{ applicable: false, reason }`, while the eligible branch spreads the full
 * `LateInterestResult` plus `waiverStatus`, `claimStatus`, `waivers`, `claims`.
 * The wrapper short-circuits the inapplicable branch before rendering, so the
 * view only ever receives the eligible shape. `applicable` is typed `boolean`
 * on the result, so we discriminate on `waiverStatus`, which is unique to it.
 */
type LateInterestData = Extract<LateInterestResponse, { waiverStatus: unknown }>;

export interface LateInterestCardViewProps {
  invoiceId: string;
  data: LateInterestData;
  onDownloadClaim: ReturnType<typeof UseLateInterestCard>['onDownloadClaim'];
  isDownloadClaimPending: boolean;
  claimDialogOpen: boolean;
  onClaimDialogOpenChange: (open: boolean) => void;
  waiveDialogOpen: boolean;
  onWaiveDialogOpenChange: (open: boolean) => void;
  revokeDialogOpen: boolean;
  onRevokeDialogOpenChange: (open: boolean) => void;
  claimDialog: ReturnType<typeof UseLateInterestClaimDialog>;
  waiveDialog: ReturnType<typeof UseLateInterestWaiveDialog>;
  revokeDialog: ReturnType<typeof UseLateInterestRevokeWaiverDialog>;
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: presentational state-variant view — one early-return card branch per late-interest status (NOT_YET_OVERDUE / ACCRUING / CLAIMED / WAIVED); the branch count is the status enum, kept colocated for readability.
export function LateInterestCardView({
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
}: LateInterestCardViewProps) {
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
                  <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="me-1.5 h-3.5 w-3.5" />
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

interface LateInterestCardProps {
  invoiceId: string;
  featureEnabled: boolean;
  contractorCountryCode: string;
  isBusinessCustomer: boolean;
  currency: string;
}

export function LateInterestCard(props: LateInterestCardProps) {
  const card = useLateInterestCard(
    props.invoiceId,
    props.featureEnabled,
    props.contractorCountryCode,
    props.isBusinessCustomer,
    props.currency,
  );

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const claim = useLateInterestClaimDialog(props.invoiceId, setClaimDialogOpen);
  const waive = useLateInterestWaiveDialog(props.invoiceId, setWaiveDialogOpen);
  const revoke = useLateInterestRevokeWaiverDialog(props.invoiceId, setRevokeDialogOpen);

  if (!card.isApplicable) return null;
  if (!props.isBusinessCustomer) return <LateInterestB2cNotApplicable />;
  if (card.isLoading) return <LateInterestSkeleton />;
  if (card.isError) return null;
  if (!card.data?.applicable) return null;

  return (
    <LateInterestCardView
      invoiceId={props.invoiceId}
      data={card.data}
      onDownloadClaim={card.onDownloadClaim}
      isDownloadClaimPending={card.isDownloadClaimPending}
      claimDialogOpen={claimDialogOpen}
      onClaimDialogOpenChange={setClaimDialogOpen}
      waiveDialogOpen={waiveDialogOpen}
      onWaiveDialogOpenChange={setWaiveDialogOpen}
      revokeDialogOpen={revokeDialogOpen}
      onRevokeDialogOpenChange={setRevokeDialogOpen}
      claimDialog={claim}
      waiveDialog={waive}
      revokeDialog={revoke}
    />
  );
}
