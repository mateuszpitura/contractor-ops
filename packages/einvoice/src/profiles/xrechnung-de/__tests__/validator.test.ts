// packages/einvoice/src/profiles/xrechnung-de/__tests__/validator.test.ts
//
// Phase 61 · Plan 61-01 Task 3 — RED scaffold.
//
// Plan 03 creates `packages/einvoice/src/profiles/xrechnung-de/validator.ts`
// wrapping the three-layer KoSIT pipeline (libxmljs2 XSD → saxon-js EN 16931
// Schematron → saxon-js XRechnung CIUS Schematron). This file lists the
// layer-level behavioural expectations Plan 03 must satisfy.

import { describe } from 'vitest';

describe.todo(
  'XRechnung validator — three-layer pipeline: XSD → EN 16931 Schematron → XRechnung CIUS Schematron',
);

describe.todo(
  'XRechnung validator — short-circuits on layer-1 XSD fatal error (does not run layer 2/3)',
);

describe.todo(
  'XRechnung validator — positive fixture `kosit-positive-minimal.xml` returns { status: "VALID" } across all three layers',
);

describe.todo(
  'XRechnung validator — negative fixture `kosit-negative-missing-bt10.xml` returns layer-3 errors with rule ID BR-DE-*',
);

describe.todo(
  'XRechnung validator — negative fixture `kosit-negative-bad-currency.xml` returns layer-2 error with rule ID BR-DE-17',
);
