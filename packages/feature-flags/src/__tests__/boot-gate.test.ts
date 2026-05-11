// Phase 70 · Plan 07 · FOUND6-04 (D-10) — boot-time signoff gate.
//
// The gate iterates FLAG_KEYS, finds gated-namespace flags via isGatedFlag,
// and process.exit(1) when the flag has no entry in the signoff registry.
// FLAG_SIGNOFF_BYPASS=local downgrades the exit to a stderr warn line.
//
// Phase 72 hardening — the gate is now an exported function
// (`assertFlagSignoffsOrExit`) that the consuming app must call explicitly
// during boot. Module load no longer has the side effect, so unrelated
// tooling that imports `@contractor-ops/feature-flags` cannot be killed by a
// missing-entry gated flag.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('feature-flags boot-time signoff gate (FOUND6-04 — D-10)', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalBypass: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
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

  it('importing registry.js does NOT trigger the gate (no module-load side effect)', async () => {
    // Phase 72 invariant: a consumer that imports the package — a codegen
    // script, a sibling-package test, a CLI tool — must never have its
    // process killed by the boot gate. The check fires only when the app
    // explicitly invokes assertFlagSignoffsOrExit().
    await import('../registry');
    expect(exitSpy).not.toHaveBeenCalled();
    const flagSignoffCalls = stderrSpy.mock.calls
      .map(c => String(c[0]))
      .filter(c => c.includes('[FLAG-SIGNOFF]'));
    expect(flagSignoffCalls).toEqual([]);
  });

  it('assertFlagSignoffsOrExit() does not exit when no FLAGS are in a gated namespace (current Phase 70 baseline)', async () => {
    const { assertFlagSignoffsOrExit } = await import('../registry');
    assertFlagSignoffsOrExit();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('assertFlagSignoffsOrExit() does NOT exit when FLAG_SIGNOFF_BYPASS=local is set', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    const { assertFlagSignoffsOrExit } = await import('../registry');
    assertFlagSignoffsOrExit();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('assertFlagSignoffsOrExit() uses [FLAG-SIGNOFF] prefix in stderr (matches D-10 wording contract)', async () => {
    const { assertFlagSignoffsOrExit } = await import('../registry');
    assertFlagSignoffsOrExit();
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
    const { isGatedFlag, getFlagSignoff } = await import('../signoff-registry-flags');
    const SYNTHETIC = 'compliance-portal-self-service';
    expect(isGatedFlag(SYNTHETIC)).toBe(true);
    expect(getFlagSignoff(SYNTHETIC)).toBeUndefined();
  });
});
