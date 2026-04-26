// Phase 64 · D-11 — Smoke test for ClassificationEngineFlagPage (LEGAL-10).

import { describe, expect, it } from 'vitest';

describe('ClassificationEngineFlagPage (smoke)', () => {
  it('page module exports a default async function', async () => {
    // Basic structural check — full integration requires Next.js runtime
    const mod = await import('../page.js');
    expect(typeof mod.default).toBe('function');
  });

  it('page does not contain any hardcoded Unleash URLs or tokens', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../page.tsx', import.meta.url), 'utf8');
    expect(src).not.toContain('UNLEASH_URL');
    expect(src).not.toContain('UNLEASH_API_TOKEN');
  });

  it('page source references signoff-registry helpers', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../page.tsx', import.meta.url), 'utf8');
    expect(src).toContain('getRegistry');
    expect(src).toContain('getAllPending');
    expect(src).toContain('LOCKED_DISCLAIMERS');
  });

  it('page source evaluates the classification-engine flag', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(new URL('../page.tsx', import.meta.url), 'utf8');
    expect(src).toContain("evaluate('module.classification-engine'");
  });
});
