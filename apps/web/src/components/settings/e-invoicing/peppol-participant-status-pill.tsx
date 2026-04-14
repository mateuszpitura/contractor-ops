// apps/web/src/components/settings/e-invoicing/peppol-participant-status-pill.tsx
//
// Phase 61 · Plan 61-07 — Peppol participant status pill.
//
// Pure stateless pill that renders the PeppolParticipant.status value with the
// UI-SPEC locked semantic triad (colour + icon + text). Re-used on both the
// Settings page's PeppolParticipantCard and (future) the invoices-list compliance
// summary tile.
//
// UI-SPEC §Color — palette mapping:
//   ACTIVE / REGISTERED  → border-success  + CircleCheck
//   PENDING / SUSPENDED  → border-warning  + ShieldAlert
//   DEREGISTERED         → border-destructive + ShieldX
//   NOT_REGISTERED       → border-muted    + Circle
//
// A11y: the lucide icon is `aria-hidden`; the text label is always visible so
// colour never carries information alone (WCAG 1.4.1).

import { Circle, CircleCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeppolParticipantStatus =
  | 'NOT_REGISTERED'
  | 'PENDING'
  | 'REGISTERED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEREGISTERED';

export interface PeppolParticipantStatusPillProps {
  status: PeppolParticipantStatus;
  label: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Semantic-triad class map (UI-SPEC §Color)
// ---------------------------------------------------------------------------

type TriadKey = 'success' | 'warning' | 'destructive' | 'muted';

const STATUS_TRIAD: Record<PeppolParticipantStatus, TriadKey> = {
  ACTIVE: 'success',
  REGISTERED: 'success',
  PENDING: 'warning',
  SUSPENDED: 'warning',
  DEREGISTERED: 'destructive',
  NOT_REGISTERED: 'muted',
};

const STATUS_ICON: Record<
  PeppolParticipantStatus,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  ACTIVE: CircleCheck,
  REGISTERED: CircleCheck,
  PENDING: ShieldAlert,
  SUSPENDED: ShieldAlert,
  DEREGISTERED: ShieldX,
  NOT_REGISTERED: Circle,
};

/**
 * Returns the tailwind class string for the UI-SPEC semantic-triad variant
 * (exported so the tests can assert the mapping without reaching into the
 * rendered DOM).
 */
export function semanticTriadClass(status: PeppolParticipantStatus): string {
  const triad = STATUS_TRIAD[status];
  switch (triad) {
    case 'success':
      return 'border-success text-success bg-success/10';
    case 'warning':
      return 'border-warning text-warning bg-warning/10';
    case 'destructive':
      return 'border-destructive text-destructive bg-destructive/10';
    case 'muted':
      return 'border-muted text-muted-foreground bg-muted/40';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeppolParticipantStatusPill({
  status,
  label,
  className,
}: PeppolParticipantStatusPillProps) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge
      variant="outline"
      data-status={status}
      className={cn(
        'gap-1.5 px-2.5 py-1 text-sm font-normal',
        semanticTriadClass(status),
        className,
      )}>
      <Icon aria-hidden="true" className="size-3.5" />
      <span>{label}</span>
    </Badge>
  );
}
