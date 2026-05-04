export interface PulseDotProps {
  /** CSS color or var() for the dot fill. */
  color: string;
  /** Whether to render a continuously animated outer ring. */
  pulse?: boolean;
}

/**
 * Tiny inline status indicator. When `pulse` is true, an outer ring
 * expands and fades on a 2s loop (atelier-pulse class — disabled by
 * the universal reduced-motion rule).
 *
 * **A11y:** aria-hidden — meaningful state must come from adjacent text.
 */
export function PulseDot({ color, pulse = false }: PulseDotProps) {
  return (
    <span aria-hidden="true" className="relative inline-flex h-2 w-2">
      {pulse ? (
        <span
          className="atelier-pulse absolute inset-0 rounded-full opacity-75"
          style={{ background: color }}
        />
      ) : null}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
