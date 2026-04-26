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
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const BUNDLE = path.join(REPO_ROOT, 'packages/einvoice/src/profiles/xrechnung-de/validator-bundle');

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

function assertCheckCommand(): void {
  // Mode: assert existing artefacts match checked-in checksums.txt.
  // This is the CI path — NEVER re-fetch from upstream, NEVER re-compile.
  const checksumsPath = path.join(BUNDLE, 'checksums.txt');
  if (!existsSync(checksumsPath)) {
    fail(
      `Missing checksums.txt at ${checksumsPath}. Run this script without --check to generate it after a fresh KoSIT release pin.`,
      2,
    );
  }
  const raw = readFileSync(checksumsPath, 'utf8').trim();
  if (!raw) fail(`Empty checksums.txt — bundle is not pinned. Aborting.`, 2);

  const lines = raw.split('\n').filter(Boolean);
  const failures: string[] = [];
  for (const line of lines) {
    const match = /^([0-9a-f]{64})\s{2}(.+)$/.exec(line);
    if (!match) {
      failures.push(`Malformed checksum line: ${line}`);
      continue;
    }
    const [, expected, relPath] = match;
    const absPath = path.join(BUNDLE, relPath);
    if (!existsSync(absPath)) {
      failures.push(`Missing artefact: ${relPath}`);
      continue;
    }
    const actual = sha256(absPath);
    if (actual !== expected) {
      failures.push(
        `Checksum mismatch: ${relPath}\n    expected ${expected}\n    actual   ${actual}`,
      );
    }
  }

  if (failures.length > 0) {
    fail(
      `Validator-bundle integrity check FAILED (${failures.length} issue(s)):\n` +
        failures.map(f => `  - ${f}`).join('\n') +
        '\n\nThis usually means the KoSIT validator-bundle was modified locally. ' +
        'CI MUST abort here — do NOT re-fetch from upstream. Re-pin via the recompile ' +
        'script from a trusted workstation instead.',
      1,
    );
  }

  process.stdout.write(
    `[recompile-kosit-schematron] ✓ ${lines.length} artefact(s) verified against checksums.txt\n`,
  );
}

function walkXsdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkXsdFiles(next));
    else if (entry.isFile() && entry.name.endsWith('.xsd')) out.push(next);
  }
  return out;
}

function compileAndWriteChecksums(): void {
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

  // Include CII D16B XSDs in the checksum manifest so the layer-1 schema is
  // pinned end-to-end (Plan 61-03 invariant).
  const xsdDir = path.join(BUNDLE, 'CII-D16B-schema');
  if (existsSync(xsdDir)) {
    for (const xsdPath of walkXsdFiles(xsdDir)) {
      const rel = path.relative(BUNDLE, xsdPath);
      checksumLines.push(`${sha256(xsdPath)}  ${rel}`);
    }
  }

  const checksumsPath = path.join(BUNDLE, 'checksums.txt');
  writeFileSync(checksumsPath, checksumLines.join('\n') + '\n', 'utf8');
  process.stdout.write(
    `[recompile-kosit-schematron] Wrote ${checksumLines.length} checksum line(s) to ${checksumsPath}\n`,
  );
}

function main(): void {
  const mode = process.argv.includes('--check') ? 'check' : 'compile';
  if (mode === 'check') assertCheckCommand();
  else compileAndWriteChecksums();
}

main();
