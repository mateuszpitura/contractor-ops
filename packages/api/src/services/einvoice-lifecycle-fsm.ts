// packages/api/src/services/einvoice-lifecycle-fsm.ts
//
// Phase 61 · Plan 61-06 Task 1 — Lifecycle finite-state machine for
// EInvoiceLifecycle.validationStatus + EInvoiceLifecycle.transmissionStatus.
//
// Design rationale (CONTEXT D-12 + RESEARCH Pattern 4 / Pitfall 7):
//   * The FSM is a pure, data-driven lookup. Tables live at module scope,
//     readonly + frozen, so every (state × event) cell is either explicitly
//     mapped or explicitly absent — there is no silent fall-through.
//   * Illegal transitions throw `IllegalFsmTransitionError` with the current
//     state + the attempted event on the instance. Callers translate to
//     `BAD_REQUEST` at the tRPC boundary (the webhook handler returns 4xx).
//   * The machine is stateless (no lock, no cache). Callers wrap each
//     transition in a Prisma `$transaction` so concurrent mutations + webhook
//     re-deliveries can't race (Pitfall 7). Tests assert completeness of the
//     table for every state × event combination.
//
// Validation FSM (re-runnable — no terminal state; any layer re-validation
// may transition laterally):
//   NOT_VALIDATED → VALID | WARNINGS | INVALID
//   VALID         → VALID | WARNINGS | INVALID
//   WARNINGS      → VALID | WARNINGS | INVALID
//   INVALID       → VALID | WARNINGS | INVALID
//
// Transmission FSM (linear with one retry edge and one terminal sink):
//   NOT_SENT  → QUEUED
//   QUEUED    → SENT | FAILED
//   SENT      → DELIVERED | FAILED
//   FAILED    → QUEUED              (retry)
//   DELIVERED → DELIVERED           (idempotent; webhook re-deliveries)
//   Illegal:
//     NOT_SENT  → SENT | DELIVERED | FAILED (must go via QUEUED first)
//     DELIVERED → anything besides DELIVERED
//     SENT      → QUEUED (explicit retry only allowed from FAILED)

import type {
  EInvoiceTransmissionStatus,
  EInvoiceValidationStatus,
} from '@contractor-ops/db/generated/prisma/client';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const VALIDATION_EVENTS = [
  'validate_complete_valid',
  'validate_complete_warnings',
  'validate_complete_invalid',
] as const;
export type ValidationEvent = (typeof VALIDATION_EVENTS)[number];

export const TRANSMISSION_EVENTS = [
  'queue',
  'transmit_success',
  'delivery_ack',
  'delivery_failed',
  'retry',
] as const;
export type TransmissionEvent = (typeof TRANSMISSION_EVENTS)[number];

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/**
 * Thrown from `transitionValidation` / `transitionTransmission` when the
 * requested (current, event) pair is not in the FSM table.
 *
 * Carries `current` + `event` on the instance so the caller can surface a
 * precise log line without parsing the message string.
 */
export class IllegalFsmTransitionError extends Error {
  readonly current: string;
  readonly event: string;

  constructor(current: string, event: string) {
    super(
      `Illegal e-invoice lifecycle FSM transition: current state "${current}" does not accept event "${event}".`,
    );
    this.name = 'IllegalFsmTransitionError';
    this.current = current;
    this.event = event;
  }
}

// ---------------------------------------------------------------------------
// Validation transition table
// ---------------------------------------------------------------------------

// Keyed by `${current}|${event}` → next state. Any (current, event) pair not
// in this map is illegal — the caller throws IllegalFsmTransitionError.
const VALIDATION_TABLE: Readonly<Record<string, EInvoiceValidationStatus>> = Object.freeze({
  'NOT_VALIDATED|validate_complete_valid': 'VALID',
  'NOT_VALIDATED|validate_complete_warnings': 'WARNINGS',
  'NOT_VALIDATED|validate_complete_invalid': 'INVALID',
  'VALID|validate_complete_valid': 'VALID',
  'VALID|validate_complete_warnings': 'WARNINGS',
  'VALID|validate_complete_invalid': 'INVALID',
  'WARNINGS|validate_complete_valid': 'VALID',
  'WARNINGS|validate_complete_warnings': 'WARNINGS',
  'WARNINGS|validate_complete_invalid': 'INVALID',
  'INVALID|validate_complete_valid': 'VALID',
  'INVALID|validate_complete_warnings': 'WARNINGS',
  'INVALID|validate_complete_invalid': 'INVALID',
});

/**
 * Apply a validation event to the current validation status and return the
 * next status. Throws `IllegalFsmTransitionError` if the transition is not
 * defined in the table above.
 *
 * In practice the validation FSM accepts every event from every state (KoSIT
 * re-validation is always allowed), so this function is effectively a
 * mapping from event → resulting status — but the table is still explicit
 * so future tightening (e.g. forbidding re-validation from INVALID) doesn't
 * need a new code path.
 */
export function transitionValidation(
  current: EInvoiceValidationStatus,
  event: ValidationEvent,
): EInvoiceValidationStatus {
  const key = `${current}|${event}`;
  const next = VALIDATION_TABLE[key];
  if (!next) {
    throw new IllegalFsmTransitionError(current, event);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Transmission transition table
// ---------------------------------------------------------------------------

const TRANSMISSION_TABLE: Readonly<Record<string, EInvoiceTransmissionStatus>> = Object.freeze({
  'NOT_SENT|queue': 'QUEUED',
  'QUEUED|transmit_success': 'SENT',
  'QUEUED|delivery_failed': 'FAILED',
  'SENT|delivery_ack': 'DELIVERED',
  'SENT|delivery_failed': 'FAILED',
  'FAILED|retry': 'QUEUED',
  // DELIVERED is terminal and idempotent on webhook re-delivery only.
  'DELIVERED|delivery_ack': 'DELIVERED',
});

/**
 * Apply a transmission event to the current transmission status and return
 * the next status. Throws `IllegalFsmTransitionError` when the transition
 * is not defined in the table.
 *
 * Idempotency contract: `delivery_ack` on `DELIVERED` is a no-op transition
 * (returns `DELIVERED`). Every other event on a `DELIVERED` row throws.
 * Callers dedup webhook re-deliveries on Storecove's `guid` BEFORE calling
 * this function, so a stale / duplicate ack never masquerades as a state
 * change.
 */
export function transitionTransmission(
  current: EInvoiceTransmissionStatus,
  event: TransmissionEvent,
): EInvoiceTransmissionStatus {
  const key = `${current}|${event}`;
  const next = TRANSMISSION_TABLE[key];
  if (!next) {
    throw new IllegalFsmTransitionError(current, event);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Terminal-state predicate
// ---------------------------------------------------------------------------

/**
 * Returns true when the transmission status is a terminal sink from the
 * workflow perspective — no further state change is possible except
 * idempotent webhook re-deliveries.
 *
 * `FAILED` is NOT terminal: the UI surfaces a Retry button (maps to the
 * `retry` event → `QUEUED`).
 */
export function isTerminalTransmissionStatus(status: EInvoiceTransmissionStatus): boolean {
  return status === 'DELIVERED';
}
