#!/usr/bin/env node
/**
 * CI gate — every data-display table in apps/web-vite must wrap its
 * `<Table>` primitive inside the shared chrome stack so every list page
 * reads as one visual family:
 *
 *   - via `SimpleDataTable` (small / static lists), or
 *   - via `AtelierTableShell` + `DataTableBody` + `SortableTableHead`
 *     (full-feature data tables: pagination, sort, bulk actions).
 *
 * Files that import `Table` from `@contractor-ops/ui/components/shadcn/table`
 * but DO NOT import one of the above sentinels are reported as violations,
 * unless they are explicitly whitelisted below (form-style tables, embedded
 * mini-tables, deferred ports).
 *
 * Companion to check-web-vite-data-layer + check-web-vite-presentational.
 * See apps/web-vite/ARCHITECTURE.md.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

/** Files allowed to import `Table` without `SimpleDataTable`/`AtelierTableShell`/`DataTableBody`. */
const WHITELIST = new Set([
  // Shared primitives themselves
  'components/shared/simple-data-table.tsx',
  'components/shared/data-table-body.tsx',
  'components/shared/sortable-table-head.tsx',
  // Inline-edit form (not a data-display surface)
  'components/ocr/line-items-table.tsx',
  // Modal selection table — bespoke selection logic, separate context
  'components/payments/invoice-selection-table/data-table.tsx',
  // Card-embedded mini-tables in detail pages (sub-section context — not list pages)
  'components/settings/e-invoicing/leitweg-id-list-card.tsx',
  'components/contractors/classification/outcome/drv-criterion-breakdown-list.tsx',
  // Deferred Wave-C port (client-side selection + own pagination, embedded in import dialog)
  'components/integrations/google-workspace/directory-preview-table.tsx',
  // Tab subview using raw Table for the "all entries" panel — port deferred.
  // Tracked: pending tab uses ported ApprovalQueueTable; reconciliation uses ported ReconciliationTable.
  'components/time/time-tracking-container.tsx',
  // Container with its own loading-state skeleton variant — delegates render to ported view component
  'components/time/reconciliation-table-container.tsx',
  // Sub-section settings / admin tables — embedded in tabs / cards, not full list pages.
  // Each shares the visual chrome of its parent card; unifying is out of scope for the
  // list-page table format goal. Add new ones here with a one-line reason.
  'components/admin/classification-engine/classification-engine-panel.tsx',
  'components/settings/api-keys-tab.tsx',
  'components/settings/feature-flags-tab.tsx',
  'components/settings/notification-preferences.tsx',
  'components/settings/tax/country-rates-section.tsx',
  'components/settings/tax/wht-certificates-section.tsx',
  'components/settings/e-invoicing/transmissions-log-card.tsx',
  'components/settings/provider-detail-sheet.tsx',
  'components/invoices/einvoice-tab/svrl-issue-list.tsx',
  'components/invoices/einvoice-tab/transmission-section.tsx',
  'components/portal/portal-contract-detail-container.tsx',
  // Dialog / sheet / step tables — modal context, not list pages
  'components/integrations/jira-status-mapping-dialog.tsx',
  'components/integrations/linear-status-mapping-dialog.tsx',
  'components/payments/bank-statement-dialog.tsx',
  'components/import/step-duplicates.tsx',
  'components/import/step-preview.tsx',
  'components/onboarding/people-review-step.tsx',
]);

const SHADCN_TABLE_IMPORT = /from\s+['"]@contractor-ops\/ui\/components\/shadcn\/table['"]/;
const IMPORTS_TABLE = /\bTable\b/;
const APPROVED_SENTINELS = [
  /\bSimpleDataTable\b/,
  /\bAtelierTableShell\b/,
  // DataTableBody covers Card-embedded tables that share the canonical body
  // rendering (skeleton + empty + no-results) without the full shell — see
  // zatca-invoice-chain-table, classification-assessment-list.
  /\bDataTableBody\b/,
];

/** @param {string} relPath POSIX-style path relative to src */
function isWhitelisted(relPath) {
  if (WHITELIST.has(relPath)) return true;
  if (relPath.includes('/__tests__/')) return true;
  // The full canonical data tables (workflow-runs, contractors, contracts,
  // invoices) live alongside their own per-domain helpers; they all wrap in
  // AtelierTableShell so the sentinel check catches them. Nothing to skip.
  return false;
}

/** Find files that import the shadcn Table primitive. */
function walk(dir) {
  /** @type {Array<{ rel: string }>} */
  const violations = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...walk(path));
      continue;
    }
    if (!/\.(tsx?)$/.test(entry.name)) continue;
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    if (isWhitelisted(rel)) continue;
    const text = readFileSync(path, 'utf8');
    // Quick reject — file doesn't import from shadcn/table at all.
    if (!SHADCN_TABLE_IMPORT.test(text)) continue;
    // Locate the matching import block and check it brings in `Table`.
    const importMatch = text.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]@contractor-ops\/ui\/components\/shadcn\/table['"]/,
    );
    if (!importMatch) continue;
    const importedNames = importMatch[1];
    if (!IMPORTS_TABLE.test(importedNames)) continue;
    // File imports `Table` from shadcn — must also reference a sentinel.
    if (APPROVED_SENTINELS.some(pattern => pattern.test(text))) continue;
    violations.push({ rel });
  }
  return violations;
}

const violations = walk(ROOT);
if (violations.length > 0) {
  console.error(`check:web-vite-table-pattern — ${violations.length} violation(s):`);
  for (const hit of violations) {
    console.error(`  apps/web-vite/src/${hit.rel}`);
  }
  console.error(
    '\nEvery data-display table must wrap its <Table> primitive in SimpleDataTable\n' +
      '(small/static lists) or AtelierTableShell + DataTableBody + SortableTableHead\n' +
      '(full-feature). Form-style or sub-section tables can be added to the\n' +
      'WHITELIST in scripts/check-web-vite-table-pattern.mjs with a brief reason.',
  );
  process.exit(1);
}

console.log('check:web-vite-table-pattern — OK');
