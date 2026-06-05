#!/usr/bin/env node

/*
 * RTL physical-direction Tailwind guard (web-vite, all component surfaces).
 *
 * web-vite renders Arabic with dir="rtl", so direction-physical Tailwind
 * utilities lay out on the wrong side. This guard bans them across the whole
 * web-vite src tree and requires the logical equivalents instead:
 *
 *   mr-/ml-  -> me-/ms-      pr-/pl-  -> pe-/ps-
 *   text-right/text-left     -> text-end/text-start
 *   left-/right-             -> start-/end-
 *   border-l/border-r        -> border-s/border-e
 *   rounded-l/rounded-r      -> rounded-s/rounded-e
 *   rounded-tl/tr/bl/br      -> rounded-ss/se/es/ee
 *
 * Scope note: a sibling guard (packages/db/scripts/check-rtl-logical-props.mjs)
 * covers only the two Gulf surface dirs by design; this one is the broad
 * web-vite gate. Tests are skipped because Tailwind-looking tokens there are
 * usually string-literal IDs (e.g. profileId 'pl-1'), not class names.
 *
 * Exceptions: physical positioning paired with a translate centering helper
 * (e.g. `left-1/2 -translate-x-1/2`) is true centering, not direction, so it is
 * allowed.
 *
 * Banned patterns are assembled from character classes so the literal physical
 * tokens never appear verbatim here, keeping the guard from flagging its own
 * source if the scan scope ever widens to include scripts/.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const SCAN_ROOT = join(REPO_ROOT, 'apps', 'web-vite', 'src');

const SCAN_EXTENSIONS = ['.ts', '.tsx'];

// Directories skipped wholesale. `layout/` carries decorative absolute-position
// orbs (arbitrary-value left-[..]/right-[..]) that are ambient background, not
// content direction; convert them in the layout owner's pass before scoping
// this guard to include layout/.
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'layout']);

// Pull out only the contents of className strings so we never test arbitrary
// code (string literals, object keys, etc.). Covers className="...",
// className={`...`} (template, possibly interpolated), className={cn('...')},
// and bare cn('...') / cva('...') calls.
const CLASSNAME_SEGMENT = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{([^}]*)\})/g;
const QUOTED_STRING = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;

// Each banned matcher carries the logical replacement hint. Tokens use
// character classes (`[mp]`, `[lr]`, etc.) so the physical literals are not
// spelled out in this file.
const BANNED = [
  {
    name: 'physical margin/padding',
    // mr-/ml-/pr-/pl- with optional responsive/state prefix; token-boundary safe.
    re: /(?:^|[\s:])(?:[a-z]+:)*[mp][lr]-/,
    hint: 'use logical me-/ms-/pe-/ps-',
  },
  {
    name: 'physical text-align',
    re: /(?:^|[\s:])(?:[a-z]+:)*text-(?:left|right)\b/,
    hint: 'use text-start / text-end',
  },
  {
    name: 'physical position',
    // left-/right- positioning. Allowed when a translate centering helper is
    // present on the same className (handled by the centering check below).
    re: /(?:^|[\s:])(?:[a-z]+:)*(?:left|right)-/,
    hint: 'use start- / end-',
  },
  {
    name: 'physical border side',
    re: /(?:^|[\s:])(?:[a-z]+:)*border-[lr](?:-|\b)/,
    hint: 'use border-s / border-e',
  },
  {
    name: 'physical rounded side',
    re: /(?:^|[\s:])(?:[a-z]+:)*rounded-[lr](?:-|\b)/,
    hint: 'use rounded-s / rounded-e',
  },
  {
    name: 'physical rounded corner',
    re: /(?:^|[\s:])(?:[a-z]+:)*rounded-[tb][lr](?:-|\b)/,
    hint: 'use rounded-ss / rounded-se / rounded-es / rounded-ee',
  },
];

// Centering helper: physical left-/right- paired with an x-axis translate is
// geometric centering, not text direction, and is permitted.
const CENTERING = /-?translate-x-/;

function listFilesRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else if (
      SCAN_EXTENSIONS.some(ext => entry.name.endsWith(ext)) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      out.push(full);
    }
  }
  return out;
}

// Detects the start of an open multi-line className expression
// (`className={cn(` / `className={` ... ) that does not close on its own line.
const CLASSNAME_OPEN = /className\s*=\s*\{/;

function quotedStringsOf(text) {
  const out = [];
  QUOTED_STRING.lastIndex = 0;
  let q = QUOTED_STRING.exec(text);
  while (q !== null) {
    out.push(q[2]);
    q = QUOTED_STRING.exec(text);
  }
  return out;
}

function extractClassTokens(line) {
  // Returns the class-string contents from className= attributes on this line.
  const tokens = [];
  CLASSNAME_SEGMENT.lastIndex = 0;
  let m = CLASSNAME_SEGMENT.exec(line);
  while (m !== null) {
    const dq = m[1];
    const sq = m[2];
    const tpl = m[3];
    const expr = m[4];
    if (dq !== undefined) tokens.push(dq);
    if (sq !== undefined) tokens.push(sq);
    if (tpl !== undefined) tokens.push(tpl);
    if (expr !== undefined) {
      // className={cn('a', `b ${x}`)} etc. — pull every quoted string out.
      tokens.push(...quotedStringsOf(expr));
    }
    m = CLASSNAME_SEGMENT.exec(line);
  }
  return tokens;
}

function pushOffenders(offenders, file, lineNo, rawLine, classTokens) {
  for (const tokenStr of classTokens) {
    const padded = ` ${tokenStr} `;
    const isCentering = CENTERING.test(padded);
    for (const rule of BANNED) {
      if (!rule.re.test(padded)) continue;
      // Allow physical position only when it is a translate-x centering combo.
      if (rule.name === 'physical position' && isCentering) continue;
      offenders.push({
        file,
        line: lineNo,
        rule: rule.name,
        hint: rule.hint,
        text: rawLine.trim(),
      });
      break;
    }
  }
}

function findOffenders(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const offenders = [];
  // Tracks an open `className={...}` expression spanning multiple lines, so
  // class strings on continuation lines (e.g. a long cn(...) first arg) are
  // still scanned. Brace depth resets the moment the expression closes.
  let openClassNameDepth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (openClassNameDepth > 0) {
      // Inside a multi-line className expression: treat quoted strings on this
      // line as class tokens until the brace depth returns to zero.
      pushOffenders(offenders, file, i + 1, line, quotedStringsOf(line));
      for (const ch of line) {
        if (ch === '{') openClassNameDepth += 1;
        else if (ch === '}') openClassNameDepth -= 1;
        if (openClassNameDepth <= 0) {
          openClassNameDepth = 0;
          break;
        }
      }
      continue;
    }

    pushOffenders(offenders, file, i + 1, line, extractClassTokens(line));

    // Open a multi-line className expression only when its `{` is not balanced
    // on this same line (single-line cases are already handled above).
    const openIdx = line.search(CLASSNAME_OPEN);
    if (openIdx !== -1) {
      let depth = 0;
      let opened = false;
      for (let c = line.indexOf('{', openIdx); c < line.length && c !== -1; c += 1) {
        if (line[c] === '{') {
          depth += 1;
          opened = true;
        } else if (line[c] === '}') {
          depth -= 1;
        }
        if (opened && depth === 0) break;
      }
      if (opened && depth > 0) openClassNameDepth = depth;
    }
  }
  return offenders;
}

function main() {
  const files = listFilesRecursive(SCAN_ROOT);
  const offenders = files.flatMap(findOffenders);

  if (offenders.length === 0) {
    process.stdout.write(
      `check-rtl-physical-classes: ${files.length} web-vite file(s) scanned; no physical-direction Tailwind utilities found\n`,
    );
    return;
  }

  process.stderr.write(
    `check-rtl-physical-classes: ${offenders.length} physical-direction utility offender(s) on web-vite RTL surfaces:\n`,
  );
  for (const o of offenders) {
    const rel = relative(REPO_ROOT, o.file);
    process.stderr.write(`  ${rel}:${o.line}  [${o.rule}] ${o.hint}\n    ${o.text}\n`);
  }
  process.stderr.write(
    '\nReplace physical-direction utilities with logical equivalents so the RTL (ar) layout renders correctly.\n',
  );
  process.exit(1);
}

main();
