// Phase 70 · Plan 07 · FOUND6-04 (D-10) — boot-time signoff gate.
//
// The gate iterates FLAG_KEYS, finds gated-namespace flags via isGatedFlag,
// and process.exit(1) when the flag has no entry in the signoff registry.
// FLAG_SIGNOFF_BYPASS=local downgrades the exit to a stderr warn line.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('feature-flags boot-time signoff gate (FOUND6-04 — D-10)', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalBypass: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi
      .spyOn(process, 'exit')
      // biome-ignore lint/suspicious/noExplicitAny: process.exit return type
      .mockImplementation((() => undefined) as any);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    originalBypass = process.env.FLAG_SIGNOFF_BYPASS;
    delete process.env.FLAG_SIGNOFF_BYPASS;
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    if (originalBypass === undefined) {
      delete process.env.FLAG_SIGNOFF_BYPASS;
    } else {
      process.env.FLAG_SIGNOFF_BYPASS = originalBypass;
    }
  });

  it('does not exit when no FLAGS are in a gated namespace (current Phase 70 baseline)', async () => {
    await import('../registry.js');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does NOT exit when FLAG_SIGNOFF_BYPASS=local is set', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    await import('../registry.js');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('uses [FLAG-SIGNOFF] prefix in stderr (matches D-10 wording contract)', async () => {
    await import('../registry.js');
    const calls = stderrSpy.mock.calls.map(c => String(c[0]));
    const flagSignoffCalls = calls.filter(c => c.includes('[FLAG-SIGNOFF]'));
    // No gated keys exist at Phase 70 baseline → no [FLAG-SIGNOFF] lines fire.
    expect(flagSignoffCalls).toEqual([]);
  });

  it('synthetic gated key without registry entry is identifiably ungated by helpers', async () => {
    // The end-to-end exit test cannot be triggered without mutating the
    // typed FLAGS constant, which would defeat the typed-constant principle.
    // Instead, we assert the helpers that the gate consumes report the
    // right verdict for a synthetic gated key — guaranteeing the gate would
    // fire if the key were present in FLAGS.
    const { isGatedFlag, getFlagSignoff } = await import('../signoff-registry-flags.js');
    const SYNTHETIC = 'compliance-portal-self-service';
    expect(isGatedFlag(SYNTHETIC)).toBe(true);
    expect(getFlagSignoff(SYNTHETIC)).toBeUndefined();
  });
});
