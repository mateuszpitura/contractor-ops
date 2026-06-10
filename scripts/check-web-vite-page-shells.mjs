#!/usr/bin/env node
/**
 * CI gate — pages must not be a direct tRPC/React Query boundary.
 * Orchestration (i18n, params, flags, component imports) is allowed in *PageContent.
 * See apps/web-vite/ARCHITECTURE.md
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src/pages', import.meta.url).pathname;

const FORBIDDEN_CALLS = [
  { pattern: /\buseTRPC\s*\(/, label: 'useTRPC()' },
  { pattern: /\buseQuery\s*\(/, label: 'useQuery()' },
  { pattern: /\buseMutation\s*\(/, label: 'useMutation()' },
  { pattern: /\buseInfiniteQuery\s*\(/, label: 'useInfiniteQuery()' },
  { pattern: /\buseSuspenseQuery\s*\(/, label: 'useSuspenseQuery()' },
];

const FORBIDDEN_RQ_HOOKS = new Set([
  'useQuery',
  'useMutation',
  'useSuspenseQuery',
  'useInfiniteQuery',
]);

/** @param {string} line */
function isCommentLine(line) {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

/** @param {string} line */
function stripLineComment(line) {
  const idx = line.indexOf('//');
  if (idx === -1) return line;
  return line.slice(0, idx);
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

function walk(dir) {
  /** @type {Array<{ rel: string; line: number; message: string }>} */
  const hits = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...walk(path));
      continue;
    }
    if (!entry.name.endsWith('.tsx')) continue;

    const rel = relative(ROOT, path).replaceAll('\\', '/');
    const text = readFileSync(path, 'utf8');
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (isCommentLine(raw)) continue;
      const line = stripLineComment(raw);

      if (hasForbiddenReactQueryImport(line)) {
        hits.push({
          rel,
          line: i + 1,
          message:
            'runtime import from @tanstack/react-query (use domain hooks under components/{domain}/hooks/)',
        });
        continue;
      }
      if (hasForbiddenTrpcProviderImport(line)) {
        hits.push({
          rel,
          line: i + 1,
          message: 'runtime import of useTRPC from trpc-provider (use domain hooks)',
        });
        continue;
      }

      if (/\buseQueryState\s*\(/.test(line)) continue;

      for (const rule of FORBIDDEN_CALLS) {
        if (rule.pattern.test(line)) {
          hits.push({
            rel,
            line: i + 1,
            message: `${rule.label} — pages must call domain hooks, not tRPC/React Query directly`,
          });
          break;
        }
      }
    }
  }

  return hits;
}

const hits = walk(ROOT);
if (hits.length > 0) {
  console.error(`check:web-vite-page-shells — ${hits.length} violation(s):`);
  for (const hit of hits) {
    console.error(`  pages/${hit.rel}:${hit.line}  ${hit.message}`);
  }
  console.error('\nPages orchestrate via *PageContent or wired sections; data lives in hooks/.');
  console.error('See apps/web-vite/ARCHITECTURE.md');
  process.exit(1);
}

console.log('check:web-vite-page-shells — OK');
