import { AnimatedNumber } from '@contractor-ops/ui';
import { AlertTriangle, CalendarClock, CreditCard } from 'lucide-react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ComplianceDashboardTab } from './hooks/use-compliance-dashboard.js';

interface KpiCounts {
  atRisk: { value: number };
  upcomingRenewals: { value: number };
  blockedPayments: { value: number };
}

export interface ComplianceKpiCardsProps {
  kpis: KpiCounts | undefined;
  activeTab: ComplianceDashboardTab;
  onTabChange: (tab: ComplianceDashboardTab) => void;
}

const CARDS: ReadonlyArray<{
  tab: ComplianceDashboardTab;
  labelKey: string;
  icon: typeof AlertTriangle;
  read: (k: KpiCounts) => number;
}> = [
  { tab: 'at-risk', labelKey: 'atRisk.label', icon: AlertTriangle, read: k => k.atRisk.value },
  {
    tab: 'upcoming-renewals',
    labelKey: 'upcomingRenewals.label',
    icon: CalendarClock,
    read: k => k.upcomingRenewals.value,
  },
  {
    tab: 'blocked-payments',
    labelKey: 'blockedPayments.label',
    icon: CreditCard,
    read: k => k.blockedPayments.value,
  },
];

/**
 * Three keyboard-activatable summary cards that drive the dashboard's active
 * tab. Each card is a real `<button>` with `aria-pressed` reflecting selection
 * (WCAG). Presentational — props in, JSX out, no data layer.
 */
export function ComplianceKpiCards({ kpis, activeTab, onTabChange }: ComplianceKpiCardsProps) {
  const t = useTranslations('Compliance.dashboard');
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      role="group"
      aria-label={t('kpiGroupLabel')}>
      {CARDS.map(card => {
        const Icon = card.icon;
        const isActive = activeTab === card.tab;
        const count = kpis ? card.read(kpis) : 0;
        return (
          <button
            key={card.tab}
            type="button"
            aria-pressed={isActive}
            onClick={() => onTabChange(card.tab)}
            className={`flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
            }`}>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4" aria-hidden />
              {t(card.labelKey)}
            </span>
            <span className="text-3xl font-semibold tabular-nums">
              <AnimatedNumber value={count} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
