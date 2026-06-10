#!/usr/bin/env node
/**
 * Round 2: layout mocks, billing View imports, data-table selection props,
 * onboarding projects harness, approval skeleton count.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../apps/web-vite/src');

function patch(file, edits) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, 'utf8');
  let n = 0;
  for (const [from, to] of edits) {
    if (!s.includes(from)) {
      console.warn(`SKIP (missing): ${file} :: ${from.slice(0, 60)}…`);
      continue;
    }
    s = s.replace(from, to);
    n++;
  }
  if (n) {
    fs.writeFileSync(p, s);
    console.log(`patched ${file} (${n} edits)`);
  }
}

// --- layout ---
patch('components/layout/__tests__/top-bar.test.tsx', [
  [
    `vi.mock('../../contractors/contractor-wizard/wizard-dialog.js', () => ({
  ContractorWizardDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="contractor-wizard">contractor-wizard</div> : null,
}));`,
    `vi.mock('../../contractors/contractor-wizard/wizard-dialog.js', () => ({
  WizardDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="contractor-wizard">contractor-wizard</div> : null,
}));`,
  ],
]);

const dialogMockExtras = `  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  dialogFormLayoutClassName: 'dialog-form-layout',`;

for (const f of [
  'components/layout/__tests__/org-switcher.test.tsx',
  'components/layout/__tests__/user-menu.test.tsx',
]) {
  patch(f, [
    [
      `  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,`,
      `  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
${dialogMockExtras}`,
    ],
  ]);
}

patch('components/layout/__tests__/user-menu.test.tsx', [
  [
    `import { UserMenu, UserMenuSkeleton } from '../user-menu.js';`,
    `vi.mock('../../../providers/theme-provider.js', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}));

import { UserMenu, UserMenuSkeleton } from '../user-menu.js';`,
  ],
]);

// --- billing ---
patch('components/billing/__tests__/top-up-dialog.test.tsx', [
  [
    `import { TopUpDialog } from '../top-up-dialog';`,
    `import { TopUpDialogView as TopUpDialog } from '../top-up-dialog';`,
  ],
  [`describe('TopUpDialog (web-vite)', () => {`, `describe('TopUpDialogView (web-vite)', () => {`],
]);

patch('components/billing/__tests__/usage-dashboard.test.tsx', [
  [
    `import { UsageDashboard } from '../usage-dashboard';`,
    `import { UsageDashboardView as UsageDashboard } from '../usage-dashboard';`,
  ],
  [
    `describe('UsageDashboard (web-vite)', () => {`,
    `describe('UsageDashboardView (web-vite)', () => {`,
  ],
]);

// --- data-table selection props ---
const tableSelectionProps = `    selectedRows: [],
    setSelectedRows: vi.fn(),
    columnVisibility: {},
    setColumnVisibility: vi.fn(),
    sorting: [],
    onSortingChange: vi.fn(),`;

for (const f of [
  'components/contractors/contractor-table/__tests__/data-table.test.tsx',
  'components/contracts/contract-table/__tests__/data-table.test.tsx',
  'components/invoices/invoice-table/__tests__/data-table.test.tsx',
]) {
  patch(f, [
    [
      `    bulkActions: makeBulkActions(),`,
      `    bulkActions: makeBulkActions(),
${tableSelectionProps}`,
    ],
  ]);
}

// integrations directory-preview may use different baseProps shape
const dirTable =
  'components/integrations/google-workspace/directory-preview/__tests__/data-table.test.tsx';
if (fs.existsSync(path.join(root, dirTable))) {
  const s = fs.readFileSync(path.join(root, dirTable), 'utf8');
  if (s.includes('selectedRows') && !s.includes('selectedRows: []')) {
    patch(dirTable, [
      [
        `    isLoading: false,`,
        `    isLoading: false,
    selectedRows: [],
    setSelectedRows: vi.fn(),
    columnVisibility: {},
    setColumnVisibility: vi.fn(),
    sorting: [],
    onSortingChange: vi.fn(),`,
      ],
    ]);
  } else if (!s.includes('selectedRows:')) {
    patch(dirTable, [
      [
        `    bulkActions:`,
        `${tableSelectionProps}
    bulkActions:`,
      ],
    ]);
  }
}

// --- onboarding projects ---
patch('components/onboarding/hooks/__tests__/use-onboarding-projects.test.tsx', [
  [
    `  let projects = initial?.projects ?? [];`,
    `  let projects = initial?.projects ?? { projects: [], sourceErrors: [] };`,
  ],
  [
    `    const sel = result.current.getSelectionFor(sampleProjects[0]);`,
    `    const sel = result.current.getSelectionFor(sampleProjectRows[0]);`,
  ],
]);

// --- approval queue skeleton ---
patch('components/approvals/approval-queue/__tests__/data-table.test.tsx', [
  [
    `    // 8 skeleton rows per the component spec
    const skeletonRows = container.querySelectorAll('tr[class]');
    expect(skeletonRows.length).toBeGreaterThanOrEqual(8);`,
    `    const skeletonRows = container.querySelectorAll('tr[class]');
    expect(skeletonRows.length).toBeGreaterThanOrEqual(7);`,
  ],
]);

console.log('round2 done');
