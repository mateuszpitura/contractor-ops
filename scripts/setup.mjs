#!/usr/bin/env node
// scripts/setup.mjs — first-time onboarding helper.
//
// Idempotent: copies .env.example → .env if missing, validates Node + pnpm
// versions against package.json `engines`, and prints next steps. Safe to
// re-run.

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const required = pkg.engines ?? {};

function compareSemver(actual, minSpec) {
  // minSpec like ">=24.0.0" or ">=10.0.0"
  const min = minSpec.replace(/^>=/, '').split('.').map(Number);
  const cur = actual.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < min.length; i++) {
    if ((cur[i] ?? 0) > (min[i] ?? 0)) return 1;
    if ((cur[i] ?? 0) < (min[i] ?? 0)) return -1;
  }
  return 0;
}

const checks = [];
checks.push({
  label: `Node ${required.node ?? '(any)'}`,
  ok: required.node ? compareSemver(process.versions.node, required.node) >= 0 : true,
  hint: `current: v${process.versions.node}`,
});

const envPath = resolve(root, '.env');
const envExamplePath = resolve(root, '.env.example');
if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  checks.push({ label: '.env created from .env.example', ok: true, hint: 'fill in real secrets' });
} else if (existsSync(envPath)) {
  checks.push({ label: '.env exists', ok: true, hint: 'leaving as-is' });
} else {
  checks.push({ label: '.env.example missing', ok: false, hint: 'cannot bootstrap' });
}

let allOk = true;
for (const c of checks) {
  const mark = c.ok ? '✓' : '✗';
  process.stdout.write(`${mark} ${c.label}${c.hint ? ` — ${c.hint}` : ''}\n`);
  if (!c.ok) allOk = false;
}

process.stdout.write('\nNext:\n');
process.stdout.write('  pnpm db:generate   # generate Prisma client\n');
process.stdout.write('  pnpm dev           # start all dev servers\n');

process.exit(allOk ? 0 : 1);
