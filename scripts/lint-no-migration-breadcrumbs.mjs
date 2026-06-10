#!/usr/bin/env node
/**
 * CI gate — keeps internal planning/process breadcrumbs out of source comments.
 *
 * A source comment must read as a self-contained explanation of WHY the code is
 * the way it is. Internal tracking tokens — phase numbers, requirement/feature
 * IDs, decision/pitfall/threat IDs, plan/wave tags, migration-port notes — are
 * not explanations; they are provenance that belongs in commit messages and
 * `.planning/`, not inline. They go stale, mean nothing to a reader outside the
 * planning history, and make the codebase read like a changelog.
 *
 * Keep the WHY, drop the ID. "FOUND7-03 — US region is optional by design (D-06)"
 * becomes "US region is optional by design". A comment that is ONLY an ID gets
 * deleted outright.
 *
 * Only COMMENT text is inspected (leading `//`/`*`/`/*` lines and trailing `//`
 * after code). Real domain/standard identifiers are explicitly allowed — tax
 * forms (1099-NEC, W-8BEN, 1042-S, W-4), e-invoice codes (BG-20, BT-12, FA(3),
 * EN 16931, pain.001), Prisma error codes (P2002), crypto/RFC (AES-256,
 * HMAC-SHA256, RFC 8594, RFC 1918), legal articles (§94, AB5, §530), and the
 * like document behavior, not planning provenance.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;
const WORKSPACE_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'generated',
  '__generated__',
  '.turbo',
  '.next',
  'coverage',
]);

function srcDirs() {
  const dirs = [];
  for (const root of WORKSPACE_ROOTS) {
    const base = join(REPO, root);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = join(base, entry.name, 'src');
      if (existsSync(src)) dirs.push(src);
    }
  }
  return dirs;
}

// ---------------------------------------------------------------------------
// Migration-port provenance (original guard surface).
// ---------------------------------------------------------------------------
const PROVENANCE = [
  { label: 'apps/web path ref', re: /apps\/web\// },
  { label: 'codemod port note', re: /Step \d+ codemod|codemod port/ },
  { label: 'Lifted/Ported note', re: /Lifted from apps\/web|Ported from legacy/ },
];

// ---------------------------------------------------------------------------
// Internal planning / process tracking tokens — not valid explanations.
// Each pattern is distinctive enough that it does not collide with the
// domain/standard identifiers in ALLOW_TOKENS below.
// ---------------------------------------------------------------------------
const PLANNING_IDS = [
  { label: 'feature id', re: /\bF-[A-Z]{2,}-\d+/ }, // F-SCALE-06, F-DB-27, F-OBS-12
  { label: 'foundation req', re: /\bFOUND\d*-\d+/ }, // FOUND-01, FOUND7-03
  { label: 'arch review id', re: /\bNEW-ARCH-\d+/ },
  { label: 'pitfall id', re: /\bPitfall \d+/ },
  { label: 'threat id', re: /\bT-\d+-\d+-\d+\b/ }, // T-84-05-01
  { label: 'gap id', re: /\bGAP-\d/ },
  { label: 'code-review id', re: /\bCR-\d+\b/ },
  { label: 'work-receipt id', re: /\bWR-\d+\b/ },
  { label: 'phase ref', re: /\bPhase \d+\b/ },
  { label: 'plan ref', re: /\bPlan \d+-\d+\b|·\s*Plan \d+/ },
  { label: 'wave ref', re: /\bWave \d+\b/ },
  { label: 'decision id', re: /\(D-\d+\)|\bD-\d{1,2}\b/ },
  { label: 'success criterion', re: /\bSC#\d+/ },
  { label: 'us req id', re: /\bUS-(FIELD|FORM|PAY|CLASS|LOC|INFRA)-\d+/ },
  { label: 'worker req id', re: /\bWORKER-\d+/ },
  { label: 'integration req id', re: /\bINTEG-[A-Z]+-\d+/ },
  { label: 'employee req id', re: /\b(EMP-REG|EMP-ON|EMP-OFF|EMP-PORTAL)-[A-Z]{0,2}-?\d+/ },
  { label: 'hr req id', re: /\b(AKTA|LEAVE|TIME-EMP|HR-DASH|HRIS-SYNC)-\d+/ },
  { label: 'payroll req id', re: /\bPAYROLL-[A-Z]{2}-\d+/ },
  { label: 'lifecycle req id', re: /\b(OFFB|IDP|CLASS)-\d+/ },
];

// Whole-comment exemptions — a line matching any of these is never flagged.
const ALLOW_LINE = [/vi\.mock\(\s*['"]next-intl/];

// Domain/standard identifiers that look ID-ish but document behavior, not
// planning. A token-deny only fires when, after blanking these, the planning
// pattern still matches — so "W-8BEN treaty (Pitfall 4)" flags on Pitfall only,
// never on W-8BEN, and "BG-20 emission" never flags at all.
const ALLOW_TOKENS = [
  /\b1099-(NEC|MISC|K)\b/g,
  /\b1042-S\b/g,
  /\bW-8BEN(-E)?\b/g,
  /\bW-[249]\b/g,
  /\bP1[14]D\b/g,
  /\bP4[56]\b/g,
  /\bP60\b/g,
  /\bB[GT]-\d+\b/g, // UBL business group / business term (BG-20, BT-12)
  /\bEN ?16931\b/g,
  /\bpain\.\d+/gi,
  /\bISO[/ -]?\w*\d+/g,
  /\bRFC ?\d+/gi,
  /\bP2\d{3}\b/g, // Prisma error codes (P2002, P2025)
  /\bAES-\d+\b/g,
  /\bSHA-?\d+\b/g,
  /\bHMAC-SHA\d+\b/g,
  /\bUTF-\d+\b/g,
  /\bAS2805\b/g,
  /\b§\s?\d+[a-z]?\b/g,
  /\bAB-?5\b/g,
];

function isCommentLine(line) {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  return line.includes('//');
}

// Return only the comment portion of a line so deny patterns never fire on code
// (e.g. a string literal or identifier that resembles an ID).
function commentText(line) {
  const t = line.trimStart();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return line;
  const slash = line.indexOf('//');
  return slash === -1 ? '' : line.slice(slash);
}

function* sourceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* sourceFiles(join(dir, entry.name));
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

const hits = [];
for (const top of srcDirs()) {
  for (const file of sourceFiles(top)) {
    if (file.includes('/generated/')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!isCommentLine(line)) continue;
      if (ALLOW_LINE.some(re => re.test(line))) continue;

      const comment = commentText(line);
      const provenance = PROVENANCE.find(p => p.re.test(comment));
      // Blank out allowed domain tokens before testing planning patterns.
      let scrubbed = comment;
      for (const re of ALLOW_TOKENS) scrubbed = scrubbed.replace(re, ' ');
      const planning = PLANNING_IDS.find(p => p.re.test(scrubbed));

      const match = provenance ?? planning;
      if (match) {
        hits.push({
          file: file.replace(REPO, ''),
          line: i + 1,
          label: match.label,
          text: line.trim(),
        });
      }
    }
  }
}

if (hits.length > 0) {
  console.error('lint:no-breadcrumbs — internal planning/provenance comments found:');
  for (const h of hits) console.error(`  ${h.file}:${h.line} [${h.label}] ${h.text}`);
  console.error(
    `\n${hits.length} breadcrumb comment(s). A comment must explain WHY, not cite a ` +
      `phase/requirement/decision/pitfall/threat ID. Keep the explanation, drop the ID; ` +
      `delete comments that are only an ID. Provenance belongs in commit messages + .planning/.`,
  );
  process.exit(1);
}

console.log(
  'lint:no-breadcrumbs — OK (no migration-provenance or internal planning-ID comments in apps/*/src or packages/*/src)',
);
