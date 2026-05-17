#!/usr/bin/env node
// Forbid raw `process.env.` reads outside the env-validation allowlist.
//
// The project's typed env schema lives in @contractor-ops/validators
// (env.ts + minimal-server-env.ts). All server code should consume env via
// getServerEnv() / getServerEnvRecord() so values are validated and typed at
// a single boundary.
//
// This guardrail prevents NEW raw process.env reads from leaking into source.
// Existing call sites are tolerated by the count-based ratchet below until
// they are migrated.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(Dirname, '..');
const ratchetFile = resolve(repoRoot, 'scripts/.process-env-ratchet.json');

// Files / paths where raw process.env is allowed:
// - the validators env schema itself (defines getServerEnv)
// - the minimal-server-env test fixture
// - Next.js client code that reads NEXT_PUBLIC_* (still validated server-side)
// - scripts/, load-tests/, infra/ (not part of the runtime app surface)
// - vitest / playwright config files
// - test files (mocks/setup may need raw env)
// - generated / dist output
const allowList = [
  /^packages\/validators\/src\/env\.ts$/,
  /^packages\/validators\/src\/minimal-server-env\.ts$/,
  /^apps\/cms\/src\/lib\/env\.ts$/,
  /^scripts\//,
  /^load-tests\//,
  /^infra\//,
  /vitest\.config\.(ts|mts|js|mjs)$/,
  /playwright\.[a-z]+\.config\.ts$/,
  /\/__tests__\//,
  /\.(test|spec)\.[tj]sx?$/,
  /\/dist\//,
  /\/generated\//,
  /\/\.next\//,
  /\/node_modules\//,
];

function isAllowed(path) {
  return allowList.some(pattern => pattern.test(path));
}

const grepOutput = execSync(
  String.raw`grep -rn 'process\.env\.' --include='*.ts' --include='*.tsx' apps/ packages/ || true`,
  { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
);

const offenders = grepOutput
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const idx = line.indexOf(':');
    return { path: line.slice(0, idx), line };
  })
  .filter(({ path }) => !isAllowed(path));

const offenderCount = offenders.length;

let baseline = Number.POSITIVE_INFINITY;
if (existsSync(ratchetFile)) {
  baseline = JSON.parse(readFileSync(ratchetFile, 'utf8')).max;
}

const initialiseMode = process.argv.includes('--initialise');
if (initialiseMode || baseline === Number.POSITIVE_INFINITY) {
  writeFileSync(ratchetFile, `${JSON.stringify({ max: offenderCount }, null, 2)}\n`);
  console.log(`Initialised ratchet at ${offenderCount} raw process.env occurrences.`);
  process.exit(0);
}

if (offenderCount > baseline) {
  console.error(
    `Found ${offenderCount} raw process.env reads outside the allowlist (baseline ${baseline}).`,
  );
  console.error('New raw process.env reads were added. Use getServerEnv() instead.');
  console.error('Allowlist: see scripts/check-no-process-env.mjs');
  console.error('---');
  for (const { line } of offenders.slice(0, 20)) {
    console.error(line);
  }
  if (offenders.length > 20) {
    console.error(`... and ${offenders.length - 20} more`);
  }
  process.exit(1);
}

if (offenderCount < baseline) {
  writeFileSync(ratchetFile, `${JSON.stringify({ max: offenderCount }, null, 2)}\n`);
  console.log(
    `Ratchet tightened: ${baseline} → ${offenderCount} raw process.env occurrences. Committed file updated.`,
  );
  process.exit(0);
}

console.log(`OK — ${offenderCount} raw process.env occurrences (baseline ${baseline}).`);
