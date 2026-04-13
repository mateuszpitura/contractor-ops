'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  CircleDot,
  FileCheck,
  ListChecks,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
import { Link } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/trpc/init';
import {
  AnimatedNumber,
  AtelierBackground,
  DL_CFG,
  dlHref,
  fmtAmt,
  LiveClock,
  PulseDot,
  plnFmt,
  Ring,
  SectionLabel,
  SlaPill,
  Sparkline,
  TiltCard,
} from './_components/dashboard-primitives';
import { SpendChartV2 } from './_components/spend-chart-v2';

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function DashboardV2Page() {
  const t = useTranslations('Dashboard');
  const { can } = usePermissions();
  const session = authClient.useSession();
  const firstName = session.data?.user?.name?.split(' ')[0] ?? '';
  const hasReportAccess = can('report', ['read']);

  // ── Data ──
  const { data: kpis } = useQuery(trpc.dashboard.kpis.queryOptions());
  const { data: spendRaw } = useQuery(trpc.dashboard.spendTrend.queryOptions({ months: '6' }));
  const { data: deadlines } = useQuery(trpc.dashboard.deadlines.queryOptions());
  const { data: approvalsRaw } = useQuery(
    trpc.approval.listPending.queryOptions({ page: 1, pageSize: 5 }),
  );
  const { data: activityRaw } = useQuery(trpc.dashboard.activity.queryOptions());

  const approvals = approvalsRaw?.items ?? [];
  const activities = activityRaw?.items ?? [];

  const sparkData = useMemo(() => {
    if (!spendRaw?.length) return [];
    const m = new Map<string, number>();
    for (const r of spendRaw) m.set(r.month, (m.get(r.month) ?? 0) + r.totalMinor);
    return Array.from(m.values());
  }, [spendRaw]);

  const totalSpend = sparkData.reduce((s, v) => s + v, 0);

  const [now] = useState(() => new Date());
  const greetKey = now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening';
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="relative -m-6 min-h-screen">
      <AtelierBackground />

      <div className="relative z-10 p-6 lg:p-8">
        {/* ================================================================ */}
        {/* HERO — asymmetric split layout                                   */}
        {/* ================================================================ */}
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* LEFT — Greeting + context */}
          <div className="lg:col-span-5 xl:col-span-4">
            <TiltCard delay={0} className="h-full">
              <div className="flex h-full flex-col justify-between gap-6">
                {/* Status bar */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <PulseDot color="var(--color-success)" pulse />
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                      Live
                    </span>
                  </div>
                  <div className="h-3 w-px bg-border/40" />
                  <span className="text-[10px] text-muted-foreground/40">{dateStr}</span>
                  <div className="ms-auto">
                    <LiveClock />
                  </div>
                </div>

                {/* Greeting */}
                <div>
                  <h1 className="font-display text-[32px] font-black leading-[1.05] tracking-tight lg:text-[38px]">
                    {t(`greeting.${greetKey}` as Parameters<typeof t>[0], { name: firstName })}
                  </h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {t('greeting.subtitle')}
                  </p>
                </div>

                {/* Quick-nav pills */}
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: 'Contractors',
                      href: '/contractors',
                      count: kpis?.activeContractors.value,
                    },
                    { label: 'Invoices', href: '/invoices' },
                    { label: 'Approvals', href: '/approvals', count: kpis?.pendingApprovals.value },
                  ].map(n => (
                    <Link
                      key={n.label}
                      href={n.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground">
                      {n.label}
                      {n.count != null && n.count > 0 && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-bold text-primary">
                          {n.count}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </TiltCard>
          </div>

          {/* RIGHT — Hero metric card */}
          {hasReportAccess && (
            <div className="lg:col-span-7 xl:col-span-8">
              <TiltCard delay={120} glow shimmer href="/reports" className="h-full">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                      6-month spend overview
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 transition-all group-hover:text-primary/60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>

                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    {/* The big number */}
                    <p className="atelier-hero-glow bg-gradient-to-r from-foreground via-primary/80 to-foreground bg-clip-text font-display text-[56px] font-black leading-none tracking-tighter text-transparent sm:text-[72px] lg:text-[80px]">
                      <AnimatedNumber
                        value={totalSpend}
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        format={n => plnFmt.format(n / 100)}
                        duration={2200}
                      />
                    </p>

                    {/* Trend chip */}
                    {sparkData.length >= 2 &&
                      (() => {
                        const prev = sparkData[sparkData.length - 2];
                        const curr = sparkData[sparkData.length - 1];
                        const pct = prev === 0 ? 0 : ((curr - prev) / prev) * 100;
                        const up = pct >= 0;
                        return (
                          <div
                            className={`mb-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${up ? 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/8 text-red-600 dark:text-red-400'}`}>
                            {up ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {up ? '+' : ''}
                            {pct.toFixed(1)}% vs prev month
                          </div>
                        );
                      })()}
                  </div>

                  {/* Sparkline — stretches to full width */}
                  <div className="w-full">
                    <Sparkline
                      data={sparkData}
                      w={600}
                      h={56}
                      color="var(--color-primary)"
                      id="hero"
                    />
                  </div>
                </div>
              </TiltCard>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* KPI STRIP — 5 metrics in a row                                   */}
        {/* ================================================================ */}
        <SectionLabel icon={CircleDot}>Key Metrics</SectionLabel>
        <div className="mt-3 mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              {
                icon: Users,
                label: 'Active contractors',
                val: kpis?.activeContractors.value ?? 0,
                prev: kpis?.activeContractors.prevValue ?? 0,
                color: 'var(--color-chart-1)',
                href: '/contractors?status=active',
              },
              {
                icon: FileCheck,
                label: 'Pending approvals',
                val: kpis?.pendingApprovals.value ?? 0,
                prev: kpis?.pendingApprovals.prevValue ?? 0,
                color: 'var(--color-warning)',
                href: '/approvals?tab=my&status=pending',
                ring: true,
              },
              {
                icon: AlertTriangle,
                label: 'Expiring contracts',
                val: kpis?.expiringContracts.value ?? 0,
                prev:
                  (kpis?.expiringContracts as { value: number; prevValue?: number })?.prevValue ??
                  0,
                color: 'var(--color-destructive)',
                href: '/contracts?status=expiring',
              },
              {
                icon: ListChecks,
                label: 'Open tasks',
                val: kpis?.openTasks.value ?? 0,
                prev: (kpis?.openTasks as { value: number; prevValue?: number })?.prevValue ?? 0,
                color: 'var(--color-info)',
                href: '/workflows?tab=my-tasks',
                ring: true,
              },
              {
                icon: Zap,
                label: 'Ready to pay',
                val: kpis?.readyToPayTotal.valueMinor ?? 0,
                prev: kpis?.readyToPayTotal.prevValueMinor ?? 0,
                color: 'var(--color-success)',
                href: '/payments?status=ready',
                fmt: (n: number) => plnFmt.format(n / 100),
              },
            ] as const
          ).map((kpi, i) => {
            const pct = kpi.prev === 0 ? 0 : ((kpi.val - kpi.prev) / kpi.prev) * 100;
            const up = pct > 0;
            const flat = pct === 0;
            const Icon = kpi.icon;

            return (
              <TiltCard key={kpi.label} delay={280 + i * 70} href={kpi.href} shimmer>
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
                      <Icon className="h-4 w-4" />
                    </div>
                    {'ring' in kpi && !!kpi.ring && (
                      <Ring
                        value={kpi.val}
                        max={Math.max(kpi.val, 8)}
                        color={kpi.color}
                        size={38}
                        stroke={3}>
                        <span className="text-[8px] font-bold">{kpi.val}</span>
                      </Ring>
                    )}
                  </div>
                  <div>
                    <p className="font-display text-[30px] font-black leading-none tracking-tight">
                      <AnimatedNumber value={kpi.val} format={'fmt' in kpi ? kpi.fmt : undefined} />
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                        {kpi.label}
                      </span>
                      {!flat && (
                        <span
                          className={`text-[9px] font-bold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
                          {up ? '+' : ''}
                          {pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </TiltCard>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* CHART + DEADLINES — two-column                                   */}
        {/* ================================================================ */}
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Chart — takes 3 cols */}
          {hasReportAccess && (
            <div className="lg:col-span-3">
              <TiltCard delay={650}>
                <SpendChartV2 />
              </TiltCard>
            </div>
          )}

          {/* Deadlines — takes 2 cols */}
          <div className={hasReportAccess ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <TiltCard delay={750}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-[15px] font-bold">{t('deadlines.title')}</h3>
                <Link
                  href="/reports?report=expiring-contracts"
                  className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/60 transition-colors hover:text-primary">
                  All <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {deadlines?.length ? (
                <div className="relative space-y-0.5">
                  {/* Glowing gradient timeline */}
                  <div className="absolute start-[9px] top-4 bottom-4 w-[2px] rounded-full" />

                  {deadlines.slice(0, 6).map(item => {
                    const cfg = DL_CFG[item.type] ?? DL_CFG.TASK_OVERDUE;
                    const Icon = cfg.icon;
                    const overdue = 'daysOverdue' in item && item.daysOverdue != null;
                    const days = (overdue ? item.daysOverdue : item.daysRemaining) as number;

                    return (
                      <Link
                        key={`${item.type}-${item.entityId}`}
                        href={dlHref(item.type, item.entityId)}
                        className="group/d relative flex items-center gap-3 rounded-xl py-2.5 ps-8 pe-2 transition-all hover:bg-muted/15">
                        {/* Node */}
                        <div className="absolute start-[3px] h-[14px] w-[14px] rounded-full border-2 bg-card transition-shadow group-hover/d:shadow-md">
                          <div className="absolute inset-[3px] rounded-full" />
                        </div>
                        <span>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {item.entityName}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums ${overdue ? 'bg-red-500/10 text-red-500' : 'bg-muted/50 text-muted-foreground'}`}>
                          {overdue
                            ? t('deadlines.overdue', { days })
                            : t('deadlines.upcoming', { days })}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  {t('deadlines.empty')}
                </p>
              )}
            </TiltCard>
          </div>
        </div>

        {/* ================================================================ */}
        {/* APPROVALS                                                        */}
        {/* ================================================================ */}
        <SectionLabel icon={FileCheck}>Pending Approvals</SectionLabel>
        <div className="mt-3 mb-8">
          {approvals.length === 0 ? (
            <TiltCard delay={900}>
              <p className="py-10 text-center text-xs text-muted-foreground">
                {t('approvals.empty')}
              </p>
            </TiltCard>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {approvals.map((item, i) => {
                const inv = item.invoice;
                const name = inv?.contractor?.legalName ?? inv?.sellerName ?? '---';
                const amt = inv?.totalMinor ?? 0;
                const cur = inv?.currency ?? 'PLN';
                const invId = item.approvalFlow?.resourceId;

                return (
                  <TiltCard
                    key={item.id}
                    delay={900 + i * 60}
                    href={invId ? `/invoices/${invId}` : '/approvals'}
                    shimmer>
                    <div className="flex items-center gap-3.5">
                      {/* Avatar */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black transition-transform group-hover:scale-105">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold">{name}</p>
                        <p className="text-[10px] text-muted-foreground/50">Invoice approval</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="font-mono text-[14px] font-black tabular-nums tracking-tight">
                          {fmtAmt(amt, cur)}
                        </span>
                        {!!item.slaStatus && <SlaPill status={item.slaStatus.status} />}
                      </div>
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* ACTIVITY FEED                                                    */}
        {/* ================================================================ */}
        <SectionLabel icon={Activity}>Recent Activity</SectionLabel>
        <div className="mt-3">
          <TiltCard delay={1100}>
            {activities.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {t('activity.empty')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border/30 sm:grid-cols-2 xl:grid-cols-4">
                {activities.slice(0, 8).map(item => (
                  <div
                    key={item.id}
                    className="group/a relative flex items-start gap-3 bg-card/30 p-4 transition-all hover:bg-primary/[0.03] dark:bg-white/[0.01] dark:hover:bg-white/[0.03]">
                    {/* Left accent on hover */}
                    <div className="absolute inset-y-0 start-0 w-[2px] bg-primary/0 transition-all group-hover/a:bg-primary/50" />
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[10px] font-black text-muted-foreground/60">
                      {(item.actorName ?? 'S').charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-snug">
                        <span className="font-semibold">{item.actorName ?? 'System'}</span>{' '}
                        <span className="text-muted-foreground/70">
                          {t(`activity.actions.${item.action}` as Parameters<typeof t>[0])}
                        </span>
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider">
                          {t(`activity.resources.${item.resourceType}` as Parameters<typeof t>[0])}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground/40">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TiltCard>
        </div>
      </div>
    </div>
  );
}
