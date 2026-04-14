// packages/einvoice/src/profiles/xrechnung-de/__tests__/svrl-normalizer.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 03 creates `packages/einvoice/src/profiles/xrechnung-de/svrl-normalizer.ts`
// which flattens raw SVRL (Schematron Validation Report Language) output into
// the typed `XRechnungValidationReport` shape consumed by the EInvoice tab UI
// (D-14 structured summary).

import { describe } from 'vitest';

describe.todo(
  'SVRL normalizer — extracts ruleId, severity, message, xpath from failed-assert + successful-report nodes',
);

describe.todo(
  'SVRL normalizer — caps first-20 issues on validationReportSummary.issues (D-14)',
);

describe.todo(
  'SVRL normalizer — aggregates per-layer status (VALID / WARNINGS / INVALID) from severity distribution',
);
