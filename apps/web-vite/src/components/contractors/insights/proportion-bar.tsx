const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

export interface ProportionSegment {
  key: string;
  value: number;
  /** CSS color for the segment fill (a `var(--…)` or `color-mix(…)`). */
  color: string;
  label: string;
  active?: boolean;
}

export interface ProportionBarProps {
  segments: ProportionSegment[];
  /** When set, each segment is a button that toggles its filter. */
  onSelect?: (key: string) => void;
  className?: string;
}

/**
 * Thin stacked proportion bar. Static by default; pass `onSelect` to make each
 * segment a filter toggle. A proportion reads faster as a bar than as a row of
 * numbers — the band's one earned viz, reused per composition group.
 */
export function ProportionBar({ segments, onSelect, className }: ProportionBarProps) {
  const visible = segments.filter(s => s.value > 0);
  if (visible.length === 0) return null;

  return (
    <div
      className={cx(
        'flex h-2 w-full overflow-hidden rounded-full border border-border/50',
        className,
      )}>
      {visible.map(segment =>
        onSelect ? (
          <button
            key={segment.key}
            type="button"
            aria-pressed={segment.active ?? false}
            aria-label={`${segment.label}: ${segment.value}`}
            onClick={() => onSelect(segment.key)}
            // biome-ignore lint/nursery/noInlineStyles: flex-grow + fill are the runtime proportion (count) and per-segment color — no static Tailwind class for arbitrary numeric grow / dynamic color
            style={{ flexGrow: segment.value, backgroundColor: segment.color }}
            className={cx(
              'h-full transition-opacity',
              segment.active ? 'opacity-100' : 'opacity-75 hover:opacity-100',
            )}
          />
        ) : (
          <span
            key={segment.key}
            aria-hidden="true"
            // biome-ignore lint/nursery/noInlineStyles: flex-grow + fill are the runtime proportion (count) and per-segment color — no static Tailwind class for arbitrary numeric grow / dynamic color
            style={{ flexGrow: segment.value, backgroundColor: segment.color }}
            className="h-full"
          />
        ),
      )}
    </div>
  );
}
