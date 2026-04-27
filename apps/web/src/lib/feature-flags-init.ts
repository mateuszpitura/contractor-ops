// apps/web/src/lib/feature-flags-init.ts
//
// Phase 64 D-10 — Register the classification disclaimer gate at app boot.
// Called by importing this module in apps/web/src/app/layout.tsx.
//
// Keeps packages/feature-flags free of a compile-time dependency on
// packages/validators (avoids circular dep risk). The gate callback is
// registered here, at the app layer, where both packages are available.

import {
  assertFlagSignoffsOrExit,
  registerClassificationDisclaimerGate,
} from '@contractor-ops/feature-flags';
import { isAllApproved } from '@contractor-ops/validators';

// Register once at module load — this file is imported by the Next.js root
// layout which is evaluated once per server process.
registerClassificationDisclaimerGate(isAllApproved);

// Boot-gate (Phase 64 D-10): hard-fails the process when a gated-namespace
// flag lacks a signoff entry. Previously a side effect of importing the
// feature-flags package; relocated here so the package import stays pure.
assertFlagSignoffsOrExit();
