#!/usr/bin/env node
/**
 * CI gate — pages compose containers only (thin route shells).
 * See apps/web-vite/ARCHITECTURE.md
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src/pages', import.meta.url).pathname;

const IMPORT_FROM_RE = /import\s+(?:type\s+)?(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g;

const FORBIDDEN_LOGIC = [
  { id: 'useTranslations', pattern: /\buseTranslations\s*\(/, label: 'useTranslations()' },
  { id: 'useParams', pattern: /\buseParams\s*[<(]/, label: 'useParams()' },
  { id: 'useSearchParams', pattern: /\buseSearchParams\s*\(/, label: 'useSearchParams()' },
  { id: 'usePermissions', pattern: /\busePermissions\s*\(/, label: 'usePermissions()' },
  { id: 'useFlag', pattern: /\buseFlag\s*\(/, label: 'useFlag()' },
  {
    id: 'Navigate-import',
    pattern: /\bimport\b[^;]*\bNavigate\b[^;]*from\s+['"]react-router/,
    label: 'Navigate import from react-router',
  },
  { id: 'Navigate-jsx', pattern: /<Navigate\b/, label: '<Navigate />' },
  { id: 'Navigate-call', pattern: /\bNavigate\s*\(/, label: 'Navigate()' },
];

/** @param {string} modulePath */
function isAllowedComponentImport(modulePath) {
  if (!modulePath.includes('/components/')) return true;
  if (modulePath.includes('-container')) return true;
  if (modulePath.includes('page-loading-spinner')) return true;
  return false;
}

/** @param {string} line */
function isCommentLine(line) {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
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
      const line = lines[i];
      if (isCommentLine(line)) continue;

      IMPORT_FROM_RE.lastIndex = 0;
      let importMatch = IMPORT_FROM_RE.exec(line);
      while (importMatch !== null) {
        const modulePath = importMatch[1];
        if (!isAllowedComponentImport(modulePath)) {
          hits.push({
            rel,
            line: i + 1,
            message: `forbidden component import "${modulePath}" (pages may import *-container or page-loading-spinner only)`,
          });
        }
        importMatch = IMPORT_FROM_RE.exec(line);
      }

      for (const rule of FORBIDDEN_LOGIC) {
        if (rule.pattern.test(line)) {
          hits.push({
            rel,
            line: i + 1,
            message: `page must not use ${rule.label} — move logic into a container`,
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
  console.error('\nPages are thin shells: Suspense + compose *Container only.');
  console.error('See apps/web-vite/ARCHITECTURE.md');
  process.exit(1);
}

console.log('check:web-vite-page-shells — OK');
