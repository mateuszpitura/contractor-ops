#!/usr/bin/env node
/**
 * CI gate — fails if any Next.js import remains in apps/web-vite/src.
 * Mirrors plan.md Step 11 verification.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;
const IMPORT_PATTERN = /^\s*import\s+.*from\s+['"]next(?:\/|-)/m;

function walk(dir) {
  /** @type {string[]} */
  const hits = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...walk(path));
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      const text = readFileSync(path, 'utf8');
      if (IMPORT_PATTERN.test(text)) hits.push(path);
    }
  }
  return hits;
}

const hits = walk(ROOT);
if (hits.length > 0) {
  console.error('lint:no-next — forbidden Next.js imports found:');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log('lint:no-next — OK (no next/* imports in apps/web-vite/src)');
