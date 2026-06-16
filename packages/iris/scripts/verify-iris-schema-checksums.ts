/**
 * CI supply-chain guard for the bundled IRS IRIS XSD schema package.
 *
 * The XSDs under `src/schema-bundle/` are an externally-downloaded build input
 * (from the IRS Secure Object Repository — see `source.txt`). A swapped or
 * tampered schema would silently change what `validator.ts` accepts as a valid
 * IRIS submission, so every bundled `.xsd` has its SHA-256 pinned in
 * `checksums.txt`. CI runs this guard; any mismatch, any pinned-but-missing
 * file, or any unlisted `.xsd` fails the build.
 *
 * `--write` regenerates `checksums.txt` from the files currently on disk. This
 * is run exactly once, by a human, immediately after the IRS XSDs are placed
 * (the download is a manual IRS-login step), to pin the freshly-downloaded
 * bundle. Routine CI runs WITHOUT `--write` and only verifies.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLogger } from '@contractor-ops/logger';

const logger = createLogger({ service: 'iris-schema-checksums' });

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = path.resolve(scriptDir, '..', 'src', 'schema-bundle');
const CHECKSUMS_FILE = path.join(BUNDLE_DIR, 'checksums.txt');

/** Recursively collect every `.xsd` under the bundle dir, as bundle-relative POSIX paths. */
function collectXsdFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    if (statSync(abs).isDirectory()) {
      found.push(...collectXsdFiles(abs));
    } else if (entry.toLowerCase().endsWith('.xsd')) {
      found.push(path.relative(BUNDLE_DIR, abs).split(path.sep).join('/'));
    }
  }
  return found;
}

function sha256(relPath: string): string {
  const bytes = readFileSync(path.join(BUNDLE_DIR, relPath));
  return createHash('sha256').update(bytes).digest('hex');
}

/** Parse `<sha256>  <relpath>` lines (two-space separator, mirrors einvoice checksums.txt). */
function parseChecksums(): Map<string, string> {
  const pinned = new Map<string, string>();
  let raw: string;
  try {
    raw = readFileSync(CHECKSUMS_FILE, 'utf8');
  } catch {
    return pinned;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([0-9a-f]{64})\s+(.+)$/);
    if (match) pinned.set(match[2], match[1]);
  }
  return pinned;
}

function writeMode(): void {
  const files = collectXsdFiles(BUNDLE_DIR).sort();
  if (files.length === 0) {
    logger.error(
      { bundleDir: BUNDLE_DIR },
      'No .xsd files found to pin — place the IRS IRIS XSDs first (see source.txt).',
    );
    process.exitCode = 1;
    return;
  }
  const lines = files.map(rel => `${sha256(rel)}  ${rel}`);
  writeFileSync(CHECKSUMS_FILE, `${lines.join('\n')}\n`, 'utf8');
  logger.info({ count: files.length }, 'Pinned SHA-256 for bundled IRS IRIS XSDs.');
}

function verifyMode(): void {
  const pinned = parseChecksums();
  const present = new Set(collectXsdFiles(BUNDLE_DIR));
  const problems: string[] = [];

  for (const [relPath, expected] of pinned) {
    if (!present.has(relPath)) {
      problems.push(`pinned-but-missing: ${relPath}`);
      continue;
    }
    const actual = sha256(relPath);
    if (actual !== expected) {
      problems.push(`checksum-mismatch: ${relPath} (expected ${expected}, got ${actual})`);
    }
  }

  for (const relPath of present) {
    if (!pinned.has(relPath)) {
      problems.push(`unlisted-xsd: ${relPath} (present on disk but not in checksums.txt)`);
    }
  }

  if (problems.length > 0) {
    logger.error({ problems }, 'IRS IRIS XSD bundle failed the checksum guard.');
    process.exitCode = 1;
    return;
  }

  if (pinned.size === 0) {
    logger.warn(
      { checksumsFile: CHECKSUMS_FILE },
      'checksums.txt is empty — the IRS IRIS XSDs have not been bundled yet (human-action checkpoint).',
    );
    return;
  }

  logger.info({ count: pinned.size }, 'IRS IRIS XSD bundle checksums verified.');
}

if (process.argv.includes('--write')) {
  writeMode();
} else {
  verifyMode();
}
