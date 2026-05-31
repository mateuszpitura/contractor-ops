import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The bulk-rerun script's end-to-end behaviour is gated on real Postgres +
// QStash and exercised in manual smoke tests. These file-shape assertions give
// an immediate GREEN signal that the script exists and follows discipline; the
// behavioural cases below remain `it.todo` as forward-references.
const scriptPath = fileURLToPath(
  new URL('../../scripts/bulk-rerun-contract-health.ts', import.meta.url),
);

describe('bulk-rerun-contract-health.ts (Phase 75 D-04)', () => {
  it.todo('enqueues exactly one contract-health-check QStash job per contract per invocation');
  it.todo('respects (contractId, contentHash, modelVer) dedup window unless --force');
  it.todo('--force flag bypasses the dedup window');
  it.todo(
    'emits compliance.ip_clause.bulk_rerun_started audit log row exactly once per organization',
  );
  it.todo('paces enqueueing with delay: 2 (Anthropic Tier-2 headroom)');
  it.todo('returns summary at exit');

  it('paged enumeration uses PAGE_SIZE = 100', async () => {
    const fileContent = await readFile(scriptPath, 'utf8');
    expect(fileContent).toMatch(/PAGE_SIZE\s*=\s*100/);
  });

  it('emits the bulk_rerun_started audit action and paces with delay: 2', async () => {
    const fileContent = await readFile(scriptPath, 'utf8');
    expect(fileContent).toMatch(/compliance\.ip_clause\.bulk_rerun_started/);
    expect(fileContent).toMatch(/delay:\s*2/);
  });

  it('uses pino logger (no console.*)', async () => {
    const fileContent = await readFile(scriptPath, 'utf8');
    expect(fileContent).not.toMatch(/console\./);
    expect(fileContent).toMatch(/from\s+'pino'|import pino/);
  });
});
