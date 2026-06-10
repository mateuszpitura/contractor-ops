#!/usr/bin/env node
/**
 * Round 1 web-vite test fixes: mock export names + toast i18n strings.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'tinyglobby';

const ROOT = new URL('../apps/web-vite/src', import.meta.url).pathname;

const TOAST_REPLACEMENTS = [
  ["'Cost center created'", "'Cost center created.'"],
  ["'Cost center updated'", "'Cost center updated.'"],
  ["'Cost center archived'", "'Cost center archived.'"],
  ["'Project created'", "'Project created.'"],
  ["'Project updated'", "'Project updated.'"],
  ["'Project archived'", "'Project archived.'"],
  ["'Merge resolved'", "'Merge resolved.'"],
  ["'duplicate code'", "'Something went wrong. Please try again.'"],
  ["'conflict'", "'Something went wrong. Please try again.'"],
  ["'budget invalid'", "'Something went wrong. Please try again.'"],
  ["'locked'", "'Something went wrong. Please try again.'"],
  ["'rate-limited'", "'Something went wrong. Please try again.'"],
  ["'network down'", "'Something went wrong. Please try again.'"],
  ["'nope'", "'Something went wrong. Please try again.'"],
];

const MOCK_EXPORT_FIXES = [
  // tab-documents.test.tsx
  [
    "vi.mock('../../../documents/drop-zone.js', () => ({\n  DropZone:",
    "vi.mock('../../../documents/drop-zone.js', () => ({\n  DropZoneContainer:",
  ],
  [
    "vi.mock('../../../documents/document-card.js', () => ({\n  DocumentCard:",
    "vi.mock('../../../documents/document-card.js', () => ({\n  DocumentCardContainer:",
  ],
  // documents-tab.test.tsx
  [
    "DropZone: () => React.createElement('div', { 'data-testid': 'drop-zone' })",
    "DropZoneContainer: () => React.createElement('div', { 'data-testid': 'drop-zone' })",
  ],
  // top-bar.test.tsx — contractor wizard import name
  [
    "vi.mock('../../contractors/contractor-wizard/wizard-dialog.js', () => ({\n  WizardDialogContainer:",
    "vi.mock('../../contractors/contractor-wizard/wizard-dialog.js', () => ({\n  ContractorWizardDialog:",
  ],
];

const FILE_PATCHES = [
  {
    path: 'components/billing/__tests__/proration-preview.test.tsx',
    replacements: [
      ['from \'../proration-preview\';', "from '../proration-preview.js';"],
      [
        `import {
  ProrationPreview,
  ProrationPreviewError,
  ProrationPreviewSkeleton,
} from '../proration-preview.js';`,
        `import {
  ProrationPreviewView,
  ProrationPreviewError,
  ProrationPreviewSkeleton,
} from '../proration-preview.js';`,
      ],
      ['<ProrationPreview\n', '<ProrationPreviewView\n'],
      ['describe(\'ProrationPreview (web-vite)\'', "describe('ProrationPreviewView (web-vite)'"],
    ],
  },
];

let touched = 0;

const testFiles = globSync('**/*.{test,spec}.{ts,tsx}', { cwd: ROOT, absolute: true });
for (const abs of testFiles) {
  let text = readFileSync(abs, 'utf8');
  const before = text;
  for (const [from, to] of TOAST_REPLACEMENTS) {
    text = text.replaceAll(from, to);
  }
  for (const [from, to] of MOCK_EXPORT_FIXES) {
    text = text.replaceAll(from, to);
  }
  if (text !== before) {
    writeFileSync(abs, text);
    touched++;
  }
}

for (const { path, replacements } of FILE_PATCHES) {
  const abs = `${ROOT}/${path}`;
  let text = readFileSync(abs, 'utf8');
  const before = text;
  for (const [from, to] of replacements) {
    text = text.replaceAll(from, to);
  }
  if (text !== before) {
    writeFileSync(abs, text);
    touched++;
  }
}

console.log(`fix-web-vite-tests-round1 — updated ${touched} file(s)`);
