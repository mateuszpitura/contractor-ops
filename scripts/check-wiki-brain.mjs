#!/usr/bin/env node
/**
 * Wiki brain health check — CI-canonical guard for agent reliability.
 * - graph.json present
 * - BM25 index present
 * - wiki wikilinks resolve
 * - content pages have verify_with in frontmatter
 * - api-routers-catalog not older than root.ts
 * - wiki source_commit matches HEAD (warn only if drift)
 */
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = join(ROOT, '.planning/brain');
const WIKI = join(VAULT, 'wiki');
const GRAPH = join(ROOT, '.planning/graphs/graph.json');
const BM25 = join(VAULT, '.vault-meta/bm25/index.json');
const ROOT_TS = join(ROOT, 'packages/api/src/root.ts');
const ROUTER_CATALOG = join(WIKI, 'structure/api-routers-catalog.md');

const SKIP_VERIFY = new Set([
  'index.md',
  'hot.md',
  'overview.md',
  'log.md',
]);

const SKIP_VERIFY_DIRS = new Set(['sources']);

let errors = 0;
let warnings = 0;

function err(msg) {
  console.error(`ERROR: ${msg}`);
  errors += 1;
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
  warnings += 1;
}

function walkMd(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkMd(p, acc);
    else if (ent.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    if (line.startsWith('verify_with:')) fm.hasVerify = true;
    if (line.startsWith('source_commit:')) fm.sourceCommit = line.split(':').slice(1).join(':').trim();
  }
  return fm;
}

function resolveWikilink(target, fromFile) {
  const clean = target.replace(/^\.\.\//, '').split('/').filter(Boolean);
  const fromDir = dirname(fromFile);
  let base = fromDir;
  for (const part of clean) {
    if (part === '..') base = dirname(base);
    else base = join(base, part);
  }
  const vaultTarget = target.replace(/^\.\.\//, '');
  const candidates = [
    base,
    `${base}.md`,
    `${base}.base`,
    `${base}.canvas`,
    join(WIKI, `${vaultTarget}.md`),
    join(WIKI, `${vaultTarget}.base`),
    join(WIKI, `${vaultTarget}.canvas`),
    join(WIKI, `${target}.md`),
    join(fromDir, `${clean[clean.length - 1]}.md`),
    join(fromDir, `${clean[clean.length - 1]}.base`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return true;
  }
  return false;
}

// 1. graph.json
if (!existsSync(GRAPH)) {
  err(`missing ${relative(ROOT, GRAPH)} — run graphify extract (see brain/README.md)`);
} else {
  const size = statSync(GRAPH).size;
  if (size < 1000) err(`graph.json too small (${size} bytes) — likely corrupt`);
}

// 2. BM25 index
if (!existsSync(BM25)) {
  err(`missing ${relative(ROOT, BM25)} — run contextual-prefix + bm25-index build`);
}

// 3. HEAD vs source_commit
let head = '';
try {
  head = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().slice(0, 8);
} catch {
  warn('could not read git HEAD');
}
if (head) {
  const pages = walkMd(WIKI);
  const commits = new Set(
    pages
      .map((p) => parseFrontmatter(readFileSync(p, 'utf8')).sourceCommit)
      .filter(Boolean)
      .map((c) => c.slice(0, 8)),
  );
  if (commits.size > 1) warn(`multiple source_commit prefixes in wiki: ${[...commits].join(', ')}`);
  if (commits.size === 1 && ![...commits][0].startsWith(head)) {
    warn(`wiki source_commit ${[...commits][0]} differs from HEAD ${head} — run map-codebase + refresh`);
  }
}

// 4. router catalog freshness
if (existsSync(ROOT_TS) && existsSync(ROUTER_CATALOG)) {
  const rootMtime = statSync(ROOT_TS).mtimeMs;
  const catMtime = statSync(ROUTER_CATALOG).mtimeMs;
  if (rootMtime > catMtime + 1000) {
    err('packages/api/src/root.ts newer than wiki/structure/api-routers-catalog.md — refresh catalog');
  }
}

// 5. per-page checks
const pages = walkMd(WIKI);
const allPaths = new Set(pages.map((p) => relative(WIKI, p)));

for (const file of pages) {
  const rel = relative(WIKI, file);
  const text = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text);
  const parts = rel.split('/');
  const isIndex = rel.endsWith('_index.md') || SKIP_VERIFY.has(parts[parts.length - 1]);
  const isSource = parts[0] === 'sources';

  if (!isIndex && !isSource && !fm.hasVerify) {
    err(`${rel}: missing verify_with in frontmatter`);
  }

  const links = [...text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)];
  for (const [, raw] of links) {
    if (raw.startsWith('http') || raw.includes('.planning/')) continue;
    const target = raw.trim();
    if (!resolveWikilink(target, file)) {
      err(`${rel}: dead wikilink [[${target}]]`);
    }
  }
}

console.log(`\nwiki-brain check: ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) process.exit(1);
process.exit(0);
