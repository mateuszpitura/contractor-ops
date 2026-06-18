import { Sparkline } from '@contractor-ops/ui';
import { Ban, Check, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ContractorAttention } from './types.js';

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

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
 * Actionable triage strip — one partitioned panel, NOT a tile grid. Each item
 * is a button with a deliberately distinct affordance (dot / sparkline / icon)
 * that applies a table filter; a zero-count item degrades to a calm, disabled
 * "all clear" state. No oversized numerals, count-up, or glow (operational
 * restraint).
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
    <fieldset
      aria-label={t('insights.attention.title')}
      className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-card/40 p-1 lg:grid-cols-4">
      <RailButton
        active={atRiskActive}
        count={attention.atRiskCompliance}
        label={t('insights.attention.atRisk')}
        onToggle={onToggleAtRisk}
        affordance={<Dot className="bg-[var(--status-danger)]" />}
      />
      <RailButton
        active={expiringActive}
        count={attention.expiringContracts}
        label={t('insights.attention.expiring')}
        onToggle={onToggleExpiring}
        affordance={
          <Sparkline
            data={attention.expirySparkline}
            srLabel={t('insights.attention.expiringSr', { count: attention.expiringContracts })}
            w={52}
            h={20}
            color="var(--status-warning)"
          />
        }
      />
      <RailButton
        active={paymentBlockedActive}
        count={attention.paymentBlocked}
        label={t('insights.attention.paymentBlocked')}
        onToggle={onTogglePaymentBlocked}
        affordance={<Ban className="h-4 w-4 text-[var(--status-blocked)]" aria-hidden="true" />}
      />
      <RailButton
        active={stalledActive}
        count={attention.stalledOnboarding}
        label={t('insights.attention.stalled')}
        onToggle={onToggleStalled}
        affordance={
          <Clock className="h-4 w-4 text-[var(--status-processing)]" aria-hidden="true" />
        }
      />
    </fieldset>
  );
}

interface RailButtonProps {
  active: boolean;
  count: number;
  label: string;
  affordance: ReactNode;
  onToggle: () => void;
}

function RailButton({ active, count, label, affordance, onToggle }: RailButtonProps) {
  const t = useTranslations('Contractors');
  const empty = count === 0;

  return (
    <button
      type="button"
      disabled={empty}
      aria-pressed={active}
      onClick={onToggle}
      className={cx(
        'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-start transition-colors',
        empty ? 'cursor-default opacity-60' : 'hover:bg-muted/50',
        active && 'bg-muted ring-1 ring-inset ring-border',
      )}>
      <span className="flex w-14 shrink-0 items-center justify-center">
        {empty ? (
          <Check className="h-4 w-4 text-[var(--status-success)]" aria-hidden="true" />
        ) : (
          affordance
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium tabular-nums">
          {empty ? t('insights.attention.allClear') : String(count)}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={cx('inline-block h-2.5 w-2.5 rounded-full', className)} />
  );
}
