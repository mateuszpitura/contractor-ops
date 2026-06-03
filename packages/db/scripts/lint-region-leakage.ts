#!/usr/bin/env tsx

/**
 * GULF-11 / Pitfall 19 — region-leakage lint.
 *
 * The 4 Gulf models (FreeZoneAssignment, SaudizationConfig, SaudiHeadcount,
 * UaeFreeZone) live in the ME physical DB for UAE/KSA orgs. They may ONLY be
 * reached via a region-aware path:
 *   - `ctx.db.<model>`            — the tenant middleware resolves org.dataRegion
 *                                   → getRegionalClient, so ctx.db is region-aware
 *   - an explicitly-threaded client param (e.g. the regional client the cron
 *     fan-out passes into a service)
 *
 * Reading them through the DEFAULT, EU-pinned clients — `prisma.<model>` or
 * `prismaRaw.<model>` — silently serves ME data from the EU DB (information
 * disclosure / empty-result correctness bug). A pure "not on the EU schema"
 * check is WRONG (the models ARE on both schemas) — the leak is the client, not
 * the schema. So we grep API/cron source for `prisma.<model>` / `prismaRaw.<model>`
 * default-client member access and fail on any hit.
 *
 * Wired as `pnpm --filter @contractor-ops/db db:lint:region-leakage` and into the
 * root `lint:region-leakage` + `lint:ci` chain.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Repo root is two levels up from packages/db/scripts.
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

const SCAN_DIRS = [
  join(REPO_ROOT, 'packages', 'api', 'src'),
  join(REPO_ROOT, 'apps', 'cron-worker', 'src'),
];

// The 4 Gulf models, as the Prisma client delegate property names (camelCase).
const GULF_MODELS = [
  'freeZoneAssignment',
  'saudizationConfig',
  'saudiHeadcount',
  'uaeFreeZone',
] as const;

// Default, region-UNAWARE client bindings. `ctx.db`, threaded `client`/`tx`
// params, and `getRegionalClient(...)` results are region-aware and allowed.
const DEFAULT_CLIENTS = ['prisma', 'prismaRaw'] as const;

// `prisma.freeZoneAssignment` / `prismaRaw.saudiHeadcount` — a default client
// immediately followed by a Gulf model delegate. `\b` on the client guards
// against matching a longer identifier suffix (e.g. `myPrisma`).
const LEAK_RE = new RegExp(
  `\\b(?:${DEFAULT_CLIENTS.join('|')})\\s*\\.\\s*(?:${GULF_MODELS.join('|')})\\b`,
);

interface Offender {
  file: string;
  line: number;
  text: string;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Strip line + block comments so header comments naming the models do not self-trip. */
function stripComments(source: string): string[] {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  return withoutBlocks.split('\n').map(line => line.replace(/\/\/.*$/, ''));
}

function findOffenders(file: string): Offender[] {
  const lines = stripComments(readFileSync(file, 'utf8'));
  const offenders: Offender[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (LEAK_RE.test(line)) {
      offenders.push({ file, line: i + 1, text: line.trim() });
    }
  }
  return offenders;
}

function main(): void {
  const files = SCAN_DIRS.flatMap(listSourceFiles);
  const offenders = files.flatMap(findOffenders);

  if (offenders.length === 0) {
    process.stdout.write(
      `lint-region-leakage: no default-client reads of the ${GULF_MODELS.length} Gulf models ` +
        `(${GULF_MODELS.join(', ')}) in ${files.length} scanned files — all region-aware.\n`,
    );
    return;
  }

  process.stderr.write(
    `lint-region-leakage: ${offenders.length} default-client read(s) of Gulf models found ` +
      `(must use ctx.db or a threaded regional client — Pitfall 19):\n`,
  );
  for (const o of offenders) {
    const rel = relative(REPO_ROOT, o.file);
    process.stderr.write(`  ${rel}:${o.line}  ${o.text}\n`);
  }
  process.exit(1);
}

main();
