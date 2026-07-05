import { useTranslations } from '../../../i18n/useTranslations.js';

const TIERS = [
  { key: 'available', token: '--status-success' },
  { key: 'busy', token: '--status-warning' },
  { key: 'over', token: '--status-danger' },
] as const;

/** Always-visible key mapping the capacity band tint to its meaning. */
export function CapacityLegend() {
  const t = useTranslations('Leave.calendar.legend');

  return (
    <div role="list" aria-label={t('title')} className="flex flex-wrap items-center gap-4">
      {TIERS.map(tier => (
        <div role="listitem" key={tier.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            // biome-ignore lint/nursery/noInlineStyles: swatch fill is the per-tier status token — no static Tailwind class for the dynamic color-mix
            style={{
              backgroundColor: `color-mix(in oklch, var(${tier.token}) 22%, transparent)`,
              borderColor: `var(${tier.token})`,
            }}
            className="h-3 w-3 rounded-sm border"
          />
          <span className="text-[12px] text-muted-foreground">{t(tier.key)}</span>
        </div>
      ))}
    </div>
  );
}
