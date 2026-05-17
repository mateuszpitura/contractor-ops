#!/usr/bin/env node
// Legal Gate — production deploy guard (LEGAL-02).
//
// Reads packages/validators/src/legal/signoff-registry.json via the registry
// helper and exits non-zero if any disclaimer key has status PENDING. Invoked
// from .github/workflows/ci.yml on pushes to main (the deploy-blocking job
// `legal-gate-production`).
//
// Previously inlined as a `node --input-type=module` heredoc in ci.yml; moved
// here so the script is syntax-checked at commit time, IDE-friendly, and can
// be run locally to preview gate state:
//
//   node scripts/check-legal-gate.mjs
//
// Exit codes:
//   0 — all disclaimers APPROVED, deploy may proceed
//   1 — one or more disclaimers PENDING, deploy blocked
//   2 — registry load error (unexpected — surfaces real bugs vs. gate fail)

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(Dirname, '..');

// Prefer the compiled dist (matches what consumers see at runtime); fall back
// to a fresh build if dist is missing (local invocation without `pnpm build`).
const distRegistry = resolve(repoRoot, 'packages/validators/dist/legal/signoff-registry.js');
const distRegistryJson = resolve(repoRoot, 'packages/validators/dist/legal/signoff-registry.json');
const srcRegistryJson = resolve(repoRoot, 'packages/validators/src/legal/signoff-registry.json');

let getAllPending;
let registry;
try {
  ({ getAllPending } = await import(distRegistry));
  const jsonPath = distRegistryJson;
  registry = (await import(jsonPath, { with: { type: 'json' } })).default;
} catch (error) {
  // Fallback: try the source JSON for the registry count, but the helper has
  // to come from dist — there is no source-only ESM entry point. If dist is
  // missing, surface a clear actionable error.
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    process.stderr.write(
      'Legal gate: packages/validators/dist not found. Run `pnpm --filter @contractor-ops/validators build` first.\n',
    );
    process.exit(2);
  }
  try {
    registry = (await import(srcRegistryJson, { with: { type: 'json' } })).default;
  } catch {
    process.stderr.write(`Legal gate: failed to load signoff registry — ${error?.message ?? error}\n`);
    process.exit(2);
  }
}

const pending = getAllPending();

if (pending.length > 0) {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║  LEGAL-02: Production deploy BLOCKED                         ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    'The following disclaimer keys have status PENDING:',
    ...pending.map((k) => `  - ${k}`),
    '',
    'To unblock: submit a PR updating signoff-registry.json to set',
    'each key to APPROVED with approvedBy + approvedAt + approverRole.',
    'The PR requires @contractor-ops/legal-platform review (CODEOWNERS).',
    '',
  ];
  process.stderr.write(`${lines.join('\n')}\n`);
  process.exit(1);
}

const total = Object.keys(registry).length;
process.stdout.write(`Legal gate: all ${total} disclaimers APPROVED ✓\n`);
