import type { ReactNode } from 'react';
import { PulseDot } from './pulse-dot.js';

/**
 * Eight semantic status variants. Domain-aware mapping
 * (`statusToVariant(domain, status)`) lives in
 * @contractor-ops/ui/src/status/mapper.ts (commit group 4).
 */
export type AtelierStatusVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'processing'
  | 'blocked'
  | 'live';

export interface AtelierStatusPillProps {
  variant: AtelierStatusVariant;
  /** Whether the leading dot pulses. Common for live/processing. */
  pulse?: boolean;
  children: ReactNode;
}

/**
 * Compact status badge backed by the 8 variant tokens defined in
 * @contractor-ops/ui/styles/status.css. Uses `--status-{variant}{,-bg,-fg}`
 * so the visual stays consistent across light/dark modes.
 *
 * Replaces the V2 SlaPill — that name was domain-specific (SLA), this
 * one isn't. SLA mapping lives at the call site via
 * `statusToVariant('approval', sla)` in commit group 4.
 */
export function AtelierStatusPill({ variant, pulse = false, children }: AtelierStatusPillProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
      style={{
        background: `var(--status-${variant}-bg)`,
        color: `var(--status-${variant}-fg)`,
      }}>
      <PulseDot color={`var(--status-${variant})`} pulse={pulse} />
      {children}
    </span>
  );
}
