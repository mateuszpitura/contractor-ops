#!/usr/bin/env node
/**
 * Normalize wiki wikilinks for Obsidian graph view.
 * Converts [[../domains/foo]] → [[domains/foo]] (vault-root paths from wiki/).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = join(ROOT, '.planning/brain/wiki');

function walkMd(dir, acc = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkMd(p, acc);
    else if (ent.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

let files = 0;
let replacements = 0;

for (const file of walkMd(WIKI)) {
  const text = readFileSync(file, 'utf8');
  const next = text.replace(/\[\[\.\.\/([^\]|#]+)/g, (_m, target) => {
    replacements += 1;
    return `[[${target}`;
  });
  if (next !== text) {
    writeFileSync(file, next);
    files += 1;
  }
}

console.log(`normalize-wiki-wikilinks: ${files} files, ${replacements} link(s) fixed`);
