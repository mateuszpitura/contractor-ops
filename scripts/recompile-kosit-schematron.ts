#!/usr/bin/env tsx
/**
 * Build-time only — compiles KoSIT XSLT → saxon-js SEF JSON.
 *
 * Usage:
 *   pnpm tsx scripts/recompile-kosit-schematron.ts
 *
 * Preconditions:
 *   - `xslt3` binary available on PATH (devDep of @contractor-ops/einvoice).
 *   - `packages/einvoice/src/profiles/xrechnung-de/validator-bundle/src-xslt/`
 *     populated with the two KoSIT XSLT sources (extracted from the pinned
 *     release zip — see validator-bundle/README.md).
 *
 * Post-run:
 *   - Two `.sef.json` artifacts in validator-bundle/.
 *   - `checksums.txt` updated with SHA-256 of each SEF (re-verified in CI via
 *     `sha256sum -c checksums.txt` — CI NEVER re-fetches the upstream release).
 *
 * Security (threat T-61-01-05):
 *   - No external CLI arg parsing. Sources are always read from the checked-in
 *     validator-bundle directory. `execFileSync` (not `exec`) is used so args
 *     are not shell-interpreted.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const BUNDLE = path.join(
  REPO_ROOT,
  'packages/einvoice/src/profiles/xrechnung-de/validator-bundle',
);

interface Job {
  readonly xsl: string;
  readonly out: string;
}

const JOBS: readonly Job[] = [
  { xsl: 'EN16931-CII-validation.xsl', out: 'EN16931-CII-validation.sef.json' },
  { xsl: 'XRechnung-CII-validation.xsl', out: 'XRechnung-CII-validation.sef.json' },
] as const;

function fail(message: string, exitCode = 2): never {
  process.stderr.write(`[recompile-kosit-schematron] ${message}\n`);
  process.exit(exitCode);
}

function assertXslt3Available(): void {
  try {
    execFileSync('xslt3', ['-?'], { stdio: 'ignore' });
  } catch {
    fail(
      'xslt3 is not on PATH. Run `pnpm --filter @contractor-ops/einvoice install` ' +
        'then `pnpm --filter @contractor-ops/einvoice exec which xslt3` to locate the binary.',
      2,
    );
  }
}

function sha256(filePath: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

function main(): void {
  assertXslt3Available();

  const checksumLines: string[] = [];

  for (const job of JOBS) {
    const src = path.join(BUNDLE, 'src-xslt', job.xsl);
    const dst = path.join(BUNDLE, job.out);

    if (!existsSync(src)) {
      fail(
        `Missing XSLT source: ${src}. Extract the KoSIT release zip per ` +
          `packages/einvoice/src/profiles/xrechnung-de/validator-bundle/README.md.`,
        2,
      );
    }

    execFileSync('xslt3', ['-xsl:' + src, '-export:' + dst, '-t'], {
      stdio: 'inherit',
    });

    const digest = sha256(dst);
    checksumLines.push(`${digest}  ${job.out}`);
  }

  const checksumsPath = path.join(BUNDLE, 'checksums.txt');
  writeFileSync(checksumsPath, checksumLines.join('\n') + '\n', 'utf8');
}

main();
