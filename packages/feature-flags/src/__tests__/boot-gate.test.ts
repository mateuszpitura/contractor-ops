// Phase 70-01 · FOUND6-04 — failing test scaffold for the boot-time signoff
// gate. Plan 70-07 wires the registry to call
// `assertSignoffForGatedNamespace` and `process.exit(1)` on missing entries.
// Until then this suite fails because the gate is not yet wired.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('feature-flags boot-time signoff gate (FOUND6-04)', () => {
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

  it('exits 1 when a gated namespace flag is missing from signoff registry', async () => {
    // Plan 70-07 wires this — for now the registry has no boot-time gate so
    // this fails to provoke an exit.
    await import('../registry.js');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does NOT exit when FLAG_SIGNOFF_BYPASS=local is set', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    await import('../registry.js');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
