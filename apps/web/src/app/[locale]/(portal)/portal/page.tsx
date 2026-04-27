'use client';

import { useQuery } from '@tanstack/react-query';
import { Banknote, CalendarDays, Clock, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PortalPendingSignatures } from '@/components/portal/portal-pending-signatures';
import { SummaryCard, SummaryCardSkeleton } from '@/components/portal/summary-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { portalTrpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract first name from a display name string.
 */
function getFirstName(displayName: string): string {
  return displayName.split(' ')[0] ?? displayName;
}

/**
 * Format minor units to display amount with currency.
 */
function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Format a date to a short readable form (e.g. "Mar 15, 2026").
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal overview dashboard page.
 *
 * Per UI-SPEC D-02:
 * - Greeting: "Welcome back, {firstName}"
 * - 2x2 summary cards: Active Contracts, Pending Invoices, Recent Payments, Next Deadline
 * - Quick actions: Submit Invoice (primary), View Contracts (outline)
 * - Recent activity list (last 5 entries)
 */
export default function PortalOverviewPage() {
  const t = useTranslations('Portal');
  const overviewQuery = useQuery(portalTrpc.portal.overview.queryOptions());
  const sessionQuery = useQuery(portalTrpc.portal.getSession.queryOptions());

  const overview = overviewQuery.data;
  const session = sessionQuery.data;
  const isLoading = overviewQuery.isPending || sessionQuery.isPending;

  /**
   * Format a relative timestamp (e.g. "2 hours ago", "3 days ago").
   */
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
    <div>
      {/* Pending Signatures (above greeting per UI-SPEC D-04) */}
      <PortalPendingSignatures />

      {/* Greeting */}
      <h1 className="mt-6 text-[28px] font-semibold leading-[1.2]">
        {isLoading ? (
          <Skeleton className="h-9 w-64" />
        ) : (
          t('dashboard.welcomeBack', { name: getFirstName(session?.contractor.displayName ?? '') })
        )}
      </h1>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Quick Actions */}
      <div className="mt-6 flex gap-3">
        <Button render={<Link href="/portal/invoices/submit" />}>
          {t('dashboard.submitInvoice')}
        </Button>
        <Button variant="outline" render={<Link href="/portal/contracts" />}>
          {t('dashboard.viewContracts')}
        </Button>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold">{t('dashboard.recentActivity')}</h2>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
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
