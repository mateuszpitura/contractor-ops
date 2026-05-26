#!/usr/bin/env node
// Forbid hand-rolled idempotency keys outside the canonical helper.
//
// Why:
// - `deriveIdempotencyKey({ orgId, operation, businessKey })` in
//   `packages/integrations/src/services/idempotency.ts` is the single
//   source of truth for the wire format of every external-provider
//   Idempotency-Key in this monorepo (DRIFT-01). A second hand-rolled
//   `createHash('sha256')`-as-key invention re-opens the drift this
//   helper was added to close — two code paths producing different keys
//   for the same logical retry means the provider stops deduping.
// - This guard flags any `createHash('sha256')` usage that lives near
//   the substring `idempotency` (within ~10 lines of context), which is
//   a strong signal the hash is being composed AS an idempotency key.
//   Unrelated SHA-256 usage (HMAC verification, fingerprinting, ETags,
//   ...) is left alone.
//
// Scanned roots:
// - packages/api/src/**
// - packages/integrations/src/**
// - apps/*/src/**
//
// Allowed:
// - `packages/integrations/src/services/idempotency.ts` — the canonical
//   implementation itself.
// - Test files (`__tests__/`, `*.test.*`, `*.spec.*`) — tests routinely
//   recompute reference digests for assertions.
//
// Exit codes:
// - 0 on clean scan
// - 1 with `file:line: <reason>` lines on violations
//
// Companion guards:
// - `scripts/lint-raw-fetch.mjs` (B.3.d) — unannotated raw `fetch()`.
// - `scripts/lint-audit-log.mjs` (B.2.c) — `auditLog.create` outside the
//   `writeAuditLog` helper.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(Dirname, '..');

const scanRoots = [
  resolve(repoRoot, 'packages/api/src'),
  resolve(repoRoot, 'packages/integrations/src'),
  resolve(repoRoot, 'apps'),
];

// Paths (relative to repoRoot) that are allowed to compose
// idempotency keys directly. Currently only the canonical helper itself.
const allowedFiles = new Set(['packages/integrations/src/services/idempotency.ts']);

// Path patterns that bypass the lint entirely (tests).
const allowPatterns = [/\/__tests__\//, /\.(test|spec)\.[tj]sx?$/];

function isPathAllowed(relPath) {
  if (allowedFiles.has(relPath)) return true;
  return allowPatterns.some(pattern => pattern.test(relPath));
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// `createHash('sha256')` with either single or double quotes, tolerant of
// whitespace and chained calls (`.update(...).digest(...)`).
const sha256Regex = /createHash\(\s*['"]sha256['"]\s*\)/;

// How many lines after the `createHash` line we consider as "near" for the
// idempotency-context heuristic. Hash composition statements typically span
// 3–6 lines (chain of `.update()` / `.digest()` calls); 10 leaves headroom
// for the assignment + a short surrounding doc-comment.
const NEAR_LINES = 10;

const allFiles = [];
for (const root of scanRoots) {
  walk(root, allFiles);
}

const violations = [];

for (const file of allFiles) {
  const rel = relative(repoRoot, file);
  if (isPathAllowed(rel)) continue;

  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trimStart();

    // Skip comment-only lines (so `// example: createHash('sha256') ...` is
    // not flagged when it appears in an explanatory doc-comment).
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    if (!sha256Regex.test(line)) continue;

    // The hash is being applied directly to a pre-existing `idempotencyKey`
    // variable (e.g. `createHash('sha256').update(idempotencyKey)`). This is
    // a provider-format adapter (Google Calendar base32hex event id, MS Graph
    // client-request-id UUID), NOT a new key invention — allowed.
    if (/\.update\(\s*idempotencyKey\s*\)/.test(line)) continue;

    // Look at a window of NEAR_LINES lines BEFORE and AFTER for three signals:
    // (a) `idempotency` substring (case-insensitive) — the SHA looks like
    //     it is being composed AS / FOR an idempotency key (catches both
    //     "the doc-comment above explains this is an idempotency key" and
    //     "the variable it is assigned to is named idempotencyKey").
    // (b) `deriveIdempotencyKey(` — the SHA is being fed INTO the
    //     canonical helper as a `businessKey` (content-digest pattern),
    //     which is the documented use case in `idempotency.ts` and is
    //     therefore allowed.
    // (c) `lint-idempotency-OK` annotation in the same window — explicit
    //     escape hatch for legitimate non-key SHA usage that happens to
    //     live near the word "idempotency".
    //
    // Flag only when (a) holds and neither (b) nor (c) does.
    const start = Math.max(0, idx - NEAR_LINES);
    const end = Math.min(lines.length, idx + 1 + NEAR_LINES);
    let nearIdempotency = false;
    let nearHelperCall = false;
    let annotated = false;
    for (let j = start; j < end; j++) {
      const ln = lines[j];
      if (/idempotency/i.test(ln)) nearIdempotency = true;
      if (/\bderiveIdempotencyKey\s*\(/.test(ln)) nearHelperCall = true;
      if (/lint-idempotency-OK/.test(ln)) annotated = true;
    }
    if (!nearIdempotency) continue;
    if (nearHelperCall) continue;
    if (annotated) continue;

    violations.push(
      `${rel}:${idx + 1}: createHash('sha256') used near "idempotency" — derive keys through deriveIdempotencyKey() in @contractor-ops/integrations (pass content digest as businessKey), or annotate with "lint-idempotency-OK reason=<why>".`,
    );
  }
}

if (violations.length > 0) {
  console.error(
    'lint-idempotency: hand-rolled idempotency-key composition detected outside the canonical helper.',
  );
  console.error(
    'Use `deriveIdempotencyKey({ orgId, operation, businessKey })` from `@contractor-ops/integrations`',
  );
  console.error(
    '(see `packages/integrations/src/services/idempotency.ts`). Tests and the helper itself are exempt.',
  );
  console.error('---');
  for (const v of violations) {
    console.error(v);
  }
  process.exit(1);
}

console.log(`OK — no hand-rolled idempotency keys in ${allFiles.length} scanned files.`);
process.exit(0);
