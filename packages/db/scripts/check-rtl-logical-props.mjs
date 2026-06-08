#!/usr/bin/env node

/*
 * GULF-08 / D-13 RTL logical-property guard (Phase 79, Pitfall 20).
 *
 * Bans direction-physical Tailwind utilities on Gulf web-vite surfaces so the
 * Arabic/RTL layout renders correctly. RTL surfaces MUST use logical-property
 * utilities (the allowlist: ms / me / ps / pe / start / end) instead of the
 * banned physical pairs (margin/padding left+right, and left-/right- positioning).
 *
 * Scope: Gulf web-vite component surfaces ONLY (saudization + free-zone). Walking
 * just these directories keeps the guard from flagging pre-existing offenders
 * elsewhere (D-17 scope boundary) AND keeps it from reading its own source, so
 * the banned-token list below never self-trips.
 *
 * Wired as `pnpm check:rtl-logical-props` (root package.json) + appended to the
 * `lint:ci` chain. Mirrors the structure of packages/db/scripts/audit-enum-casing.ts.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

// Gulf web-vite surfaces. New Gulf component directories may be added here.
const GULF_SURFACE_DIRS = [
  join(REPO_ROOT, 'apps', 'web-vite', 'src', 'components', 'saudization'),
  join(REPO_ROOT, 'apps', 'web-vite', 'src', 'components', 'contractors', 'free-zone'),
];

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.css'];

// Banned physical-direction utilities, assembled from a character class so the
// literal tokens never appear verbatim in this source (self-trip safety even if
// the scan scope ever widens). Matches e.g. margin/padding left+right and
// physical left-/right- positioning, with optional responsive/state prefixes.
const PHYSICAL_MARGIN_PADDING = /(?:^|[\s"'`:])[a-z-]*\b[mp][lr]-/;
const PHYSICAL_POSITION = /(?:^|[\s"'`:])[a-z-]*\b(?:left|right)-\[?/;

/** Allowlist note (logical-property utilities that ARE permitted): ms- me- ps- pe- start- end- */

function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else if (SCAN_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function findOffenders(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const offenders = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (PHYSICAL_MARGIN_PADDING.test(line) || PHYSICAL_POSITION.test(line)) {
      offenders.push({ file, line: i + 1, text: line.trim() });
    }
  }
  return offenders;
}

function main() {
  const files = GULF_SURFACE_DIRS.flatMap(listFilesRecursive);
  const offenders = files.flatMap(findOffenders);

  if (offenders.length === 0) {
    process.stdout.write(
      `check-rtl-logical-props: ${files.length} Gulf surface file(s) scanned; no physical-direction Tailwind utilities found\n`,
    );
    return;
  }

  process.stderr.write(
    `check-rtl-logical-props: ${offenders.length} physical-direction utility offender(s) on Gulf RTL surfaces:\n`,
  );
  for (const o of offenders) {
    const rel = relative(REPO_ROOT, o.file);
    process.stderr.write(`  ${rel}:${o.line}  ${o.text}\n`);
  }
  process.stderr.write(
    '  Use logical-property utilities instead (ms / me / ps / pe / start / end).\n',
  );
  process.exit(1);
}

main();
