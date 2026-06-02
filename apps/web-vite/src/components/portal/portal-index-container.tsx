import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import { SectionLabel } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Banknote, CalendarDays, Clock, FileText } from 'lucide-react';
import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { usePortalIndex } from './hooks/use-portal-index.js';
import { PortalHomeComplianceBanner } from './portal-home-compliance-banner.js';
import { PortalPendingSignaturesContainer } from './portal-pending-signatures-container.js';
import { SummaryCard, SummaryCardSkeleton } from './summary-card.js';

function getFirstName(displayName: string): string {
  return displayName.split(' ')[0] ?? displayName;
}

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: minorUnitDigits(currency),
  }).format(minorToMajor(minor, currency));
}

export function PortalIndexContainer() {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();
  const { overview, session, isLoading } = usePortalIndex();

  function formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return t('time.justNow');
    if (diffMinutes < 60) return t('time.minutesAgo', { minutes: diffMinutes });
    if (diffHours < 24) return t('time.hoursAgo', { hours: diffHours });
    if (diffDays < 30) return t('time.daysAgo', { days: diffDays });
    return formatDate(d);
  }

  return (
    <div className="space-y-6">
      <PortalPendingSignaturesContainer />
      <PortalHomeComplianceBanner />

      <h1 className="text-[28px] font-semibold leading-[1.2]">
        {isLoading ? (
          <Skeleton className="h-9 w-64" />
        ) : (
          t('dashboard.welcomeBack', { name: getFirstName(session?.contractor.displayName ?? '') })
        )}
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isLoading ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard
              icon={FileText}
              label={t('dashboard.activeContracts')}
              value={overview?.activeContracts ?? 0}
            />
            <SummaryCard
              icon={Clock}
              label={t('dashboard.pendingInvoices')}
              value={overview?.pendingInvoices ?? 0}
            />
            <SummaryCard
              icon={Banknote}
              label={t('dashboard.recentPayments')}
              value={formatAmount(
                overview?.recentPaymentsMinor ?? 0,
                overview?.recentPaymentsCurrency ?? 'PLN',
              )}
            />
            <SummaryCard
              icon={CalendarDays}
              label={t('dashboard.nextDeadline')}
              value={
                overview?.upcomingDeadline
                  ? formatDate(overview.upcomingDeadline)
                  : t('dashboard.none')
              }
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href="/portal/invoices/submit" />}>
          {t('dashboard.submitInvoice')}
        </Button>
        <Button variant="outline" render={<Link href="/portal/contracts" />}>
          {t('dashboard.viewContracts')}
        </Button>
      </div>

      <div>
        <SectionLabel variant="portal">{t('dashboard.recentActivity')}</SectionLabel>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={`skel-${i}`} className="flex items-center justify-between">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          ) : overview?.recentActivity && overview.recentActivity.length > 0 ? (
            overview.recentActivity.map(entry => (
              <div
                key={`${entry.event}-${entry.timestamp}`}
                className="flex items-start justify-between gap-4 border-b border-border/50 pb-3 last:border-0">
                <p className="text-sm">{entry.event}</p>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t('dashboard.noActivity')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
