import { describe, expect, it } from 'vitest';

import { hrisSyncRouter } from '../hris-sync-router';

// Behavioral connect/XOR/audit/flag-gate coverage runs against the mounted
// appRouter (root-router-gating + the integration-router caller harness) once
// hrisSync is spread into conditionalWorkforceRouters. This suite pins the
// router's public procedure surface so the shape can't drift.

describe('hrisSyncRouter surface', () => {
  it('exposes the connect / disconnect / syncNow / mapping procedures', () => {
    const procedures = Object.keys(
      (hrisSyncRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def
        .procedures,
    );
    for (const name of [
      'getStatus',
      'connect',
      'disconnect',
      'syncNow',
      'getMapping',
      'setMapping',
    ]) {
      expect(procedures).toContain(name);
    }
  });
});
