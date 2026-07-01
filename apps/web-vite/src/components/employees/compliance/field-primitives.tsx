import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared field building blocks for the per-market employee registration forms.
 * These encode the three classes of feedback the surface uses:
 *   - HARD error   → red inline `FieldError` (blocks save)
 *   - ADVISORY     → amber `AdvisoryPill` (never blocks save)
 *   - ADVISER-VERIFY → muted dashed `AdviserVerifyNote`
 * Colour is never the sole signal — pills and errors carry text (and the pill an
 * icon) so the meaning survives without hue.
 */

/**
 * Edit-mode reveal context for a national ID already stored on a worker. When
 * present, a PII field renders the audited masked-reveal instead of a plaintext
 * capture input. Absent during first registration (nothing is stored yet).
 */
export interface PiiRevealContext {
  workerId: string;
  last4: string;
  canReveal: boolean;
}

export function RequiredLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required ? (
        <span aria-hidden="true" className="ms-1 text-destructive">
          *
        </span>
      ) : null}
    </Label>
  );
}

/** Hard, blocking validation error — red inline, announced politely. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" aria-live="polite" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/**
 * Advisory (non-blocking) signal — e.g. an Emirates-ID checksum that could not
 * be verified, or a lenient GOSI/WPS format. Amber, never red; save proceeds.
 */
export function AdvisoryPill({ message }: { message: string }) {
  return (
    <Badge variant="warning" role="status" className="font-normal">
      <AlertCircle className="me-1 h-3 w-3" aria-hidden="true" />
      {message}
    </Badge>
  );
}

/** Statutory seed-list caveat — verify with a local payroll adviser. */
export function AdviserVerifyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
      {children}
    </p>
  );
}
