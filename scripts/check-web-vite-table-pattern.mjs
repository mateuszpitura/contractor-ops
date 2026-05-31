#!/usr/bin/env node
/**
 * CI gate — enforces the canonical DataTable primitive in apps/web-vite.
 *
 * Rules (all scoped to apps/web-vite/src/, excluding __tests__/):
 *   A. No file imports `useReactTable` from `@tanstack/react-table`.
 *      The only TanStack-React-Table wrapper lives in
 *      `packages/ui/src/components/workbench/data-table/`.
 *   B. No file imports raw `Table`/`TableHeader`/`TableBody`/`TableRow`/
 *      `TableCell`/`TableHead` from `@contractor-ops/ui/components/shadcn/table`.
 *      Those primitives are used only inside the canonical DataTable folder
 *      or files allow-listed in FORM_STYLE_ALLOWLIST (sub-section tables
 *      embedded in Card/Sheet chrome that cannot adopt DataTable semantics).
 *   C. No source file matches `<name>-table.tsx`. Every table lives in a
 *      dedicated folder named after the table, with a single `data-table.tsx`.
 *   D. No file renders raw `<table>` markup. Use the shadcn `Table` primitive
 *      (then declare the file in FORM_STYLE_ALLOWLIST) or, for true layout
 *      grids that cannot adopt table semantics, RAW_TABLE_ALLOWLIST.
 *
 * Migration grace: pass `--allow=<glob>[,<glob>...]` to whitelist not-yet-
 * migrated files during a wave. Final lint gate (Wave 7) runs with no
 * `--allow` flag.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// CLI parse
// ---------------------------------------------------------------------------

/** @type {string[]} */
const allowGlobs = [];
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--allow=')) {
    const value = arg.slice('--allow='.length);
    for (const glob of value.split(',')) {
      const trimmed = glob.trim();
      if (trimmed) allowGlobs.push(trimmed);
    }
  }
}

/**
 * Minimal glob → regex translator. Supports `**` (any path including /),
 * `*` (segment-only), and `?` (single char). Anchored at start + end.
 * @param {string} glob
 */
function globToRegex(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else if (/[.+^$(){}|\\[\]]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  out += '$';
  return new RegExp(out);
}

const allowMatchers = allowGlobs.map(globToRegex);

/** @param {string} rel POSIX-relative path under apps/web-vite/src */
function isAllowed(rel) {
  return allowMatchers.some(re => re.test(rel));
}

// ---------------------------------------------------------------------------
// Permanent allow-list — form-style / inline-edit / mutation-host tables
// ---------------------------------------------------------------------------
//
// These files render tabular markup but are NOT data-display surfaces. The
// canonical DataTable primitive cannot host them without UX regression:
//
//   - inline-edit forms with one `<Input>` per cell (no pagination/sort)
//   - key/value form tables (settings prefs, tax rates, feature flag rows)
//   - row-as-mutation-host where every `<TableRow>` owns its own dialog state
//
// These were exempt under the previous lint script's manual whitelist with
// the comment: "Sub-section settings / admin tables — embedded in tabs /
// cards, not full list pages. Each shares the visual chrome of its parent
// card; unifying is out of scope for the list-page table format goal."
//
// Add new entries only with a one-line reason. Audit periodically.

const FORM_STYLE_ALLOWLIST = new Set([
  // OCR receipt line-items — inline-edit form with `<Input>` in every cell.
  'components/ocr/line-items-table.tsx',
  // E-invoicing leitweg-id list + row — each row owns its own edit/delete
  // dialog state; row is a TableRow mutation host inside Card chrome.
  'components/settings/e-invoicing/leitweg-id-list-card.tsx',
  'components/settings/e-invoicing/leitweg-id-row.tsx',
  // Feature flag rows — key/value toggle table inside the settings sheet.
  'components/settings/feature-flags-tab.tsx',
  // Phase 77 — per-provider IdP-deprovisioning enable matrix (2 rows + switch).
  'components/settings/idp-deprovisioning-toggle-table.tsx',
  // Notification preferences — channel × event matrix (form-style).
  'components/settings/notification-preferences.tsx',
  // Provider detail sheet — key/value field grid for a single provider.
  'components/settings/provider-detail-sheet.tsx',
  // Tax country rates + WHT certificates — sub-section forms with inline
  // edit/delete actions per row.
  'components/settings/tax/country-rates-section.tsx',
  'components/settings/tax/wht-certificates-section.tsx',
  // IR35 chain — sub-section list (3–5 rows) inside engagement page Card.
  'components/contractors/ir35-chain/ir35-chain-panel.tsx',
  'components/contractors/ir35-chain/chain-participant-row.tsx',
  // DRV clearance — sub-section list inside engagement page Card.
  'components/contractors/classification/drv-clearance/drv-clearance-panel.tsx',
  'components/contractors/classification/drv-clearance/drv-clearance-row.tsx',
  // Change-request diff — 3-col diff (field/current/requested) inside Card.
  'components/settings/change-request-diff-card.tsx',
  // Consent history — append-only audit list inside settings section.
  'components/consent/consent-management-section.tsx',
  // Cost-center CSV import preview — bounded (MAX_ROWS=1000) preview inside
  // Dialog body before commit.
  'components/organization/cost-centers/cost-center-csv-import-dialog.tsx',
  // Timesheet entry matrix — week × project grid with editable cells inside
  // ScrollArea. Inline-edit form-style table.
  'components/time/timesheet-grid.tsx',
  // Read-only review variant of the timesheet matrix.
  'components/time/contractor-timesheet-review.tsx',
]);

// Files allowed to render raw `<table>` markup (Rule D). Empty target state —
// every table either uses `DataTable` (canonical primitive) or the shadcn
// `Table` primitive (FORM_STYLE_ALLOWLIST sub-section tables). Add new
// entries only when shadcn `Table` cannot host the surface without a UX
// regression, and pair each entry with a one-line justification.
const RAW_TABLE_ALLOWLIST = new Set([]);

// ---------------------------------------------------------------------------
// Rule patterns
// ---------------------------------------------------------------------------

const USE_REACT_TABLE = /\buseReactTable\b/;
const SHADCN_TABLE_IMPORT = /from\s+['"]@contractor-ops\/ui\/components\/shadcn\/table['"]/;
const SHADCN_TABLE_NAMES = /\b(?:Table|TableHeader|TableBody|TableRow|TableCell|TableHead)\b/;
// Matches `<name>-table.tsx` except the canonical `data-table.tsx` filename.
const TABLE_FILE_NAME = /(?<!\bdata)-table\.tsx$/;
// Matches raw JSX `<table>` / `<table ...>` (lowercase) — distinguishes from
// shadcn `<Table>` (capitalized React component).
const RAW_TABLE_TAG = /<table[\s>]/;

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

/**
 * @typedef {{ rel: string, rule: 'A' | 'B' | 'C' | 'D', detail?: string }} Violation
 */

/** @returns {Violation[]} */
function walk(dir) {
  /** @type {Violation[]} */
  const violations = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...walk(path));
      continue;
    }
    if (!/\.(tsx?)$/.test(entry.name)) continue;
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    if (rel.includes('/__tests__/')) continue;
    if (isAllowed(rel)) continue;
    if (FORM_STYLE_ALLOWLIST.has(rel)) continue;

    // Rule C — file name matches *-table.tsx
    if (TABLE_FILE_NAME.test(entry.name)) {
      violations.push({ rel, rule: 'C' });
    }

    const text = readFileSync(path, 'utf8');

    // Rule A — useReactTable
    if (USE_REACT_TABLE.test(text)) {
      violations.push({ rel, rule: 'A' });
    }

    // Rule B — shadcn Table import
    if (SHADCN_TABLE_IMPORT.test(text)) {
      const importBlocks = text.matchAll(
        /import\s*\{([^}]*)\}\s*from\s*['"]@contractor-ops\/ui\/components\/shadcn\/table['"]/g,
      );
      for (const match of importBlocks) {
        if (SHADCN_TABLE_NAMES.test(match[1])) {
          violations.push({ rel, rule: 'B' });
          break;
        }
      }
    }

    // Rule D — raw <table> JSX markup
    if (!RAW_TABLE_ALLOWLIST.has(rel) && RAW_TABLE_TAG.test(text)) {
      violations.push({ rel, rule: 'D' });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const violations = walk(ROOT);

if (violations.length > 0) {
  const ruleCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const v of violations) ruleCounts[v.rule]++;
  console.error(
    `check:web-vite-table-pattern — ${violations.length} violation(s) ` +
      `(A: ${ruleCounts.A}, B: ${ruleCounts.B}, C: ${ruleCounts.C}, D: ${ruleCounts.D}):`,
  );
  for (const v of violations) {
    console.error(`  [${v.rule}] apps/web-vite/src/${v.rel}`);
  }
  console.error(
    '\nRule A: `useReactTable` is only allowed inside the canonical primitive\n' +
      '       at packages/ui/src/components/workbench/data-table/.\n' +
      'Rule B: shadcn Table/TableBody/TableRow/TableCell/TableHeader/TableHead\n' +
      '       imports are only allowed inside the canonical primitive folder\n' +
      '       or in FORM_STYLE_ALLOWLIST sub-section tables.\n' +
      'Rule C: every table file is `data-table.tsx` inside a dedicated folder.\n' +
      '       Rename `<name>-table.tsx` → `<name>/data-table.tsx`.\n' +
      'Rule D: raw `<table>` markup is banned. Migrate to the shadcn `Table`\n' +
      '       primitive (then add the file to FORM_STYLE_ALLOWLIST) or, when\n' +
      '       the surface is a layout grid that cannot adopt table semantics,\n' +
      '       add it to RAW_TABLE_ALLOWLIST with a one-line justification.\n' +
      '\nMigration: pass `--allow=<glob>[,<glob>...]` to grace not-yet-migrated\n' +
      'files during a wave. The Wave 7 cleanup PR removes all --allow flags.',
  );
  process.exit(1);
}

console.log('check:web-vite-table-pattern — OK');
