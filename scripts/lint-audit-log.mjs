#!/usr/bin/env node
// Forbid direct `auditLog.create` / `auditLog.createMany` Prisma calls outside
// the shared `writeAuditLog` / `writeAuditLogMany` helper.
//
// Why:
// - The helper (packages/api/src/services/audit-writer.ts) centralises the
//   before/after JSON discipline, validates required keys, attaches actor +
//   request context, and is the single supported write path for AuditLog.
// - Direct `prisma.auditLog.create(...)` calls bypass those invariants and
//   silently diverge over time, defeating the audit trail's value.
// - This guard scans packages/api/src/ and fails fast when any file other
//   than the helper itself reaches into the Prisma client directly.
//
// Allowed locations:
// - packages/api/src/services/audit-writer.ts (the helper implementation).
//
// Test mocks under packages/api/src/routers/__tests__/** historically assert
// on `mockPrisma.auditLog.create`. Those are intentional spies on the helper's
// downstream call, not direct writes — they are excluded via the test path
// allowlist below.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(Dirname, '..');
const scanRoot = resolve(repoRoot, 'packages/api/src');

// Paths (relative to repoRoot) that may legitimately call auditLog.create*.
const allowList = [
  /^packages\/api\/src\/services\/audit-writer\.ts$/,
  // Test files spy on the underlying prisma mock; not a real write path.
  /\/__tests__\//,
  /\.(test|spec)\.[tj]sx?$/,
];

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

// Match `auditLog.create` and `auditLog.createMany` as a property access.
// Word boundary at the end stops at `create` or `createMany`.
const violationRegex = /\bauditLog\.(create|createMany)\b/;

const files = walk(scanRoot);
const violations = [];

for (const file of files) {
  const rel = relative(repoRoot, file);
  if (isAllowed(rel)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    // Skip single-line comments and lines that are clearly comment continuations.
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (violationRegex.test(line)) {
      violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error(
    'lint-audit-log: forbidden direct auditLog.create / auditLog.createMany call(s) detected.',
  );
  console.error('Use writeAuditLog / writeAuditLogMany from services/audit-writer.ts instead.');
  console.error('---');
  for (const v of violations) {
    console.error(v);
  }
  process.exit(1);
}

console.log(`OK — no direct auditLog.create calls in ${files.length} scanned files.`);
process.exit(0);
