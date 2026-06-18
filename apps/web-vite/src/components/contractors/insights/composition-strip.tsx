import { contractorTypeEnum } from '@contractor-ops/validators';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';
import type { ContractorComposition } from './types.js';

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const LIFECYCLE_ORDER = ['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED'] as const;
const HEALTH_ORDER = ['green', 'yellow', 'red'] as const;

export type CompositionGroup = 'lifecycleStage' | 'type' | 'country' | 'health';

export interface CompositionStripProps {
  composition: ContractorComposition;
  active: { lifecycleStage: string[]; type: string[]; country: string[]; health: string[] };
  onToggle: (group: CompositionGroup, value: string) => void;
}

/**
 * Population segments as a navigable filter surface — rows of toggle chips with
 * live counts (NOT a pie chart). Compliance health is the one earned viz: a thin
 * proportion ribbon whose segments are themselves the filter targets.
 */
export function CompositionStrip({ composition, active, onToggle }: CompositionStripProps) {
  const t = useTranslations('Contractors');

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
    <div className="space-y-3 px-1">
      <SegmentGroup
        title={t('columns.lifecycleStage')}
        chips={lifecycleChips}
        activeValues={active.lifecycleStage}
        onToggle={v => onToggle('lifecycleStage', v)}
      />
      <SegmentGroup
        title={t('columns.type')}
        chips={typeChips}
        activeValues={active.type}
        onToggle={v => onToggle('type', v)}
      />
      <SegmentGroup
        title={t('insights.composition.jurisdiction')}
        chips={jurisdictionChips}
        activeValues={active.country}
        onToggle={v => onToggle('country', v)}
      />
      <HealthGroup
        title={t('columns.health')}
        health={composition.health}
        activeValues={active.health}
        onToggle={v => onToggle('health', v)}
        label={v => tDynLoose(t, 'health', enumKey(v))}
      />
    </div>
  );
}

interface Chip {
  value: string;
  label: string;
  count: number;
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="me-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      {chips.map(chip => (
        <SegmentChip
          key={chip.value}
          label={chip.label}
          count={chip.count}
          pressed={activeValues.includes(chip.value)}
          onToggle={() => onToggle(chip.value)}
        />
      ))}
    </div>
  );
}

function SegmentChip({
  label,
  count,
  pressed,
  onToggle,
}: {
  label: string;
  count: number;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
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

const HEALTH_COLOR: Record<(typeof HEALTH_ORDER)[number], string> = {
  green: 'var(--status-success)',
  yellow: 'var(--status-warning)',
  red: 'var(--status-danger)',
};

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="me-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <div className="flex h-2.5 min-w-40 flex-1 overflow-hidden rounded-full border border-border/60">
        {HEALTH_ORDER.map(key => {
          const value = health[key];
          if (value === 0) return null;
          const pressed = activeValues.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={pressed}
              aria-label={`${label(key)}: ${value}`}
              onClick={() => onToggle(key)}
              style={{ flexGrow: value, backgroundColor: HEALTH_COLOR[key] }}
              className={cx(
                'h-full transition-opacity',
                pressed ? 'opacity-100' : 'opacity-70 hover:opacity-100',
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {HEALTH_ORDER.map(key =>
          health[key] > 0 ? (
            <span key={key} className="inline-flex items-center gap-1 tabular-nums">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: HEALTH_COLOR[key] }}
              />
              {health[key]}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
