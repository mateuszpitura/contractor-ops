#!/usr/bin/env node
/**
 * CI gate — fails if migration-provenance breadcrumbs reappear in source comments.
 *
 * The apps/web → apps/web-vite port left behind comments documenting the
 * migration (deleted-tree paths, codemod-port notes, Phase·Plan tags). Those
 * were stripped repo-wide; this guard keeps them out.
 *
 * Only COMMENT lines are inspected. Load-bearing `(D-NN)` decision anchors and
 * `vi.mock('next-intl')` test mocks are explicitly allowed — they look adjacent
 * to provenance but document behavior, not the port.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;
// Scope mirrors the breadcrumb strip: the `src` tree of every app and package
// (not e2e/, scripts/, fixtures/ — those are out of the cleaned surface).
const WORKSPACE_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'generated', '__generated__', '.turbo', '.next', 'coverage']);

function srcDirs() {
  const dirs = [];
  for (const root of WORKSPACE_ROOTS) {
    const base = join(REPO, root);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = join(base, entry.name, 'src');
      if (existsSync(src)) dirs.push(src);
    }
  }
  return dirs;
}

// Only patterns that are UNAMBIGUOUSLY port provenance. `Plan N-N` is
// deliberately excluded — it is a living architectural cross-reference
// convention (e.g. "Slot for Plan 73-08 to cross-mount…"), not a breadcrumb.
const PROVENANCE = [
  { label: 'apps/web path ref', re: /apps\/web\// },
  { label: 'codemod port note', re: /Step \d+ codemod|codemod port/ },
  { label: 'Lifted/Ported note', re: /Lifted from apps\/web|Ported from legacy/ },
];

// Lines that match a provenance pattern but must NOT be flagged.
const ALLOW = [/\(D-\d+\)/, /vi\.mock\(\s*['"]next-intl/];

function isCommentLine(line) {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  // trailing line comment after code
  const slash = line.indexOf('//');
  return slash !== -1;
}

function* sourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* sourceFiles(join(dir, entry.name));
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

const hits = [];
for (const top of srcDirs()) {
  for (const file of sourceFiles(top)) {
    if (file.includes('/generated/')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!isCommentLine(line)) continue;
      if (ALLOW.some((re) => re.test(line))) continue;
      const match = PROVENANCE.find((p) => p.re.test(line));
      if (match) hits.push({ file: file.replace(REPO, ''), line: i + 1, label: match.label, text: line.trim() });
    }
  }
}

if (hits.length > 0) {
  console.error('lint:no-breadcrumbs — migration-provenance comments found:');
  for (const h of hits) console.error(`  ${h.file}:${h.line} [${h.label}] ${h.text}`);
  console.error(`\n${hits.length} breadcrumb comment(s). Remove provenance; keep behavioral/(D-NN)/security notes.`);
  process.exit(1);
}

console.log('lint:no-breadcrumbs — OK (no migration-provenance comments in apps/*/src or packages/*/src)');
