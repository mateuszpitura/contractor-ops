---
phase: 94-theme-b-payroll-integration-adapters
plan: 05
subsystem: payroll-export-uk-rti
tags: [payroll, uk, rti, fps, eps, xml, xsd-seam]
requirements: [PAYROLL-UK-01]
dependency_graph:
  requires:
    - "94-01 (contract + DTO)"
    - "94-02 (UK RTI golden fixtures + RED tests)"
    - "94-03 (lib/format escapeXml/isoDate/splitName)"
  provides:
    - "RtiFpsProfile + RtiEpsProfile (payroll.sage-uk)"
    - "non-throwing validateRtiXml seam (bundle-absent passthrough, IRIS model)"
  affects:
    - "94-09 (registerAllPayrollProfiles)"
    - "94-10 (EXTERNAL-ENABLEMENT RTI XSD-bundle row)"
tech_stack:
  added: []
  patterns:
    - "GovTalkMessage -> IRenvelope -> FullPaymentSubmission/EmployerPaymentSummary line-built XML (escapeXml-safe)"
    - "StudentLoan block emitted only when studentLoanPlan is present and != NONE"
    - "PAYE ref '123/AB456' split into OfficeNo/PayeRef"
    - "XSD validate seam non-throwing when the offline HMRC year bundle is absent"
key_files:
  created:
    - "packages/payroll/src/profiles/rti-shared/{constants,xsd-validate}.ts"
    - "packages/payroll/src/profiles/rti-fps/{generator,index}.ts"
    - "packages/payroll/src/profiles/rti-eps/{generator,index}.ts"
  modified:
    - "packages/payroll/src/index.ts (export UK profiles + validate seam)"
decisions:
  - "Export-only (Sage/BrightPay/Moneysoft import); HMRC direct submission deferred to v7.5"
  - "validateRtiXml mirrors IRIS: readdirSync schema-bundle for .xsd; absent -> { ok:true, bundlePresent:false }; present -> structural check (full validator wired at v7.5)"
  - "No new dependency (no libxmljs2 in payroll); the seam is pure fs + string checks"
  - "Validation errors surface as result.warnings, never thrown"
metrics:
  tasks_completed: 3
  files_changed: 7
  completed_date: "2026-07-05"
---

# 94-05 Summary — UK RTI-compatible payroll export

Built the UK RTI file-export profiles (FPS + EPS), turning the UK golden RED tests
GREEN, with a bundle-absent-safe XSD validate seam.

## Shipped
- **RtiFpsProfile** (`payroll.sage-uk`) — GovTalkMessage → IRenvelope →
  FullPaymentSubmission XML with one `<Employee>` per feed row (Fore/Sur, NINO,
  StartDate, PayId, TaxCode, and a `<StudentLoan>` block only when a plan other than
  NONE is present), `escapeXml`-safe.
- **RtiEpsProfile** (`payroll.sage-uk`) — the employer-level EmployerPaymentSummary
  envelope.
- **`validateRtiXml`** — a non-throwing seam mirroring the IRIS bundle-absent posture:
  returns `{ ok:true, bundlePresent:false }` when the offline HMRC year XSD is absent
  (the shipping state), a structural result when present, and surfaces any errors as
  `result.warnings` — the export never hard-blocks on a missing schema.

## Verification
- `pnpm -F @contractor-ops/payroll test rti-fps rti-eps` — 5/5 GREEN (XML matched
  line-for-line; non-throwing seam confirmed).
- `pnpm -F @contractor-ops/payroll typecheck` + biome — clean.

Export-only for v7.0 (importable into Sage / BrightPay / Moneysoft); HMRC direct
submission over the Government Gateway is deferred to v7.5. NINO is a market ref in
`countryFields`, never logged.
