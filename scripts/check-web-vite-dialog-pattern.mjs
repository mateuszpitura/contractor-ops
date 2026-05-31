#!/usr/bin/env node
/**
 * CI gate — enforces the canonical scrollable-dialog layout in apps/web-vite.
 *
 * Rule (scoped to apps/web-vite/src/, excluding __tests__/):
 *   Any file that renders the Dialog primitive (`<DialogContent`) MUST wrap
 *   its scrollable content in `<DialogBody>`. DialogBody is
 *   `flex-1 min-h-0 overflow-y-auto` (see packages/ui/.../dialog.tsx), so the
 *   body scrolls internally while `<DialogFooter>` (`mt-auto`) stays pinned —
 *   tall dialogs no longer overflow the viewport or push actions off-screen.
 *
 *   The literal `<DialogContent` intentionally does NOT match
 *   `<AlertDialogContent` — AlertDialog is for short, non-scrolling
 *   confirmations and is out of scope.
 *
 * Migration grace: files in MIGRATION_ALLOW are not-yet-converted and are
 * skipped. The list shrinks to empty as the sweep completes; a converted
 * file must be removed from it (the gate then guards against regressions).
 *
 * PERMANENT_ALLOW holds compositional hosts that render `<DialogContent>` but
 * delegate `<DialogBody>`/`<DialogFooter>` to their step/children (e.g. the
 * payment-run wizard shell).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

// Permanently exempt — dialogs that legitimately cannot/should not wrap a
// <DialogBody>:
//   - compositional hosts: render <DialogContent> but delegate body/footer to
//     step components passed as children;
//   - delegated forms: body + actions live inside a shared form container;
//   - confirm dialogs: header + footer only, no scrollable body to wrap.
const PERMANENT_ALLOW = new Set([
  // Compositional wizard shells (body/footer in the step children).
  'components/payments/new-payment-run-dialog/new-payment-run-dialog-view.tsx',
  'components/payments/bank-statement-dialog.tsx',
  // Body + actions owned by a shared CarrierCredentialFormContainer.
  'components/settings/dpd-provider-section.tsx',
  'components/settings/ups-provider-section.tsx',
  // Confirm dialogs — header + footer only, no body content.
  'components/equipment/equipment-detail/equipment-detail-header.tsx',
  'components/equipment/equipment-list-container.tsx',
]);

// Not-yet-converted files. Remove each entry as it gains a <DialogBody>.
// Target end state: empty (sweep complete).
const MIGRATION_ALLOW = new Set([]);

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const offenders = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      offenders.push(...walk(path));
      continue;
    }
    if (!entry.name.endsWith('.tsx')) continue;
    const rel = relative(ROOT, path).replaceAll('\\', '/');
    if (PERMANENT_ALLOW.has(rel) || MIGRATION_ALLOW.has(rel)) continue;
    const src = readFileSync(path, 'utf8');
    if (src.includes('<DialogContent') && !src.includes('<DialogBody')) {
      offenders.push(rel);
    }
  }
  return offenders;
}

const offenders = walk(ROOT).sort();

if (offenders.length > 0) {
  console.error(
    `\ncheck:web-vite-dialog-pattern — ${offenders.length} dialog(s) render <DialogContent> ` +
      'without wrapping content in <DialogBody>:\n',
  );
  for (const rel of offenders) {
    console.error(`  apps/web-vite/src/${rel}`);
  }
  console.error(
    '\nWrap the content between <DialogHeader> and <DialogFooter> in <DialogBody> so it ' +
      'scrolls internally and the footer stays sticky. See ' +
      'components/payments/new-payment-run-dialog/step-select.tsx for the pattern.\n',
  );
  process.exit(1);
}

console.log('check:web-vite-dialog-pattern — OK');
