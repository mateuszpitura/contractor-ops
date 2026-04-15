#!/usr/bin/env tsx
// Phase 62 · Plan 62-03 Task 5 — CLI that generates ZUGFeRD fixture PDFs.
//
// Called by the veraPDF CI workflow (Plan 03 Task 6) before running
// `verapdf/cli:1.26` — the CI writes PDFs to a temp dir, then runs
// veraPDF against the recurse tree. Also usable locally for quick
// fixture inspection.
//
// Usage:
//   pnpm --filter @contractor-ops/einvoice exec tsx scripts/generate-zugferd-fixtures.ts --out-dir /tmp/zfp
//   pnpm --filter @contractor-ops/einvoice exec tsx scripts/generate-zugferd-fixtures.ts --check
//
// Flags:
//   --out-dir <path>  Where to write PDFs. Default: ./tmp/zugferd-fixtures.
//   --check           Re-generate PDFs in-memory and compare sha256 to
//                     __fixtures__/expected-sha256.txt. Exits non-zero
//                     on mismatch. Used for drift detection.
//
// Determinism: `producedAt` is always `2026-01-15T10:00:00Z` for the
// fixture run — otherwise wall-clock would force the sha to move on
// every CI run. Field values + /ID are derived from fixture JSON.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EInvoice } from '../src/types/invoice.js';
import { generateZugferdPdf } from '../src/profiles/zugferd-de/generator.js';

const FIXTURES = [
  'comfort-minimal',
  'reverse-charge-leitweg',
  'kleinunternehmer',
] as const;

const FIXTURE_DIR = fileURLToPath(
  new URL('../src/profiles/zugferd-de/__fixtures__/', import.meta.url),
);

const FIXED_PRODUCED_AT = new Date('2026-01-15T10:00:00Z');

async function loadFixture(name: (typeof FIXTURES)[number]): Promise<EInvoice> {
  const raw = await fs.readFile(path.join(FIXTURE_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as EInvoice;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv: string[]): { outDir: string; check: boolean } {
  let outDir = './tmp/zugferd-fixtures';
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out-dir') {
      outDir = argv[++i] ?? outDir;
    } else if (arg === '--check') {
      check = true;
    }
  }
  return { outDir, check };
}

async function main(): Promise<void> {
  const { outDir, check } = parseArgs(process.argv.slice(2));

  if (!check) {
    await fs.mkdir(outDir, { recursive: true });
  }

  const digests: Record<string, string> = {};

  for (const name of FIXTURES) {
    const invoice = await loadFixture(name);
    const leitwegId =
      (invoice.extensions as Record<string, unknown> | undefined)
        ?.supplierLeitwegId ?? null;
    const pdf = await generateZugferdPdf({
      invoice,
      conformanceLevel: 'COMFORT',
      producedAt: FIXED_PRODUCED_AT,
      leitwegId: typeof leitwegId === 'string' ? leitwegId : null,
    });
    digests[name] = sha256(pdf);

    if (!check) {
      const outPath = path.join(outDir, `${name}.pdf`);
      await fs.writeFile(outPath, pdf);
      process.stdout.write(
        `wrote ${outPath} (${pdf.length} bytes, sha256=${digests[name].slice(0, 12)}…)\n`,
      );
    }
  }

  if (check) {
    const manifestPath = path.join(FIXTURE_DIR, 'expected-sha256.txt');
    let manifest: string;
    try {
      manifest = await fs.readFile(manifestPath, 'utf-8');
    } catch {
      process.stderr.write(
        `No manifest at ${manifestPath} — run once without --check to create one (or pin manually).\n`,
      );
      for (const name of FIXTURES) {
        process.stderr.write(`${digests[name]}  ${name}.pdf\n`);
      }
      process.exit(1);
    }
    let ok = true;
    for (const name of FIXTURES) {
      const line = manifest
        .split('\n')
        .find(l => l.trim().endsWith(`${name}.pdf`));
      if (!line) {
        process.stderr.write(`missing ${name}.pdf in manifest\n`);
        ok = false;
        continue;
      }
      const [expected] = line.trim().split(/\s+/);
      if (expected !== digests[name]) {
        process.stderr.write(
          `DRIFT ${name}.pdf: expected ${expected}, got ${digests[name]}\n`,
        );
        ok = false;
      }
    }
    if (!ok) process.exit(1);
    process.stdout.write('all fixtures match expected sha256 manifest\n');
  }
}

main().catch(err => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
