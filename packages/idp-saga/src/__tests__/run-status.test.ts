import { describe, expect, it } from 'vitest';
import { deriveRunStatus } from '../run-status';

describe('deriveRunStatus (Phase 76 D-02)', () => {
  it('all SUCCEEDED → COMPLETED', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'SUCCEEDED', attempts: 1 },
      ]),
    ).toBe('COMPLETED');
  });
  it('all FAILED at MAX_ATTEMPTS → FAILED', () => {
    expect(
      deriveRunStatus([
        { status: 'FAILED', attempts: 3 },
        { status: 'FAILED', attempts: 3 },
      ]),
    ).toBe('FAILED');
  });
  it('mix of SUCCEEDED + FAILED-at-max → PARTIAL_FAILURE', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'FAILED', attempts: 3 },
      ]),
    ).toBe('PARTIAL_FAILURE');
  });
  it('any IN_PROGRESS → IN_PROGRESS', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'IN_PROGRESS', attempts: 0 },
      ]),
    ).toBe('IN_PROGRESS');
  });
  it('FAILED below MAX_ATTEMPTS → IN_PROGRESS (still retrying)', () => {
    expect(
      deriveRunStatus([
        { status: 'SUCCEEDED', attempts: 1 },
        { status: 'FAILED', attempts: 1 },
      ]),
    ).toBe('IN_PROGRESS');
  });
  it('empty steps → PENDING', () => {
    expect(deriveRunStatus([])).toBe('PENDING');
  });
});
