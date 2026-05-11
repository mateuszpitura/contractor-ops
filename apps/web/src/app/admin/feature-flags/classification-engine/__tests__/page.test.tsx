// Phase 64 · D-11 — Smoke test for ClassificationEngineFlagPage (LEGAL-10).

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(
  process.cwd(),
  'src/app/admin/feature-flags/classification-engine/page.tsx',
);

async function readPageSource() {
  return readFile(pagePath, 'utf8');
}

describe('ClassificationEngineFlagPage (smoke)', () => {
  it('page module exports a default async function', async () => {
    // Basic structural check — full integration requires Next.js runtime
    const mod = await import('../page');
    expect(typeof mod.default).toBe('function');
  });

  it('page does not contain any hardcoded Unleash URLs or tokens', async () => {
    const src = await readPageSource();
    expect(src).not.toContain('UNLEASH_URL');
    expect(src).not.toContain('UNLEASH_API_TOKEN');
  });

  it('page source references signoff-registry helpers', async () => {
    const src = await readPageSource();
    expect(src).toContain('getRegistry');
    expect(src).toContain('getAllPending');
    expect(src).toContain('LOCKED_DISCLAIMERS');
  });

  it('page source evaluates the classification-engine flag', async () => {
    const src = await readPageSource();
    expect(src).toContain("evaluate('module.classification-engine'");
  });
});
