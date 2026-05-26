#!/usr/bin/env node
// Forbid unannotated raw `fetch(...)` calls in adapter / service source paths.
//
// Why:
// - Raw `fetch()` is unbounded: a slow upstream can hang a tRPC mutation or
//   QStash callback past its platform deadline. `fetchWithTimeout` (from
//   `@contractor-ops/integrations`) bounds the wall-clock and honours
//   `Retry-After` while still being a drop-in replacement.
// - Outbound calls in adapter / service paths should also flow through
//   `withResilience` so that breaker + bulkhead + retry policy apply per
//   provider — this guard nudges authors toward that pattern by failing fast
//   on raw `fetch()` introductions.
// - Intentional raw-fetch sites (best-effort heartbeats, healthchecks,
//   well-behaved public GETs) MUST carry an explicit
//   `// resilience: raw-fetch-OK reason=<why>` annotation on the line
//   directly above the call.
//
// Scanned roots:
// - packages/api/src/services/**
// - packages/integrations/src/**
//
// Allowed:
// - `fetchWithTimeout(...)`, `fetchJsonWithTimeout(...)` (already bounded).
// - Identifier-method invocations: `obj.fetch(...)`, `this.fetch(...)`,
//   `globalThis.fetch.bind(...)` (these are usually mock injections; the
//   raw-fetch ban specifically targets the globally-available `fetch`).
// - Lines inside test files (`__tests__` or `.test.ts`).
// - Lines whose previous non-blank line contains `raw-fetch-OK`.
// - Lines that are themselves comments (`//`, `*`).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(Dirname, '..');
const scanRoots = [
  resolve(repoRoot, 'packages/api/src/services'),
  resolve(repoRoot, 'packages/integrations/src'),
];

// Paths (relative to repoRoot) that may legitimately use raw fetch unannotated.
// We exclude tests entirely — they routinely mock `globalThis.fetch`.
const allowList = [/\/__tests__\//, /\.(test|spec)\.[tj]sx?$/];

function isAllowed(relPath) {
  return allowList.some(pattern => pattern.test(relPath));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
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

// Match a bare `fetch(` call that is NOT preceded by an identifier / property
// character. This lets `fetchWithTimeout(`, `obj.fetch(`, and `this.fetch(`
// pass while flagging `await fetch(`, `= fetch(`, `; fetch(`, etc.
const rawFetchRegex = /(?:^|[^A-Za-z0-9_$.])fetch\s*\(/;

const allFiles = [];
for (const root of scanRoots) {
  try {
    walk(root, allFiles);
  } catch (err) {
    // A scan root may legitimately not exist in some checkouts; continue.
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT') throw err;
  }
}

const violations = [];

for (const file of allFiles) {
  const rel = relative(repoRoot, file);
  if (isAllowed(rel)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trimStart();

    // Skip comment lines outright — comments may contain example fetch() calls.
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    if (!rawFetchRegex.test(line)) continue;
    // Allow `fetchWithTimeout(`, `fetchJsonWithTimeout(`, etc. via the
    // identifier-char rule above; an additional explicit guard for safety.
    if (/\bfetchWithTimeout\s*\(/.test(line) || /\bfetchJsonWithTimeout\s*\(/.test(line)) continue;

    // Look back through the preceding lines for a raw-fetch-OK annotation.
    // We tolerate a small window because real call sites are often nested
    // inside helpers (e.g. `await withProbeTimeout(\n  fetch(...)`), so the
    // annotation may sit a couple of lines above the actual `fetch(` token.
    let annotated = false;
    for (let back = idx - 1; back >= Math.max(0, idx - 6); back--) {
      const prev = lines[back].trim();
      if (prev === '') continue;
      if (/raw-fetch-OK/.test(prev)) {
        annotated = true;
        break;
      }
      // Stop once we hit a clearly unrelated statement (semicolon-terminated
      // line that is not a comment / parameter / opening bracket). This keeps
      // the window tight while allowing for multi-line call expressions.
      if (
        !(
          prev.startsWith('//') ||
          prev.startsWith('*') ||
          prev.startsWith('/*') ||
          prev.endsWith(',') ||
          prev.endsWith('(') ||
          prev.endsWith('{')
        )
      ) {
        break;
      }
    }
    if (annotated) continue;

    violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
  }
}

if (violations.length > 0) {
  console.error(
    'lint-raw-fetch: unannotated raw fetch() call(s) detected in adapter/service paths.',
  );
  console.error(
    'Use fetchWithTimeout (and wrap in withResilience where appropriate) — or annotate',
  );
  console.error(
    'the call with `// resilience: raw-fetch-OK reason=<why>` directly above the line.',
  );
  console.error('---');
  for (const v of violations) {
    console.error(v);
  }
  process.exit(1);
}

console.log(`OK — no unannotated raw fetch() calls in ${allFiles.length} scanned files.`);
process.exit(0);
