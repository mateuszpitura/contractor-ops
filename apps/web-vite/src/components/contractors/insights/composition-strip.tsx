import { contractorTypeEnum } from '@contractor-ops/validators';
import { useCallback } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ProportionSegment } from './proportion-bar.js';
import { ProportionBar } from './proportion-bar.js';
import type { ContractorComposition } from './types.js';

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const LIFECYCLE_ORDER = ['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED'] as const;
const HEALTH_ORDER = ['green', 'yellow', 'red'] as const;

const HEALTH_COLOR: Record<(typeof HEALTH_ORDER)[number], string> = {
  green: 'var(--status-success)',
  yellow: 'var(--status-warning)',
  red: 'var(--status-danger)',
};

const HEALTH_BG_CLASS: Record<(typeof HEALTH_ORDER)[number], string> = {
  green: 'bg-[var(--status-success)]',
  yellow: 'bg-[var(--status-warning)]',
  red: 'bg-[var(--status-danger)]',
};

export type CompositionGroup = 'lifecycleStage' | 'type' | 'country' | 'health';

export interface CompositionStripProps {
  composition: ContractorComposition;
  active: { lifecycleStage: string[]; type: string[]; country: string[]; health: string[] };
  onToggle: (group: CompositionGroup, value: string) => void;
}

interface Chip {
  value: string;
  label: string;
  count: number;
}

/** Monochrome proportion segments — biggest share is the darkest primary tint. */
function monoSegments(chips: Chip[]): ProportionSegment[] {
  const byShare = [...chips].sort((a, b) => b.count - a.count).map(c => c.value);
  return chips.map(chip => {
    const pct = Math.max(32, 84 - byShare.indexOf(chip.value) * 16);
    return {
      key: chip.value,
      label: chip.label,
      value: chip.count,
      color: `color-mix(in oklch, var(--primary) ${pct}%, transparent)`,
    };
  });
}

/**
 * Population segments as a navigable filter surface — each group is a small
 * proportion bar (visual weight) over a row of toggle chips (exact labels +
 * counts + filter state). Health is the one status-coloured, directly clickable
 * bar.
 */
export function CompositionStrip({ composition, active, onToggle }: CompositionStripProps) {
  const t = useTranslations('Contractors');

  const toggleLifecycle = useCallback((v: string) => onToggle('lifecycleStage', v), [onToggle]);
  const toggleType = useCallback((v: string) => onToggle('type', v), [onToggle]);
  const toggleCountry = useCallback((v: string) => onToggle('country', v), [onToggle]);
  const toggleHealth = useCallback((v: string) => onToggle('health', v), [onToggle]);
  const healthLabel = useCallback((v: string) => tDynLoose(t, 'health', enumKey(v)), [t]);

  const lifecycleChips = LIFECYCLE_ORDER.filter(s => (composition.lifecycleStage[s] ?? 0) > 0).map(
    s => ({
      value: s,
      label: tDynLoose(t, 'lifecycle', enumKey(s)),
      count: composition.lifecycleStage[s] ?? 0,
    }),
  );

  const typeChips = contractorTypeEnum.options
    .filter(ct => (composition.type[ct] ?? 0) > 0)
    .map(ct => ({
      value: ct,
      label: tDynLoose(t, 'type', enumKey(ct)),
      count: composition.type[ct] ?? 0,
    }));

  const jurisdictionChips = composition.jurisdiction.map(j => ({
    value: j.countryCode,
    label: j.countryCode,
    count: j.count,
  }));

  return (
    <div className="space-y-3">
      <SegmentGroup
        title={t('columns.lifecycleStage')}
        chips={lifecycleChips}
        activeValues={active.lifecycleStage}
        onToggle={toggleLifecycle}
      />
      <SegmentGroup
        title={t('columns.type')}
        chips={typeChips}
        activeValues={active.type}
        onToggle={toggleType}
      />
      <SegmentGroup
        title={t('insights.composition.jurisdiction')}
        chips={jurisdictionChips}
        activeValues={active.country}
        onToggle={toggleCountry}
      />
      <HealthGroup
        title={t('columns.health')}
        health={composition.health}
        activeValues={active.health}
        onToggle={toggleHealth}
        label={healthLabel}
      />
    </div>
  );
}

function SegmentGroup({
  title,
  chips,
  activeValues,
  onToggle,
}: {
  title: string;
  chips: Chip[];
  activeValues: string[];
  onToggle: (value: string) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <GroupLabel>{title}</GroupLabel>
        {chips.length >= 2 ? (
          <ProportionBar segments={monoSegments(chips)} className="max-w-[200px]" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map(chip => (
          <SegmentChip
            key={chip.value}
            value={chip.value}
            label={chip.label}
            count={chip.count}
            pressed={activeValues.includes(chip.value)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function SegmentChip({
  value,
  label,
  count,
  pressed,
  onToggle,
}: {
  value: string;
  label: string;
  count: number;
  pressed: boolean;
  onToggle: (value: string) => void;
}) {
  const handleClick = useCallback(() => onToggle(value), [onToggle, value]);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={handleClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        pressed
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border/60 text-muted-foreground hover:bg-muted/50',
      )}>
      <span>{label}</span>
      <span className="text-[11px] font-medium tabular-nums">{count}</span>
    </button>
  );
}

function HealthGroup({
  title,
  health,
  activeValues,
  onToggle,
  label,
}: {
  title: string;
  health: ContractorComposition['health'];
  activeValues: string[];
  onToggle: (value: string) => void;
  label: (value: string) => string;
}) {
  const total = health.green + health.yellow + health.red;
  if (total === 0) return null;

  const segments: ProportionSegment[] = HEALTH_ORDER.filter(k => health[k] > 0).map(k => ({
    key: k,
    label: label(k),
    value: health[k],
    color: HEALTH_COLOR[k],
    active: activeValues.includes(k),
  }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <GroupLabel>{title}</GroupLabel>
      <ProportionBar segments={segments} onSelect={onToggle} className="min-w-40 max-w-[260px]" />
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {HEALTH_ORDER.map(key =>
          health[key] > 0 ? (
            <span key={key} className="inline-flex items-center gap-1 tabular-nums">
              <span
                aria-hidden="true"
                className={cx('inline-block h-2 w-2 rounded-full', HEALTH_BG_CLASS[key])}
              />
              {health[key]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
