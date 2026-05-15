#!/usr/bin/env tsx
/**
 * Repair files where apply-fixes injected `import { toast } from 'sonner';`
 * INSIDE a multi-line import statement (between `import {` and its closing brace).
 *
 * Strategy:
 *   1. Find the malformed pattern: line matching `^import { toast } from 'sonner';$`
 *      that sits between an `^import\s*{$` line and the matching `^} from .*;$` line.
 *   2. Remove that line.
 *   3. Re-insert it after the closing of the enclosing import.
 *
 * Idempotent: files without the malformed pattern are left untouched.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const WEB_SRC = resolve(ROOT, 'apps/web/src');

function walk(dir: string, out: string[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules' || e.name === '.next') continue;
      walk(full, out);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
}

const files: string[] = [];
walk(WEB_SRC, files);

let repaired = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  let inMultiLineImport = false;
  let importEndIdx = -1;
  let badIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inMultiLineImport) {
      if (/^\s*import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?\s*$/.test(line)) {
        badIdx = i;
      }
      if (/^\s*\}\s*from\s*['"][^'"]+['"];?\s*$/.test(line)) {
        importEndIdx = i;
        inMultiLineImport = false;
        if (badIdx !== -1) break;
      }
      continue;
    }
    if (/^\s*import\s*\{\s*$/.test(line)) {
      inMultiLineImport = true;
      badIdx = -1;
      importEndIdx = -1;
    }
  }
  if (badIdx === -1 || importEndIdx === -1) continue;
  // Remove badIdx, then re-insert after importEndIdx
  const removed = lines.splice(badIdx, 1)[0];
  // After removal, importEndIdx shifted by -1 (since badIdx < importEndIdx)
  lines.splice(importEndIdx, 0, removed.trim());
  writeFileSync(file, lines.join('\n'), 'utf8');
  repaired++;
  console.log(`repaired ${file.replace(ROOT + '/', '')}`);
}

console.log(`\n✓ repaired ${repaired} files`);
