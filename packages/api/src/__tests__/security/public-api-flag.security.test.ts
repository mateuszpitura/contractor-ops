/**
 * Wave-0 RED contract (D-05) — per-org `module.public-api` double-dark gate.
 *
 * With `module.public-api` evaluated OFF for the caller's org, the entire public
 * surface must be invisible: a public READ and a public WRITE both throw
 * NOT_FOUND (404 hides existence). With the flag ON, the gate passes through.
 *
 * RED until 98-04 adds `require-public-api-flag`. Terminal Cannot-find-module on
 * the missing `assertPublicApiEnabled` is the accepted Wave-0 state; 98-04 turns
 * the read half GREEN and either turns the write half GREEN or HOLDs it to 98-09.
 */

import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { createLogger: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })) };
});

const evaluateMock = vi.hoisted(() => vi.fn());
vi.mock('@contractor-ops/feature-flags', () => ({ evaluate: evaluateMock }));

// RED: this middleware does not exist yet (added in 98-04).
import { assertPublicApiEnabled } from '../../middleware/require-public-api-flag';

const ORG = 'org-flag-001';

afterEach(() => vi.clearAllMocks());

describe('module.public-api per-org dark gate', () => {
  it('throws NOT_FOUND when the flag is OFF (dark, hides existence)', () => {
    evaluateMock.mockReturnValue({ enabled: false, reason: 'disabled' });
    let thrown: unknown;
    try {
      assertPublicApiEnabled(ORG, 'EU');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe('NOT_FOUND');
  });

  it('passes through when the flag is ON', () => {
    evaluateMock.mockReturnValue({ enabled: true, reason: 'enabled' });
    expect(() => assertPublicApiEnabled(ORG, 'EU')).not.toThrow();
  });
});
