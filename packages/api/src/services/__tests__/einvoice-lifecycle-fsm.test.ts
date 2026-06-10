// packages/api/src/services/__tests__/einvoice-lifecycle-fsm.test.ts
//
// Lifecycle FSM tests.
//
// Coverage (per plan §Task 1 behavior):
//   1. Every legal validation edge returns the expected next state.
//   2. transitionTransmission('NOT_SENT','transmit_success') throws.
//   3. transitionTransmission('DELIVERED','delivery_ack') → DELIVERED (idempotent).
//   4. transitionTransmission('DELIVERED','queue') throws.
//   5. transitionTransmission('FAILED','retry') → QUEUED.
//   6. Invalid validation events throw IllegalFsmTransitionError.
//   7. Table-completeness invariant: every state × event either returns a
//      defined EInvoiceValidationStatus / EInvoiceTransmissionStatus OR
//      throws IllegalFsmTransitionError (no silent undefined / fall-through).
//   8. IllegalFsmTransitionError carries current + event on its shape.

import type {
  EInvoiceTransmissionStatus,
  EInvoiceValidationStatus,
} from '@contractor-ops/db/generated/prisma/client';
import { describe, expect, it } from 'vitest';
import type { TransmissionEvent, ValidationEvent } from '../einvoice-lifecycle-fsm';
import {
  IllegalFsmTransitionError,
  isTerminalTransmissionStatus,
  TRANSMISSION_EVENTS,
  transitionTransmission,
  transitionValidation,
  VALIDATION_EVENTS,
} from '../einvoice-lifecycle-fsm';

const ALL_VALIDATION_STATES: EInvoiceValidationStatus[] = [
  'NOT_VALIDATED',
  'VALID',
  'INVALID',
  'WARNINGS',
];

const ALL_TRANSMISSION_STATES: EInvoiceTransmissionStatus[] = [
  'NOT_SENT',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'FAILED',
];

describe('transitionValidation — legal edges', () => {
  it.each([
    ['NOT_VALIDATED', 'validate_complete_valid', 'VALID'],
    ['NOT_VALIDATED', 'validate_complete_warnings', 'WARNINGS'],
    ['NOT_VALIDATED', 'validate_complete_invalid', 'INVALID'],
    ['VALID', 'validate_complete_valid', 'VALID'],
    ['VALID', 'validate_complete_warnings', 'WARNINGS'],
    ['VALID', 'validate_complete_invalid', 'INVALID'],
    ['WARNINGS', 'validate_complete_valid', 'VALID'],
    ['WARNINGS', 'validate_complete_warnings', 'WARNINGS'],
    ['WARNINGS', 'validate_complete_invalid', 'INVALID'],
    ['INVALID', 'validate_complete_valid', 'VALID'],
    ['INVALID', 'validate_complete_warnings', 'WARNINGS'],
    ['INVALID', 'validate_complete_invalid', 'INVALID'],
  ] as [
    EInvoiceValidationStatus,
    ValidationEvent,
    EInvoiceValidationStatus,
  ][])('transitionValidation(%s, %s) → %s', (current, event, expected) => {
    expect(transitionValidation(current, event)).toBe(expected);
  });
});

describe('transitionTransmission — legal edges', () => {
  it.each([
    ['NOT_SENT', 'queue', 'QUEUED'],
    ['QUEUED', 'transmit_success', 'SENT'],
    ['QUEUED', 'delivery_failed', 'FAILED'],
    ['SENT', 'delivery_ack', 'DELIVERED'],
    ['SENT', 'delivery_failed', 'FAILED'],
    ['FAILED', 'retry', 'QUEUED'],
    // Idempotent webhook re-delivery — DELIVERED is a terminal sink.
    ['DELIVERED', 'delivery_ack', 'DELIVERED'],
  ] as [
    EInvoiceTransmissionStatus,
    TransmissionEvent,
    EInvoiceTransmissionStatus,
  ][])('transitionTransmission(%s, %s) → %s', (current, event, expected) => {
    expect(transitionTransmission(current, event)).toBe(expected);
  });
});

describe('transitionTransmission — illegal edges throw', () => {
  it('NOT_SENT → transmit_success throws (must go via QUEUED)', () => {
    expect(() => transitionTransmission('NOT_SENT', 'transmit_success')).toThrow(
      IllegalFsmTransitionError,
    );
  });

  it('DELIVERED → queue throws (terminal — must recreate lifecycle)', () => {
    expect(() => transitionTransmission('DELIVERED', 'queue')).toThrow(IllegalFsmTransitionError);
  });

  it('DELIVERED → retry throws', () => {
    expect(() => transitionTransmission('DELIVERED', 'retry')).toThrow(IllegalFsmTransitionError);
  });

  it('NOT_SENT → delivery_ack throws (no transmission to ack)', () => {
    expect(() => transitionTransmission('NOT_SENT', 'delivery_ack')).toThrow(
      IllegalFsmTransitionError,
    );
  });

  it('FAILED → retry transitions to QUEUED', () => {
    expect(transitionTransmission('FAILED', 'retry')).toBe('QUEUED');
  });
});

describe('IllegalFsmTransitionError shape', () => {
  it('carries current + event on the error and has a descriptive message', () => {
    try {
      transitionTransmission('DELIVERED', 'queue');
      // unreachable
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalFsmTransitionError);
      const e = err as IllegalFsmTransitionError;
      expect(e.current).toBe('DELIVERED');
      expect(e.event).toBe('queue');
      expect(e.message).toMatch(/DELIVERED/);
      expect(e.message).toMatch(/queue/);
    }
  });
});

describe('FSM table completeness invariant', () => {
  // For every (state × event) pair, the function must either return a
  // well-typed next state OR throw IllegalFsmTransitionError — never return
  // undefined, never throw anything else.

  it('validation — every state × event cell is either a transition or a throw', () => {
    for (const state of ALL_VALIDATION_STATES) {
      for (const event of VALIDATION_EVENTS) {
        try {
          const next = transitionValidation(state, event);
          expect(ALL_VALIDATION_STATES).toContain(next);
        } catch (err) {
          expect(err).toBeInstanceOf(IllegalFsmTransitionError);
        }
      }
    }
  });

  it('transmission — every state × event cell is either a transition or a throw', () => {
    for (const state of ALL_TRANSMISSION_STATES) {
      for (const event of TRANSMISSION_EVENTS) {
        try {
          const next = transitionTransmission(state, event);
          expect(ALL_TRANSMISSION_STATES).toContain(next);
        } catch (err) {
          expect(err).toBeInstanceOf(IllegalFsmTransitionError);
        }
      }
    }
  });
});

describe('isTerminalTransmissionStatus', () => {
  it('DELIVERED is terminal', () => {
    expect(isTerminalTransmissionStatus('DELIVERED')).toBe(true);
  });

  it('QUEUED / SENT / NOT_SENT / FAILED are not terminal', () => {
    expect(isTerminalTransmissionStatus('QUEUED')).toBe(false);
    expect(isTerminalTransmissionStatus('SENT')).toBe(false);
    expect(isTerminalTransmissionStatus('NOT_SENT')).toBe(false);
    // FAILED is retryable via `retry` so it's NOT terminal from the workflow's
    // perspective (Plan 07 UI renders a Retry button).
    expect(isTerminalTransmissionStatus('FAILED')).toBe(false);
  });
});
