#!/usr/bin/env node
// CI gate — presentational TSX stays free of tRPC / React Query runtime.
// Scans apps/web-vite/src/components (all .tsx recursively, excluding
// *-container.tsx, hooks/, feature-flag-context.tsx, feature.tsx).
// See apps/web-vite/ARCHITECTURE.md.

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'tinyglobby';

const COMPONENTS_ROOT = fileURLToPath(new URL('../apps/web-vite/src/components', import.meta.url));

/** @typedef {{ rel: string; line: number; message: string }} Hit */

/** @param {string} rel */
function shouldScan(rel) {
  if (rel.endsWith('-container.tsx')) return false;
  if (rel.includes('/hooks/')) return false;
  const base = rel.split('/').pop() ?? '';
  if (base === 'feature-flag-context.tsx' || base === 'feature.tsx') return false;
  return true;
}

/**
 * @param {string} inner
 * @returns {string[]}
 */
function splitTopLevelCommaParts(inner) {
  const parts = [];
  let depth = 0;
  let chunk = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if ((c === '<' || c === '{' || c === '(') && inner[i + 1] !== undefined) {
      depth++;
    } else if ((c === '>' || c === '}' || c === ')') && depth > 0) {
      depth--;
    } else if (c === ',' && depth === 0) {
      parts.push(chunk.trim());
      chunk = '';
      continue;
    }
    chunk += c;
  }
  if (chunk.trim().length > 0) parts.push(chunk.trim());
  return parts.filter(Boolean);
}

const FORBIDDEN_RQ_HOOKS = new Set([
  'useQuery',
  'useMutation',
  'useSuspenseQuery',
  'useQueryClient',
]);

/** @param {string} braceInner */
function namedImportHasForbiddenReactQueryHook(braceInner) {
  for (const part of splitTopLevelCommaParts(braceInner)) {
    const s = part.trim();
    if (s.startsWith('type ')) continue;
    const name = s.split(/\s+as\s+/)[0].trim();
    if (FORBIDDEN_RQ_HOOKS.has(name)) return true;
  }
  return false;
}

/** @param {string} braceInner */
function namedImportHasUseTrpc(braceInner) {
  for (const part of splitTopLevelCommaParts(braceInner)) {
    const s = part.trim();
    if (s.startsWith('type ')) continue;
    const name = s.split(/\s+as\s+/)[0].trim();
    if (name === 'useTRPC') return true;
  }
  return false;
}

/** @param {string} line */
function stripLineComment(line) {
  const idx = line.indexOf('//');
  if (idx === -1) return line;
  return line.slice(0, idx);
}

/** @param {string} line */
function isCommentOnlyLine(line) {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

/** @param {string} line */
function hasForbiddenReactQueryImport(line) {
  const work = stripLineComment(line);
  if (!work.includes('@tanstack/react-query')) return false;
  const t = work.trim();
  if (/^import\s+type\b/.test(t)) return false;
  const named = t.match(/^import\s*\{([^}]*)\}\s*from\s*['"]@tanstack\/react-query['"]/);
  if (named) return namedImportHasForbiddenReactQueryHook(named[1]);
  if (/^import\s+\w+\s+from\s*['"]@tanstack\/react-query['"]/.test(t)) return true;
  return false;
}

/** @param {string} line */
function hasForbiddenTrpcProviderImport(line) {
  const work = stripLineComment(line);
  if (!work.includes('trpc-provider')) return false;
  const t = work.trim();
  if (/^import\s+type\b/.test(t)) return false;
  const named = t.match(/^import\s*\{([^}]*)\}\s*from\s*['"][^'"]*trpc-provider[^'"]*['"]/);
  if (named) return namedImportHasUseTrpc(named[1]);
  if (/^import\s+useTRPC\s+from\s*['"][^'"]*trpc-provider[^'"]*['"]/.test(t)) return true;
  return false;
}

const FORBIDDEN_CALLS = [
  { id: 'useTRPC', pattern: /\buseTRPC\s*\(/, label: 'useTRPC()' },
  { id: 'useQuery', pattern: /\buseQuery\s*\(/, label: 'useQuery()' },
  { id: 'useMutation', pattern: /\buseMutation\s*\(/, label: 'useMutation()' },
  { id: 'useSuspenseQuery', pattern: /\buseSuspenseQuery\s*\(/, label: 'useSuspenseQuery()' },
  { id: 'useQueryClient', pattern: /\buseQueryClient\s*\(/, label: 'useQueryClient()' },
];

const files = globSync('**/*.tsx', {
  cwd: COMPONENTS_ROOT,
  absolute: true,
  posix: true,
});

/** @type {Hit[]} */
const hits = [];

for (const absPath of files) {
  const rel = relative(COMPONENTS_ROOT, absPath).replaceAll('\\', '/');
  if (!shouldScan(rel)) continue;

  const text = readFileSync(absPath, 'utf8');
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (isCommentOnlyLine(raw)) continue;
    const line = stripLineComment(raw);

    if (hasForbiddenReactQueryImport(line)) {
      hits.push({
        rel,
        line: i + 1,
        message: 'runtime import from @tanstack/react-query (use import type or move to hooks/)',
      });
      continue;
    }
    if (hasForbiddenTrpcProviderImport(line)) {
      hits.push({
        rel,
        line: i + 1,
        message: 'runtime import of useTRPC from trpc-provider (move to hooks/)',
      });
      continue;
    }

    for (const rule of FORBIDDEN_CALLS) {
      if (rule.pattern.test(line)) {
        hits.push({
          rel,
          line: i + 1,
          message: `${rule.label} — move data layer to components/{domain}/hooks/`,
        });
        break;
      }
    }
  }
}

if (hits.length > 0) {
  console.error(`check:web-vite-presentational — ${hits.length} violation(s):`);
  for (const h of hits) {
    console.error(`  ${h.rel}:${h.line}  ${h.message}`);
  }
  console.error('\nPresentational components must not call tRPC or React Query at runtime.');
  console.error('See apps/web-vite/ARCHITECTURE.md');
  process.exit(1);
}

console.log('check:web-vite-presentational — OK');
