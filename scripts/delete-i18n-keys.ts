#!/usr/bin/env tsx
/**
 * Remove a list of dotted i18n key paths from every locale file in
 * `apps/web-vite/messages/{en,de,pl,ar}.json`.
 *
 * After every deletion, empty parent objects are pruned recursively so the
 * tree never carries stale intermediate nodes. Files are written with
 * 2-space indent + trailing newline (matches existing convention).
 *
 * Usage:
 *   pnpm tsx scripts/delete-i18n-keys.ts <keys-file> [--dry-run]
 *
 * <keys-file> is either:
 *   - a JSON object `{ "NS.path.leaf": "...", ... }` — keys are read from
 *     the object's keys (values are ignored). This is the shape emitted by
 *     `scripts/audit-i18n-unused-keys.ts --dump`.
 *   - a plain text file with one dotted path per line (blank lines + `#`
 *     comments allowed).
 *
 * Or pass keys directly with `--key Notifications.center.pageTitle`
 * (repeatable). Useful for one-off purges.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const MSG_DIR = resolve(ROOT, 'apps/web-vite/messages');
const LOCALES = ['en', 'pl', 'de', 'ar'] as const;
const DRY_RUN = process.argv.includes('--dry-run');

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isObj(v: Json): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deleteAt(root: Json, path: string): { deleted: boolean; sample: Json | undefined } {
  const parts = path.split('.');
  const trail: { node: { [k: string]: Json }; key: string }[] = [];
  let cur: Json = root;
  for (let i = 0; i < parts.length; i++) {
    if (!isObj(cur)) return { deleted: false, sample: undefined };
    const key = parts[i];
    if (!(key in cur)) return { deleted: false, sample: undefined };
    trail.push({ node: cur, key });
    if (i === parts.length - 1) break;
    cur = cur[key];
  }
  const last = trail[trail.length - 1];
  const removed = last.node[last.key];
  delete last.node[last.key];
  // Prune empty parents.
  for (let i = trail.length - 2; i >= 0; i--) {
    const { node, key } = trail[i];
    const child = node[key];
    if (isObj(child) && Object.keys(child).length === 0) {
      delete node[key];
    } else {
      break;
    }
  }
  return { deleted: true, sample: removed };
}

function loadKeys(): string[] {
  const cliKeys: string[] = [];
  const argv = process.argv.slice(2);
  let file: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') continue;
    if (a === '--key') {
      const next = argv[i + 1];
      if (!next) throw new Error('--key requires a value');
      cliKeys.push(next);
      i++;
      continue;
    }
    if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`);
    if (file) throw new Error('multiple positional args; expected one keys-file');
    file = a;
  }
  const fileKeys: string[] = [];
  if (file) {
    const text = readFileSync(resolve(file), 'utf-8');
    if (text.trimStart().startsWith('{')) {
      const obj = JSON.parse(text) as { [k: string]: unknown };
      for (const k of Object.keys(obj)) fileKeys.push(k);
    } else {
      for (const line of text.split(/\r?\n/)) {
        const s = line.trim();
        if (!s || s.startsWith('#')) continue;
        fileKeys.push(s);
      }
    }
  }
  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [...cliKeys, ...fileKeys]) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  if (out.length === 0) throw new Error('no keys supplied — pass a file or one or more --key');
  return out;
}

const keys = loadKeys();
console.log(`Pruning ${keys.length} key(s) from ${LOCALES.length} locale file(s)${DRY_RUN ? ' (dry-run)' : ''}.`);

let grandTotal = 0;
for (const locale of LOCALES) {
  const path = resolve(MSG_DIR, `${locale}.json`);
  const bundle = JSON.parse(readFileSync(path, 'utf-8')) as Json;
  let deleted = 0;
  let missing = 0;
  const missingSamples: string[] = [];
  for (const key of keys) {
    const { deleted: ok } = deleteAt(bundle, key);
    if (ok) deleted++;
    else {
      missing++;
      if (missingSamples.length < 5) missingSamples.push(key);
    }
  }
  grandTotal += deleted;
  if (!DRY_RUN) {
    const out = `${JSON.stringify(bundle, null, 2)}\n`;
    writeFileSync(path, out);
  }
  console.log(
    `  ${locale}: deleted ${deleted}/${keys.length}` +
      (missing > 0 ? ` (missing: ${missing}; e.g. ${missingSamples.join(', ')})` : ''),
  );
}

console.log(`\nTotal deletions across locales: ${grandTotal}${DRY_RUN ? ' (dry-run; no files written)' : ''}.`);
