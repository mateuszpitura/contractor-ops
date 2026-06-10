#!/usr/bin/env node
/**
 * CI gate — tRPC/React Query only in hooks (and providers).
 * See apps/web-vite/ARCHITECTURE.md
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

const FORBIDDEN_PATTERNS = [
  /\buseTRPC\s*\(/,
  /\buseQuery\s*\(/,
  /\buseMutation\s*\(/,
  /\buseInfiniteQuery\s*\(/,
  /\buseSuspenseQuery\s*\(/,
];

/** @param {string} relPath POSIX-style path relative to src */
function isAllowed(relPath) {
  if (relPath.startsWith('providers/')) return true;
  if (relPath.includes('/hooks/')) return true;
  if (relPath.startsWith('hooks/')) return true;
  // nuqs-only filter hooks may import useQueryState but not useQuery — still scan;
  // lib trpc helpers without hooks are rare; disallow unless under hooks/
  return false;
}

function walk(dir) {
  /** @type {Array<{ path: string; rel: string; line: number; match: string }>} */
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...walk(path));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const rel = relative(ROOT, path).replaceAll('\\', '/');
      if (isAllowed(rel)) continue;
      const text = readFileSync(path, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        if (/\buseQueryState\s*\(/.test(line)) continue;
        if (/\buseQueryClient\s*\(/.test(line)) continue;
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            hits.push({
              path,
              rel,
              line: i + 1,
              match: line.trim(),
            });
            break;
          }
        }
      }
    }
  }
  return hits;
}

const hits = walk(ROOT);
if (hits.length > 0) {
  console.error(`check:web-vite-data-layer — ${hits.length} violation(s):`);
  for (const hit of hits) {
    console.error(`  ${hit.rel}:${hit.line}  ${hit.match}`);
  }
  console.error(
    '\nMove data fetching to components/{domain}/hooks/ (wired sections call hooks only).',
  );
  console.error('See apps/web-vite/ARCHITECTURE.md');
  process.exit(1);
}

console.log('check:web-vite-data-layer — OK');
