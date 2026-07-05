# Phase 94: Theme B — Payroll Integration Adapters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 94-theme-b-payroll-integration-adapters
**Areas discussed:** Adapter home, Native-API scope + ADP risk, Export payload, Format fidelity + validation

---

## Adapter Home (Architecture)

| Option | Description | Selected |
|--------|-------------|----------|
| New `packages/payroll` (mirror einvoice) | PayrollExportProfile interface + registerProfile/getProfile registry + engine, like packages/einvoice (KSeF/ZATCA/Peppol). Each target = one profile. | ✓ |
| Extend payment-export factory | Add payroll formats to `_generateExportFileForFormat` switch + PaymentExportFormat enum. | |
| Split file-export vs native-API | File profiles in packages/payroll; native targets in packages/integrations. | |

**User's choice:** New `packages/payroll` mirroring einvoice.
**Notes:** Payroll data shape ≠ payment-run/bank-file — don't overload payment-export. Reuse the profile-registry *pattern*, not the module. (Native Gusto/QuickBooks still ride packages/integrations for OAuth — see next area.)

---

## Native-API Scope + ADP Lead-Time Risk

| Option | Description | Selected |
|--------|-------------|----------|
| File-export floor all 8, native later | All 8 file-export; native as seam behind flags; ADP → v7.1. | |
| File all + Gusto/QuickBooks native now | File for PL/DE/UK/ADP; build Gusto + QuickBooks native OAuth REST this phase; DATEV REST + ADP export-only/deferred. | ✓ |
| Attempt all native where API exists | Native for every target with a public API now. | |

**User's choice:** File-export floor for all 8 + Gusto + QuickBooks native API this phase.
**Notes:** Gusto/QuickBooks native adapters on packages/integrations (OAuth + encrypted creds). DATEVconnect REST = seam "where subscribed". ADP native → v7.1 flag-defer (Marketplace + mTLS lead-time); v7.0 ADP = CSV export only. Native live calls behind per-adapter flags + conditional-skip tests per the external-deps invariant.

---

## Export Payload — What "Payroll Data" Is

| Option | Description | Selected |
|--------|-------------|----------|
| Master-data feed from EmployeeProfile | Employee master data (IDs, tax class/code, gross rate, etat, bank, start/end) from P90 + P93 events; no computed net/tax. | ✓ |
| Master-data + period hours/leave | Add per-period hours (P92) + approved leave/absences. | |
| Let planner scope the field set | Lock "no computed payroll math" only; leave field matrix to planner. | |

**User's choice:** Master-data feed from EmployeeProfile (P90) + on/offboarding events (P93).
**Notes:** No period hours/leave in v7.0 (P92 stays out unless a target format requires it). No gross→net / tax amounts — the incumbent system computes from the pushed master data.

---

## Format Fidelity + Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Golden-file fixtures + spec-validate | Hand-build to real spec (DATEV ASCII, UK RTI FPS/EPS XML, Symfonia CSV/XML), validate against golden fixtures — mirror P86 IRIS-XSD. | ✓ |
| Structural fixtures, defer strict schema | Correct structure + mappings with round-trip tests; defer strict statutory schema validation. | |
| Planner decides per target | Set validation depth per adapter based on spec availability. | |

**User's choice:** Golden-file fixtures + spec-validate per target.
**Notes:** Mirror Phase 86 IRIS approach (buildIrisXml + xsdValidate, non-throwing when the offline bundle is absent). Statutory format rules carry adviser-verify annotations; legal sign-off deferred (local-only) — do not hard-block on Steuerberater/doradca approval.

## Claude's Discretion

- Exact `PayrollExportProfile` interface + result type; whether native profiles delegate to an integrations adapter.
- Canonical `PayrollFeed` DTO shape + per-target required/optional field matrix.
- Flag-granularity gap: PAYROLL-DE-02 (Sage DE) has no dedicated flag; UK BrightPay/Moneysoft grouped under `payroll.sage-uk` — reuse market flag or add `payroll.sage-de`.
- Whether Gusto/QuickBooks register in payroll registry, integrations registry, or bridge both.
- Export trigger surface + UI reuse (payment-export download vs new HR surface).
- Seed source/shape for any per-target code lists.

## Deferred Ideas

- ADP native API → v7.1 (Marketplace + mTLS).
- DATEVconnect REST live push → "where subscribed".
- Period movement data (hours/leave) in payload → only if a target format requires it.
- HMRC RTI direct submission (PAYROLL-UK-02) → v7.5.
- PL e-ZLA / DE eAU payroll push (LEAVE-04/05) → v7.5.
- Workday / Paychex / Rippling-payroll adapters → v8.0+.
- Own payroll engine → never (unless integration friction proves dispositive).
