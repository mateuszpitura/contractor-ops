#!/usr/bin/env node
// Forbid silent catch blocks in service / app source.
//
// Why:
// - A `try { ... } catch (e) {}` (or `.catch(() => {})`) drops the error on
//   the floor: no Pino line, no Sentry breadcrumb, nothing in the logs. The
//   only signal a downstream operator gets is the user-visible misbehaviour
//   that follows. Webhook handlers, payment flows, sync orchestrators, and
//   middleware all had instances where a single transient failure went
//   completely invisible until reproduced.
// - The fix is either to log + handle (`logger.error({ err }, '...'); throw
//   err;` / chosen non-2xx response) or to *explicitly opt in* to swallowing
//   with a `// safe-swallow: <reason>` annotation on the line directly above
//   the `catch` keyword (or above the `.catch(...)` chain). Annotated sites
//   still leave a paper trail for code review.
//
// Scanned roots:
// - packages/{api,integrations,einvoice}/src/**/*.ts(x)
// - apps/{web-vite,landing,public-api,cron-worker}/src/**/*.ts(x)
//
// Skipped:
// - `__tests__/**`, `*.test.*`, `*.spec.*`, `*.d.ts` — tests routinely
//   construct ignorable failures.
//
// What is flagged ("silent"):
// 1. Empty catch bodies: `} catch (foo) {}` or `} catch {}`, single-line or
//    multi-line, where the body between `{` and the matching `}` contains
//    only whitespace and/or `//` / `/* */` comments.
// 2. Silent promise-tail catches: `.catch(() => {})`, `.catch(() => undefined)`,
//    `.catch(_ => undefined)`, `.catch((_e) => {})`. Tolerates whitespace
//    inside the arrow form.
//
// What is NOT flagged:
// - Catches whose body contains any real statement (`throw err`,
//   `return ...`, `Sentry.captureException(err)`, etc.) — even if no
//   logger call is present, the error is being handled, not silently
//   dropped.
// - Catches whose body contains `logger.` or `console.` — the error is
//   being logged, which is the primary safety net this lint protects.
// - Sites preceded (within 5 non-blank lines above the `catch` / `.catch`)
//   by a comment containing `safe-swallow:`. The annotation is required to
//   carry a short rationale (e.g. `// safe-swallow: best-effort metric;
//   adapter retry is sufficient`). Both `//` line comments and `/* ... */`
//   block comments count — the window was widened from 3 to 5 lines so a
//   multi-line block-comment rationale ending in `safe-swallow: <reason>`
//   on its final line is still recognised when it sits a few lines above
//   the catch.
//
// Exit codes:
// - 0 on clean scan
// - 1 with `file:line: <reason>` lines on violations
//
// Companion guards:
// - `scripts/lint-raw-fetch.mjs` (B.3.d) — unannotated raw `fetch()`.
// - `scripts/lint-idempotency.mjs` (B.4.b) — hand-rolled idempotency keys.
// - `scripts/lint-audit-log.mjs` (B.2.c) — `auditLog.create` outside helper.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(Dirname, '..');

const scanRoots = [
  resolve(repoRoot, 'packages/api/src'),
  resolve(repoRoot, 'packages/integrations/src'),
  resolve(repoRoot, 'packages/einvoice/src'),
  resolve(repoRoot, 'apps/web-vite/src'),
  resolve(repoRoot, 'apps/landing/src'),
  resolve(repoRoot, 'apps/public-api/src'),
  resolve(repoRoot, 'apps/cron-worker/src'),
];

const allowPathPatterns = [/\/__tests__\//, /\.(test|spec)\.[tj]sx?$/, /\.d\.ts$/];

function isPathAllowed(relPath) {
  return allowPathPatterns.some(pattern => pattern.test(relPath));
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Look back through the lines preceding `lineIdx` (inclusive of the line at
 * `lineIdx - 1`) for a `safe-swallow:` comment annotation. Tolerates blank
 * lines and other comment lines in between, but stops at the first
 * non-comment / non-blank line.
 *
 * Window size is 5 to accommodate `// safe-swallow: <reason>` directly
 * above the catch keyword, an optional `// <continuation>` line, AND
 * multi-line block comments (slash-star ... safe-swallow: <reason> ...
 * star-slash) where the rationale token may not sit on the line
 * immediately above the catch. Both line (`//`) and block-comment
 * prefixes / terminators are recognised as comment lines for the purpose
 * of "comment-only between annotation and catch keyword".
 */
function hasSafeSwallowAnnotation(lines, lineIdx) {
  let scanned = 0;
  for (let i = lineIdx - 1; i >= 0 && scanned < 5; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      scanned++;
      continue;
    }
    if (/safe-swallow:/.test(trimmed)) return true;
    // Stop scanning the moment we hit a non-blank, non-comment line: the
    // annotation must be visually adjacent to the catch. A line ending in
    // the block-comment terminator closes a block comment opened on a
    // previous line, so it still counts as a comment line for the purpose
    // of continuing the scan.
    if (
      !(
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.endsWith('*/')
      )
    ) {
      return false;
    }
    scanned++;
  }
  return false;
}

/**
 * Given a source string and the offset of the `{` opening a catch body,
 * find the matching `}` and return the body text in between.
 *
 * The scan respects string literals (`"..."`, `'...'`, `` `...` ``) and
 * comments (`//`, `/* *\/`) so a `}` inside a string does not close the
 * body. Returns `null` if no matching brace is found (unbalanced source —
 * skip the site).
 */
function extractBraceBody(source, openBraceOffset) {
  let depth = 1;
  let i = openBraceOffset + 1;
  const len = source.length;
  while (i < len) {
    const ch = source[i];
    // Line comment
    if (ch === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i);
      if (nl === -1) return null;
      i = nl + 1;
      continue;
    }
    // Block comment
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return null;
      i = end + 2;
      continue;
    }
    // String literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < len) {
        const c = source[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        // Template literal interpolation -- recurse on the `${ ... }` block
        if (quote === '`' && c === '$' && source[i + 1] === '{') {
          let interpDepth = 1;
          i += 2;
          while (i < len && interpDepth > 0) {
            if (source[i] === '{') interpDepth++;
            else if (source[i] === '}') interpDepth--;
            if (interpDepth > 0) i++;
          }
          i++; // step past the closing `}`
          continue;
        }
        i++;
      }
      continue;
    }
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(openBraceOffset + 1, i);
      }
      i++;
      continue;
    }
    i++;
  }
  return null;
}

/**
 * Strip line + block comments from a body string so we can check whether
 * any *real* statement remains.
 */
function stripComments(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Convert a character offset in `source` to a 1-indexed line number.
 */
function offsetToLine(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

const allFiles = [];
for (const root of scanRoots) {
  walk(root, allFiles);
}

const violations = [];

// Match the catch keyword + (optional) binding + the opening brace of the
// body. We deliberately ignore catches inside template literals — the brace
// matcher will fail to extract a body and we'll skip the site.
const catchRegex = /\bcatch\s*(?:\(\s*[^)]*\)\s*)?\{/g;
// `.catch(() => {})`, `.catch(() => undefined)`, `.catch((e) => {})`, etc.
const promiseSilentCatchRegex =
  /\.catch\(\s*\(?\s*_?\w*\s*\)?\s*=>\s*(?:\{\s*\}|undefined|void\s+0)\s*\)/g;

for (const file of allFiles) {
  const rel = relative(repoRoot, file);
  if (isPathAllowed(rel)) continue;

  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');

  // -- Empty / comment-only catch bodies ------------------------------------
  catchRegex.lastIndex = 0;
  let match = catchRegex.exec(source);
  while (match !== null) {
    const catchKeywordOffset = match.index;
    const openBraceOffset = match.index + match[0].length - 1;
    const body = extractBraceBody(source, openBraceOffset);
    if (body === null) {
      match = catchRegex.exec(source);
      continue;
    }

    const stripped = stripComments(body).trim();
    if (stripped.length > 0) {
      match = catchRegex.exec(source);
      continue; // real statement present -- not silent
    }

    const catchLineIdx = offsetToLine(source, catchKeywordOffset) - 1;
    if (hasSafeSwallowAnnotation(lines, catchLineIdx)) {
      match = catchRegex.exec(source);
      continue;
    }

    // Bonus safety net: even though the body is empty after stripping,
    // a `logger.` / `console.` token inside a comment shouldn't satisfy
    // the lint -- comments don't log. So we keep flagging here.
    violations.push(
      `${rel}:${catchLineIdx + 1}: empty catch block; add logger.error(...) call, rethrow, or annotate with "// safe-swallow: <reason>" directly above the catch keyword.`,
    );
    match = catchRegex.exec(source);
  }

  // -- Silent promise-tail `.catch(() => {})` patterns ----------------------
  promiseSilentCatchRegex.lastIndex = 0;
  let promiseMatch = promiseSilentCatchRegex.exec(source);
  while (promiseMatch !== null) {
    const offset = promiseMatch.index;
    const lineIdx = offsetToLine(source, offset) - 1;
    if (hasSafeSwallowAnnotation(lines, lineIdx)) {
      promiseMatch = promiseSilentCatchRegex.exec(source);
      continue;
    }
    violations.push(
      `${rel}:${lineIdx + 1}: silent .catch(() => {}) / .catch(() => undefined); log the error or annotate with "// safe-swallow: <reason>" directly above the .catch line.`,
    );
    promiseMatch = promiseSilentCatchRegex.exec(source);
  }
}

if (violations.length > 0) {
  console.error(
    'lint-silent-catch: silent catch block(s) detected — every catch must either log + handle the error,',
  );
  console.error(
    'or carry a `// safe-swallow: <reason>` annotation on the immediately preceding line.',
  );
  console.error('---');
  for (const v of violations) {
    console.error(v);
  }
  process.exit(1);
}

console.log(`OK — no silent catch blocks in ${allFiles.length} scanned files.`);
process.exit(0);
