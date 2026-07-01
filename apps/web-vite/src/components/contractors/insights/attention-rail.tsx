import { Sparkline } from '@contractor-ops/ui';
import type { LucideIcon } from 'lucide-react';
import { Ban, CalendarClock, Clock, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractorAttention } from './types.js';

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');
const tint = (cssVar: string, pct: number) =>
  `color-mix(in oklch, var(${cssVar}) ${pct}%, transparent)`;

export interface AttentionRailProps {
  attention: ContractorAttention;
  atRiskActive: boolean;
  expiringActive: boolean;
  paymentBlockedActive: boolean;
  stalledActive: boolean;
  onToggleAtRisk: () => void;
  onToggleExpiring: () => void;
  onTogglePaymentBlocked: () => void;
  onToggleStalled: () => void;
}

/**
 * Actionable triage strip rendered as ledger rows — tinted icon chip + label +
 * a right-aligned, status-tinted figure. Each item is a button that applies a
 * table filter; a zero-count item degrades to a calm, disabled state (its own
 * icon + an "all clear" line, so no two items read alike). No glow, no count-up
 * (operational restraint) — the figure column and the status tint carry the
 * signal toward "what needs action next".
 */
export function AttentionRail({
  attention,
  atRiskActive,
  expiringActive,
  paymentBlockedActive,
  stalledActive,
  onToggleAtRisk,
  onToggleExpiring,
  onTogglePaymentBlocked,
  onToggleStalled,
}: AttentionRailProps) {
  const t = useTranslations('Contractors');

  return (
    <div
      role="group"
      aria-label={t('insights.attention.title')}
      className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
      <RailItem
        cssVar="--status-danger"
        icon={ShieldAlert}
        count={attention.atRiskCompliance}
        label={t('insights.attention.atRisk')}
        active={atRiskActive}
        onToggle={onToggleAtRisk}
      />
      <RailItem
        cssVar="--status-warning"
        icon={CalendarClock}
        count={attention.expiringContracts}
        label={t('insights.attention.expiring')}
        active={expiringActive}
        onToggle={onToggleExpiring}
        trailing={
          attention.expiringContracts > 0 ? (
            <Sparkline
              data={attention.expirySparkline}
              srLabel={t('insights.attention.expiringSr', { count: attention.expiringContracts })}
              w={44}
              h={18}
              color="var(--status-warning)"
            />
          ) : null
        }
      />
      <RailItem
        cssVar="--status-blocked"
        icon={Ban}
        count={attention.paymentBlocked}
        label={t('insights.attention.paymentBlocked')}
        active={paymentBlockedActive}
        onToggle={onTogglePaymentBlocked}
      />
      <RailItem
        cssVar="--status-processing"
        icon={Clock}
        count={attention.stalledOnboarding}
        label={t('insights.attention.stalled')}
        active={stalledActive}
        onToggle={onToggleStalled}
      />
    </div>
  );
}

interface RailItemProps {
  cssVar: string;
  icon: LucideIcon;
  count: number;
  label: string;
  active: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
}

function RailItem({ cssVar, icon: Icon, count, label, active, onToggle, trailing }: RailItemProps) {
  const t = useTranslations('Contractors');
  const has = count > 0;

  return (
    <button
      type="button"
      disabled={!has}
      aria-pressed={active}
      onClick={onToggle}
      className={cx(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors',
        has ? 'hover:bg-muted/60' : 'cursor-default',
        active && 'bg-muted ring-1 ring-inset ring-border',
      )}>
      <span
        aria-hidden="true"
        className={cx(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          !has && 'bg-muted',
        )}
        style={has ? { backgroundColor: tint(cssVar, 14), color: `var(${cssVar})` } : undefined}>
        <Icon className={cx('size-4', !has && 'text-muted-foreground/70')} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-foreground">{label}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {has ? t('insights.attention.needsAction') : t('insights.attention.allClear')}
        </span>
      </span>
      {trailing}
      <span
        className={cx('text-lg font-semibold tabular-nums', !has && 'text-muted-foreground/50')}
        style={has ? { color: `var(${cssVar})` } : undefined}>
        {count}
      </span>
    </button>
  );
}
