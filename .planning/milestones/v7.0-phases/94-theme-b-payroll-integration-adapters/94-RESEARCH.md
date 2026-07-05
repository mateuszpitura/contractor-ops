# Phase 94: Theme B — Payroll Integration Adapters - Research

**Researched:** 2026-07-05
**Domain:** Per-market payroll EXPORT adapters (PL/DE/UK/US) — deterministic file-export profiles + Gusto/QuickBooks native OAuth; NO own payroll engine.
**Confidence:** HIGH (all reuse seams verified against in-tree source at current HEAD)

## Summary

Phase 94 is a **reuse-the-pattern, build-the-content** phase. Every reuse seam the CONTEXT names already exists and was read at source:

- The **profile-registry engine** to clone lives in `packages/einvoice` — `registerProfile`/`getProfile`/`listProfiles`/`clearProfiles` `[VERIFIED: packages/einvoice/src/registry.ts:31-64]`, the `EInvoiceEngine` orchestrator that only calls `profile.generate(...)` and never contains country code `[VERIFIED: packages/einvoice/src/engine/engine.ts:16-60]`, and the `EInvoiceProfile` interface with per-profile `readonly profileId`/`country`/`displayName` + a widened `generate(invoice, opts?: unknown)` `[VERIFIED: packages/einvoice/src/types/profile.ts:59-95]`. `packages/payroll` is a structural clone: swap `EInvoice`→`PayrollFeed`, `generate→{buffer,ext,mime}`.
- The **file-format generators** to model each target on live in `packages/api/src/services/payment-export.ts` — pure functions returning `Buffer` for CSV (`generateCsv` via exceljs + UTF-8 BOM `[VERIFIED: :154-194]`), Elixir flat-file `[VERIFIED: :205-244]`, SEPA/SWIFT/Fedwire XML `[VERIFIED: :253-440]`, and the two **hand-rolled fixed-width** files with hard length-guards + control totals + transliteration warnings (BACS Std 18 `[VERIFIED: :656-727]`, NACHA `[VERIFIED: :911-1071]`). These are the exact idiom for DATEV Lohn ASCII / Symfonia CSV / RTI XML.
- The **format-switch download idiom** is `_generateExportFileForFormat(format, items, orgBank, runRef) → {fileBuffer, ext, warnings?}` `[VERIFIED: packages/api/src/routers/finance/payment-shared.ts:233-263]` — the payroll engine's dispatch analog (profileId→profile.generate) plus the download plumbing to reuse for a file result.
- The **native-API framework** for Gusto/QuickBooks is `packages/integrations` — the `IntegrationProviderAdapter` contract (OAuth + webhooks + health) `[VERIFIED: packages/integrations/src/types/provider.ts:39-77]`, `OAuthConfig` (env-var-named client id/secret, scopes, redirect path) `[VERIFIED: :17-32]`, and the lazy/heavy adapter registration in `register-all.ts` `[VERIFIED: packages/integrations/src/adapters/register-all.ts:69-140]`. No new auth/credential plumbing is needed — Gusto/QuickBooks OAuth ride the same rails as Clockify/Google-Workspace.
- The **8 `payroll.*` ship-dark flags already exist** — keys defined in `packages/feature-flags/src/flags-core.ts:336+` (`payroll.symfonia|comarch|enova|datev|sage-uk|gusto|quickbooks|adp`, category `payroll`, owner `payroll-platform`), signoff PENDING in `signoff-registry-flags.json:142-173`, and the `payroll` category is in `schemas.ts:15`. Wire the gate, do not invent keys (the one exception is the discretionary `payroll.sage-de` — see Open Questions).

**The single most important finding:** the export payload is a **join of three already-shipped models** — no new source data is needed. The feed reads `Worker.displayName`/`email` `[VERIFIED: packages/db/prisma/schema/worker.prisma:23-24]`, `EmployeeProfile.countryCode`/`countryFields` JSON / promoted `etat`/`employmentStatus`/`saudizationCategory` / encrypted `*Last4` `[VERIFIED: packages/db/prisma/schema/employee.prisma:20-56]`, and the **hire/termination anchors on `PersonnelFile.hireDate`/`.terminatedAt`** `[VERIFIED: packages/db/prisma/schema/personnel.prisma:49-50]` — which the CONTEXT calls "Phase 93 on/offboarding events". `terminatedAt` does **not** live on `EmployeeProfile` (a common wrong assumption); it is the `PersonnelFile` termination anchor populated by offboarding. The per-market field vocabulary is already codified in `employeeCountryFieldsSchemaMap` `[VERIFIED: packages/validators/src/employee-country-fields.ts:189-196]` — PL (`stanowisko`/`etat`/`urzadSkarbowyCode`/`zusTitleCode`/`nfzOddzial`/`stawkaBrutto`), DE (`lohnsteuerklasse`/`kirchensteuer`/`steuerIdNr`/`svNummer`/`krankenkasse`/`kinderfreibetrag`), GB (`taxCode`/`studentLoanPlan`/`niNumber`/`payeReference`/`pensionEnrolled`), US (`filingStatus`/`stateWithholding`/`stateOther`).

**The second finding (external-dep scoping):** exactly **two** targets carry a real external dependency this phase — Gusto and QuickBooks native OAuth (needs a partner OAuth app + client secret) — and both are flag-deferred behind their existing per-adapter flag with conditional-skip live tests; the **CSV file-export path is the buildable-now floor for all 8 targets**, and ADP native (Marketplace approval + mTLS) is fully deferred to v7.1 with only the CSV export shipping in v7.0. The deterministic file-export core (PL/DE/UK/ADP-CSV + Gusto/QuickBooks CSV fallback) has **zero** external dependency and is testable now against golden fixtures — mirroring the Phase 86 IRIS `buildIrisXml` + non-throwing `xsdValidate` posture `[VERIFIED: packages/iris/src/__tests__/fixtures/golden-1099-nec.json; xsd-bundle-present.ts]`.

**Primary recommendation:** stand up `packages/payroll` (interface + `PayrollFeed` DTO + registry + engine) as a foundation gate; seed a RED golden-fixture validation net for every target; build the deterministic file-export profiles (PL/DE/UK/US-CSV) as the shipping floor; add Gusto + QuickBooks native adapters on `packages/integrations` behind their dark flags with conditional-skip live tests; then wire the tRPC export procedure + feed-builder + `register-all` + audit + download + a light HR export surface; finish with docs-follow-code (wiki + MEMORY + EXTERNAL-ENABLEMENT rows).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New **`packages/payroll`** package mirroring `packages/einvoice`'s profile-registry engine (`PayrollExportProfile` interface + `registerProfile`/`getProfile`/`listProfiles` + a thin engine resolving profileId→profile). Each of the 8 targets registers as one profile on import. **Do NOT overload the payment-export factory** (`_generateExportFileForFormat` / `PaymentExportFormat`): that is payment-run/bank-file oriented; payroll export is employee master-data oriented. Reuse the *pattern*, not the module.
- **D-02:** File-export is the v7.0 floor for all 8 targets; **add Gusto + QuickBooks native API this phase** as `IntegrationProviderAdapter`s on the `packages/integrations` framework (OAuth + AES-256-GCM credential storage + health), invoked by the payroll engine when the org has connected. File/CSV export remains their fallback. **DATEVconnect REST** is a wired seam filled "where subscribed" — not a v7.0 deliverable.
- **D-03:** **ADP native API → v7.1 flag-defer** (Marketplace partner approval + mTLS lead-time). v7.0 ships ADP **CSV file-export only**; the native seam stays dark behind `payroll.adp`. Never stall the phase on account/enrollment/partner approval — ship the floor, defer the live path.
- **D-04:** The export is an **employee master-data feed**, not computed payroll. Fields map from the Phase 90 `EmployeeProfile` (per-market tax class/code, gross rate, `etat`, bank/statutory IDs) plus Phase 93 on/offboarding anchors (hire date, termination date). **No period hours/leave/absences in v7.0** (P92 stays out unless a target format requires movement data). **No gross→net, no tax amounts** — the incumbent system computes those.
- **D-05:** **Hand-build each format against its real spec; validate in tests against golden fixtures** — mirror the Phase 86 IRIS-XSD approach (`buildIrisXml` + `xsdValidate`, non-throwing when the bundle is absent). Per target: DATEV Lohn ASCII layout, UK RTI FPS/EPS XML, Symfonia CSV/XML column contract, Comarch/Enova/Sage mappings, Gusto/QuickBooks API payload shape. Each adapter ships golden-file round-trip fixtures. Statutory format rules carry **adviser-verify** annotations (legal sign-off deferred — do not hard-block).
- **D-06:** Whole surface gated on **`module.workforce-employees`** (Theme B umbrella) **plus** the per-adapter `payroll.*` flags (category `payroll`; flip APPROVED post-deploy; dev with `FLAG_SIGNOFF_BYPASS=local`). Native Gusto/QuickBooks live calls sit behind their per-adapter flag with conditional-skip tests.
- **D-07:** Tenant `organizationId` from session; `writeAuditLog` on every payroll-export action; Zod `.strict()` on export procedures; no `console.*`; statutory PII (SSN/PESEL/etc.) never logged — masked in the export payload, full reveal only via the P90 `employeePii:read` path.
- **D-08:** Reuse — `packages/einvoice` profile-registry, `packages/integrations` adapter framework, existing payment-export download/UI plumbing. Documentation-follows-code: new package + adapters → wiki (`structure/packages.md`, domain page, `patterns/feature-flags.md`) in the same change set.

### Claude's Discretion
- Exact `PayrollExportProfile` interface surface + result type; whether native profiles delegate to an integrations adapter or bridge both registries.
- The canonical `PayrollFeed` DTO shape + per-target required/optional field matrix.
- Flag-granularity gap: PAYROLL-DE-02 (Sage DE) has no dedicated flag; UK BrightPay/Moneysoft grouped under `payroll.sage-uk` — reuse market flag or add `payroll.sage-de`.
- Whether Gusto/QuickBooks register in payroll registry, integrations registry, or both.
- Export trigger surface + UI reuse (payment-export download vs a new HR surface).
- Seed source/shape for any per-target code lists.

### Deferred Ideas (OUT OF SCOPE)
- ADP native API → v7.1 (Marketplace + mTLS); v7.0 = ADP CSV export only.
- DATEVconnect REST live push → "where subscribed"; v7.0 = DATEV ASCII file-export.
- Period movement data (hours/leave from P92) → only if a target format requires it.
- HMRC RTI direct submission (PAYROLL-UK-02, Government Gateway OAuth) → v7.5; v7.0 = RTI-compatible XML export-only.
- PL e-ZLA / DE eAU payroll push (LEAVE-04/05) → v7.5.
- Workday / Paychex / Rippling-payroll adapters → v8.0+.
- Own payroll engine → never (unless integration friction proves dispositive).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAYROLL-PL-01 | Symfonia Kadry i Płace export (CSV + XML) | New `SymfoniaProfile` in `packages/payroll` (§Pattern 1); CSV via the `generateCsv` exceljs+BOM idiom `[VERIFIED: payment-export.ts:154-194]`, XML via the string-builder idiom `[VERIFIED: :276-301]`. Fields from PL `employeeCountryFieldsSchemaMap` `[VERIFIED: employee-country-fields.ts:42-63]`. Gate `payroll.symfonia`. |
| PAYROLL-PL-02 | Comarch ERP XL / Optima export | `ComarchProfile` — Optima "Płace" import CSV/XML column contract; same registry + feed source. Gate `payroll.comarch`. |
| PAYROLL-PL-03 | Enova365 export | `EnovaProfile` — enova365 kadry-płace import layout. Gate `payroll.enova`. |
| PAYROLL-DE-01 | DATEV Lohn und Gehalt export (ASCII import + DATEVconnect REST where subscribed) | `DatevProfile` — DATEV LODAS/Lohn ASCII fixed-field layout, modelled on the BACS/NACHA fixed-width idiom `[VERIFIED: payment-export.ts:656-727,911-1071]`; DATEVconnect REST = **dark seam** (D-02). Fields from DE `employeeCountryFieldsSchemaMap` `[VERIFIED: employee-country-fields.ts:75-93]`. Gate `payroll.datev`. |
| PAYROLL-DE-02 | Sage HR / Personalwirtschaft export | `SageDeProfile` — Sage DE Personalwirtschaft import CSV. Gate: reuse `payroll.datev` (market) OR add `payroll.sage-de` (recommended — see Open Q1). |
| PAYROLL-UK-01 | Sage / BrightPay / Moneysoft (RTI-compatible FPS/EPS XML) | `RtiFpsProfile`/`RtiEpsProfile` — HMRC RTI FPS/EPS XML built on the SEPA/SWIFT string-builder idiom `[VERIFIED: payment-export.ts:253-376]`; optional RTI XSD validate seam, non-throwing when bundle absent (mirror IRIS). Fields from GB `employeeCountryFieldsSchemaMap` `[VERIFIED: employee-country-fields.ts:104-118]`. Gate `payroll.sage-uk` (the UK RTI-export family). |
| PAYROLL-US-01 | Gusto + QuickBooks Payroll + ADP (CSV mappings + native API where available) | ADP + Gusto/QuickBooks **CSV file-export** profiles in `packages/payroll` (floor); **Gusto + QuickBooks native OAuth** adapters on `packages/integrations` (§Pattern 4); ADP native deferred v7.1. Fields from US `employeeCountryFieldsSchemaMap` `[VERIFIED: employee-country-fields.ts:129-141]`. Gates `payroll.gusto`/`payroll.quickbooks`/`payroll.adp`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Payroll export profile contract + registry + engine | Shared package (`packages/payroll`) | — | Structural clone of `packages/einvoice`; country logic lives in profiles, engine stays generic. |
| Deterministic file-format generation (CSV/XML/ASCII) | Shared package (`packages/payroll/profiles/*`) | — | Pure `PayrollFeed → {buffer,ext,mime}` functions; no I/O, no credentials — testable against golden fixtures. |
| `PayrollFeed` assembly (Prisma → DTO) | API / Backend (`packages/api` service) | DB (read `EmployeeProfile`/`Worker`/`PersonnelFile`) | Reads three tenant-owning models; masks PII; produces the DTO profiles map from. |
| Payroll export trigger + download | API / Backend (tRPC procedure) | Storage (optional R2 for archived exports) | Zod-strict input, flag gate, audit, `_generateExportFileForFormat`-style download reuse. |
| Native Gusto/QuickBooks push | Integrations tier (`packages/integrations` adapters) | API (engine bridge) | OAuth + encrypted creds + health already solved by the framework; live path flag-deferred. |
| Per-adapter flag gate | Feature-flags (`@contractor-ops/feature-flags`) | API middleware | 8 `payroll.*` keys exist; wire evaluation + signoff. |
| Cross-cutting tenancy / flag gate | API middleware | — | `assertWorkforceEnabled` + `withTenantScope` on every read; conditional `root.ts` spread. |
| Export UI hint surface | Client / SPA (`apps/web-vite`) | — | Thin Page→Container→Hook→Component; loading/empty/error + i18n parity. |

## Standard Stack

### Core (all already installed — NO new external packages required for the file-export floor)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `exceljs` | in-tree | CSV generation (Symfonia/Comarch/Enova/ADP/Gusto/QuickBooks CSV) | `[VERIFIED: payment-export.ts:155 dynamic import('exceljs')]` — the proven CSV+BOM idiom. |
| `zod` | v4 (in-tree) | `PayrollFeed` schema + strict export-procedure input | `[VERIFIED: employee-country-fields.ts:13, .strict() schemas]` |
| Prisma + `prisma-client` generator | ^7.8.0 | Read `EmployeeProfile`/`Worker`/`PersonnelFile` | `[VERIFIED: packages/db]` |
| `@contractor-ops/integrations` | workspace:* | Gusto/QuickBooks OAuth adapters | `[VERIFIED: register-all.ts, provider.ts]` |
| `@contractor-ops/feature-flags` | workspace:* | `payroll.*` gate | `[VERIFIED: flags-core.ts:336+]` |
| `@contractor-ops/logger` | workspace:* | Structured logging (no `console.*`) | `[VERIFIED: payment-export.ts:8,13]` |

### Supporting (in-tree modules to reuse, not install)
| Module | Path | Purpose |
|--------|------|---------|
| einvoice registry/engine/profile | `packages/einvoice/src/{registry,engine/engine,types/profile}.ts` | The exact shape to clone for `packages/payroll`. |
| payment-export generators | `packages/api/src/services/payment-export.ts` | CSV/flat-file/XML buffer idioms + fixed-width length-guard/control-total pattern. |
| `writeAuditLog` | `packages/api/src/services/audit-writer.ts` | Audit every export mutation. |
| `assertWorkforceEnabled` | `packages/api/src/middleware/require-workforce-flag.ts:25` | Per-request `module.workforce-employees` gate. |
| `integrationProcedure` | `packages/api/src/lib/integration-procedure.ts:16-38` | tRPC procedure factory for integration/settings surfaces. |
| IRIS golden-fixture / bundle-absent seam | `packages/iris/src/__tests__/{fixtures/golden-1099-nec.json,xsd-bundle-present.ts}` | The validate-against-spec, non-throwing-when-bundle-absent model for D-05. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `packages/payroll` | Extend `_generateExportFileForFormat` switch | Payment-export is payment-run/bank-file oriented (per *run*); payroll export is employee master-data oriented (per *employee set*). Overloading it couples two lifecycles. **Rejected by D-01.** |
| `PayrollFeed` DTO the profiles map from | Profiles read Prisma directly | A pure DTO keeps profiles I/O-free + golden-testable (no DB in unit tests) and keeps PII-masking in one place (the feed-builder). **Recommend DTO.** |
| Gusto/QuickBooks in `packages/integrations` only | Register in payroll registry too (bridge) | The payroll engine must be able to dispatch a native target; a thin payroll profile that delegates to the integrations adapter keeps `engine.generate(profileId, feed)` uniform. **Recommend bridge** (payroll profile → integrations adapter). |
| Add `payroll.sage-de` | Reuse `payroll.datev` for Sage DE | DATEV and Sage are distinct DE vendors; conflating them means one flag can't isolate a Sage-only rollout. **Recommend add `payroll.sage-de`** (registry stays source of truth). |

**Installation:** none for the file-export floor. Gusto/QuickBooks native adapters use `fetch` against their REST APIs (mirror the pure-fetch adapters, e.g. Dataport/KSeF) — no vendor SDK required. If a planner elects a vendor SDK, gate the single install behind a `checkpoint:human-verify` task honoring the 7-day `minimumReleaseAge` rule.

## Package Legitimacy Audit

**No external packages are required.** The file-export floor uses only in-tree deps (`exceljs`, `zod`, Prisma, the workspace packages). Gusto/QuickBooks native adapters call their REST APIs with `fetch` (no SDK), matching the existing pure-fetch adapter precedent. slopcheck / registry verification is **not applicable** unless a planner adds a vendor SDK — in which case: 7-day `minimumReleaseAge`, `pnpm audit`, typosquat check, and a `checkpoint:human-verify` gate.

## Architecture Patterns

### System Architecture Diagram

```
              ┌───────────────── HR user (web-vite SPA) ─────────────────┐
              │  payroll export page → container → hook (sole tRPC seam)   │
              └───────────────────────────┬───────────────────────────────┘
                                          │ payroll.export({ targetId, employeeIds })
                                          ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ tRPC payrollExportRouter (staff appRouter, gated)                  │
        │  - assertWorkforceEnabled(org, region)  (module.workforce-employees)│
        │  - evaluate('payroll.<target>')          (per-adapter dark flag)    │
        │  - buildPayrollFeed(db, org, employeeIds) ──────┐                   │
        │  - engine.generate(targetId, feed) ────────┐    │ reads 3 models    │
        │  - writeAuditLog(PAYROLL_EXPORT, …)         │    ▼                   │
        │  - download (buffer, ext, mime)  ◄──────────┤  Worker.displayName/  │
        └──────────────────────────────────┬──────────┤   email               │
                                           │           │  EmployeeProfile.     │
                                           │           │   countryFields/etat/ │
                                           │           │   employmentStatus/   │
                                           │           │   *Last4 (masked)     │
                                           │           │  PersonnelFile.       │
                                           │           │   hireDate/terminatedAt│
                                           ▼           └───────────────────────┘
        ┌──────────────────────────────────────────────────────────────────┐
        │ @contractor-ops/payroll — PayrollExportEngine                      │
        │   getProfile(targetId).generate(feed) → { buffer, ext, mime }      │
        │   (engine never contains country code — clone of EInvoiceEngine)   │
        └───────────────┬───────────────────────────────┬───────────────────┘
                        │ file-export profiles           │ native-API profiles
                        ▼ (deterministic, buildable now)  ▼ (flag-deferred)
   ┌────────────────────────────────────────┐   ┌─────────────────────────────────┐
   │ profiles/{symfonia,comarch,enova}  (PL) │   │ profiles/{gusto,quickbooks}      │
   │ profiles/{datev,sage-de}           (DE) │   │  → bridge to packages/integrations│
   │ profiles/{rti-fps,rti-eps}         (UK) │   │    GustoAdapter / QuickBooksAdapter│
   │ profiles/{adp,gusto-csv,qb-csv}    (US) │   │    (OAuth + encrypted creds)      │
   │  each: PayrollFeed → Buffer (CSV/XML/    │   │  live push behind payroll.gusto / │
   │   ASCII) + golden-fixture round-trip     │   │   payroll.quickbooks; CSV fallback│
   └────────────────────────────────────────┘   └─────────────────────────────────┘
```

### Recommended Project Structure
```
packages/payroll/                          # NEW pkg (mirror packages/einvoice)
├── package.json                           # name @contractor-ops/payroll; deps exceljs, zod, logger
├── tsconfig.json                          # extends tsconfig.node.json; EXCLUDE src/**/__tests__ (RED-safe)
├── src/
│   ├── index.ts                           # public surface + register*Profile() convenience fns
│   ├── registry.ts                        # registerProfile/getProfile/listProfiles/clearProfiles (clone)
│   ├── engine/engine.ts                   # PayrollExportEngine.generate(profileId, feed)
│   ├── types/
│   │   ├── profile.ts                     # PayrollExportProfile interface
│   │   └── feed.ts                        # PayrollFeed DTO + zod schema (canonical intermediate)
│   ├── profiles/
│   │   ├── symfonia/{index,generator,constants}.ts     # PL CSV+XML
│   │   ├── comarch/…  enova/…  datev/…  sage-de/…       # PL/DE
│   │   ├── rti-fps/…  rti-eps/…                          # UK RTI XML (+ optional xsd-bundle seam)
│   │   ├── adp/…  gusto-csv/…  quickbooks-csv/…          # US CSV floor
│   │   └── gusto/…  quickbooks/…                         # native bridge profiles → integrations
│   └── __tests__/
│       ├── registry.test.ts  engine.test.ts             # contract
│       └── fixtures/{symfonia,datev,rti-fps,adp,…}.golden.{csv,xml,txt}  # golden files

packages/integrations/src/adapters/
├── gusto-adapter.ts                       # NEW IntegrationProviderAdapter (OAuth 2.0 REST)
├── quickbooks-adapter.ts                  # NEW IntegrationProviderAdapter (OAuth 2.0 REST)
└── register-all.ts                        # + register Gusto/QuickBooks (HEAVY/lazy tier)

packages/api/src/
├── services/payroll-feed.ts               # buildPayrollFeed(db, org, employeeIds) → PayrollFeed (PII-masked)
├── routers/workforce/payroll-export-router.ts   # NEW tRPC: listTargets, export, connectNative
└── (root.ts)                              # mount under conditionalWorkforceRouters

packages/feature-flags/src/
├── flags-core.ts  signoff-registry-flags.json  schemas.ts   # + payroll.sage-de (if Open Q1 = add)

apps/web-vite/src/components/payroll/
├── hooks/use-payroll-export.ts            # sole tRPC boundary
├── payroll-export-container.tsx           # section loading/empty/error
└── payroll-export-*.tsx                   # presentational (target picker, employee list, download)
```

### Pattern 1: Payroll profile-registry (clone of einvoice)
**What:** A `PayrollExportProfile` self-registers on import; the engine resolves by id and calls `generate`.
```typescript
// packages/payroll/src/types/profile.ts  (clone of EInvoiceProfile [VERIFIED: einvoice/types/profile.ts:59-95])
export interface PayrollExportResult { buffer: Buffer; ext: 'csv' | 'xml' | 'txt'; mime: string; warnings?: string[]; }
export interface PayrollExportProfile {
  readonly profileId: string;      // e.g. 'symfonia', 'datev', 'rti-fps', 'gusto'
  readonly country: string;        // ISO 3166-1 alpha-2 (PL/DE/GB/US)
  readonly displayName: string;    // 'Symfonia Kadry i Płace (PL)'
  readonly flagKey: string;        // 'payroll.symfonia' — the ship-dark gate
  generate(feed: PayrollFeed, opts?: unknown): Promise<PayrollExportResult>;
}
// registry.ts — byte-for-byte the einvoice registry: register/get/list/clear [VERIFIED: einvoice/registry.ts:31-64]
// engine.ts — generate(profileId, feed) { return getProfile(profileId).generate(feed); } [VERIFIED: einvoice/engine/engine.ts:20-23]
```
**Registration:** convenience `registerSymfoniaProfile()` etc. in `index.ts` (mirror `registerKsefProfile` `[VERIFIED: einvoice/index.ts:251-254]`); a `registerAllPayrollProfiles()` called from API boot registers all file-export profiles eagerly (they are pure/cheap).

### Pattern 2: The `PayrollFeed` DTO (canonical intermediate)
**What:** A PII-masked, already-joined employee record the profiles map *from* — profiles never touch Prisma.
```typescript
export interface PayrollFeedEmployee {
  workerId: string; displayName: string; email: string | null;
  countryCode: string;                       // PL | DE | GB | US
  hireDate: string | null;                   // PersonnelFile.hireDate (ISO date) [VERIFIED: personnel.prisma:49]
  terminatedAt: string | null;               // PersonnelFile.terminatedAt      [VERIFIED: personnel.prisma:50]
  employmentStatus: 'ACTIVE'|'ON_LEAVE'|'SUSPENDED'|'TERMINATED' | null;  // [VERIFIED: employee.prisma:58-63]
  etat: string | null;                       // Decimal(3,2) as string          [VERIFIED: employee.prisma:44]
  // national ID: last-4 ONLY in the feed; full value fetched via employeePii:read at generation time IF a
  // format legally requires the full identifier (DATEV SV-Nr, RTI NINO) — otherwise last-4 is what ships.
  nationalIdLast4: string | null;            // pesel/ssn/iqama/emiratesId Last4 [VERIFIED: employee.prisma:33-39]
  countryFields: Record<string, unknown>;    // per-market non-PII payroll refs  [VERIFIED: employee.prisma:25]
}
export interface PayrollFeed { organizationId: string; generatedAt: string; targetCountry: string; employees: PayrollFeedEmployee[]; }
```
**Per-target required-field matrix (from `employeeCountryFieldsSchemaMap` `[VERIFIED: employee-country-fields.ts:189-196]`):**
| Target | Core (Worker/EmployeeProfile/PersonnelFile) | Country fields consumed |
|--------|---------------------------------------------|-------------------------|
| Symfonia / Comarch / Enova (PL) | displayName, hireDate, terminatedAt, etat, peselLast4 (+full PESEL via reveal if the format needs it) | `stanowisko`, `urzadSkarbowyCode`, `zusTitleCode`, `nfzOddzial`, `stawkaBrutto` |
| DATEV / Sage DE | displayName, hireDate, terminatedAt | `lohnsteuerklasse`, `kirchensteuer`, `steuerIdNr`, `svNummer`, `krankenkasse`, `kinderfreibetrag` |
| RTI FPS/EPS (UK) | displayName, hireDate, terminatedAt | `taxCode`, `studentLoanPlan`, `niNumber`, `payeReference`, `pensionEnrolled` |
| ADP / Gusto / QuickBooks (US) | displayName, hireDate, terminatedAt, ssnLast4 (+full SSN via reveal if the API requires it) | `filingStatus`, `stateWithholding`, `stateOther` |

### Pattern 3: Deterministic file generators (model on payment-export)
**CSV** (Symfonia/Comarch/Enova/ADP/Gusto-CSV/QuickBooks-CSV): mirror `generateCsv` — exceljs workbook, per-target column contract, UTF-8 BOM prepend `[VERIFIED: payment-export.ts:154-194]`.
**XML** (Symfonia XML, UK RTI FPS/EPS): mirror the SEPA/SWIFT string-builder with `escapeXml` `[VERIFIED: payment-export.ts:115-122,276-301]`; RTI carries the FPS/EPS envelope (`GovTalkMessage`/`IRenvelope`) hand-built to the HMRC schema, with an **optional** XSD validate seam that is non-throwing when the offline bundle is absent (mirror IRIS `[VERIFIED: iris/__tests__/xsd-bundle-present.ts]`).
**Fixed-width ASCII** (DATEV Lohn/LODAS): mirror the BACS/NACHA idiom — `padField`/`padZero` helpers, exact record-length hard-guard (`assertNachaLen`), control totals, transliteration warnings collected for the UI `[VERIFIED: payment-export.ts:545-552,879-888,656-727]`. DATEV headers use the `DTVF`/`EXTF` CSV-with-header-record convention; the planner pins the exact layout version against the DATEV Lohn import spec and locks it with a golden fixture.
**Every generator is a pure `PayrollFeed → PayrollExportResult`** — no I/O, no credentials, unit-tested against a committed golden file (the RED net).

### Pattern 4: Native OAuth adapter (Gusto / QuickBooks — flag-deferred)
**What:** An `IntegrationProviderAdapter` on `packages/integrations` `[VERIFIED: provider.ts:39-77]` for OAuth connect + encrypted-credential push.
```typescript
export class GustoAdapter implements IntegrationProviderAdapter {
  readonly slug = 'gusto'; readonly displayName = 'Gusto Payroll';
  readonly supportsOAuth = true; readonly supportsWebhooks = false;
  getOAuthConfig(): OAuthConfig {                       // [VERIFIED: OAuthConfig shape provider.ts:17-32]
    return { clientIdEnvVar: 'GUSTO_CLIENT_ID', clientSecretEnvVar: 'GUSTO_CLIENT_SECRET',
             authorizationUrl: 'https://api.gusto.com/oauth/authorize',
             tokenUrl: 'https://api.gusto.com/oauth/token', scopes: [...], redirectPath: '/api/oauth/gusto/callback' };
  }
  async exchangeCodeForTokens(code, redirectUri) { /* fetch tokenUrl → CredentialBlob */ }
  async refreshToken(creds) { /* … */ }
  async getHealthStatus(connectionId) { /* … */ }
}
```
Registered in the **HEAVY/lazy tier** of `register-all.ts` (mirror Clockify) `[VERIFIED: register-all.ts:88-107]`. The payroll engine's `gusto`/`quickbooks` profiles are **bridge profiles**: `generate(feed)` resolves the org's `IntegrationConnection`, and — when `payroll.gusto` is APPROVED and creds exist — POSTs the mapped payload; otherwise returns the CSV fallback. Live-call tests **conditionally skip** when `GUSTO_CLIENT_ID`/creds are absent (auto-flip GREEN when they land), per the external-deps invariant. New env vars → `.env.example` + package env schema.

### Pattern 5: Flag gate + dark mount (mirror workforce surface)
**What:** The whole payroll surface is dark behind `module.workforce-employees`; each target is dark behind its `payroll.*` flag.
```typescript
// tRPC procedure body (per request): [VERIFIED: require-workforce-flag.ts:25-42]
assertWorkforceEnabled(ctx.organizationId, ctx.region);
const gate = evaluate(profile.flagKey, { organizationId: ctx.organizationId, region });
if (!gate.enabled) throw new TRPCError({ code: 'FORBIDDEN', cause: { flag: profile.flagKey } });
```
Mount `payrollExport` inside `conditionalWorkforceRouters` `[VERIFIED: root.ts:185-196]` so it is absent from `appRouter` (METHOD_NOT_FOUND) when `module.workforce-employees` is OFF. The 8 keys already exist `[VERIFIED: flags-core.ts:336+]`; only wiring + the discretionary `payroll.sage-de` addition remain.

### Anti-Patterns to Avoid
- **Overloading `_generateExportFileForFormat` / `PaymentExportFormat`.** Payroll export is a separate lifecycle — clone the *pattern* in `packages/payroll` (D-01).
- **Profiles reading Prisma.** Keep profiles pure over `PayrollFeed` so they are golden-testable and PII stays masked in one builder.
- **Logging PII.** SSN/PESEL/SV-Nr never in logs; feed carries last-4; full value only via the audited `employeePii:read` reveal, only when a format legally requires it.
- **Hard-blocking on a Gusto/QuickBooks/ADP account.** The CSV floor ships dark and fully-tested; native paths are conditional-skip behind their flag.
- **Presenting an export as filing.** Adapters export master data; the incumbent system computes/files. Adviser-verify annotations on statutory format rules; legal sign-off deferred.
- **Inventing new flag keys.** The 8 `payroll.*` keys exist — wire them; add only `payroll.sage-de` if Open Q1 resolves "add".

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profile registry + engine | New registry class | Clone `packages/einvoice/src/{registry,engine/engine}.ts` | Register/get/list/clear + generic engine already proven. `[VERIFIED]` |
| CSV with Excel-safe encoding | Manual CSV string join | `generateCsv` exceljs + BOM idiom | Escaping/encoding/BOM already solved. `[VERIFIED: payment-export.ts:154-194]` |
| Fixed-width record assembly | Ad-hoc padding | `padField`/`padZero` + `assertNachaLen` length-guard | Off-by-one field width = whole-file reject; hard-guard already written. `[VERIFIED: payment-export.ts:545-552,879-888]` |
| XML escaping | Inline replaces | `escapeXml` | Amp/lt/gt/quote/apos already handled. `[VERIFIED: payment-export.ts:115-122]` |
| Spec validation when a bundle is absent | Throwing validator | Non-throwing validate seam (IRIS model) | Ships GREEN without the offline schema bundle; auto-tightens when it lands. `[VERIFIED: iris/__tests__/xsd-bundle-present.ts]` |
| OAuth + encrypted credential storage | New auth plumbing | `IntegrationProviderAdapter` + `getOAuthConfig` | Framework does OAuth exchange/refresh/health + AES-256-GCM store. `[VERIFIED: provider.ts:39-77]` |
| Dark-flag gating | New flag check | `assertWorkforceEnabled` + `evaluate('payroll.*')` + conditional root.ts spread | Three-layer flag-off established (P89). `[VERIFIED: require-workforce-flag.ts, root.ts:185-196]` |
| PII masking | Ad-hoc slicing | Feed carries `*Last4`; reveal via `employeePii:read` | Encrypted columns + audited reveal already exist (P90). `[VERIFIED: employee.prisma:27-39]` |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Reads only (no schema change required for the file-export floor): `Worker`, `EmployeeProfile`, `PersonnelFile`. Optional: a `PayrollExportRun` audit/archive model **only if** the phase wants persisted export history — otherwise the export is stateless + audited via `writeAuditLog`. | None mandatory; if an archive model is added, author an `__`-prefixed un-applied migration (drift-blocked posture) + `db:generate`. |
| Live service config | Gusto/QuickBooks OAuth client id/secret are env vars (not in git); per-org connection lives in `IntegrationConnection.credentialsRef` (AES-256-GCM). | Add `GUSTO_*`/`QUICKBOOKS_*` to `.env.example` + integrations env schema; live path stays dark until set. |
| OS-registered state | None. | None. |
| Secrets/env vars | New: `GUSTO_CLIENT_ID/SECRET`, `QUICKBOOKS_CLIENT_ID/SECRET` (native path only). No new secret for the file-export floor. | `.env.example` + package env schema; `pnpm check:no-process-env` when touching env access. |
| Build artifacts | New workspace package `@contractor-ops/payroll` — must be added to root `tsconfig.json` references + consumed via `workspace:*` in `packages/api`. Prisma client only if an archive model is added. | Wire tsconfig references + api dependency; `pnpm -F @contractor-ops/api typecheck` after. |

**The canonical question — after every file is updated, what runtime state still holds the old assumption?** Only the new-package wiring (tsconfig references + workspace dependency) and (if chosen) the archive-model migration. No cache/queue/OS state.

## Common Pitfalls

### Pitfall 1: New-package tsconfig includes `__tests__` → RED scaffolds brick `tsc`
**What goes wrong:** The einvoice tsconfig `include` is `src/**/*.ts` `[VERIFIED: einvoice/tsconfig.json]`, which pulls test files into `tsc --noEmit`. A Wave-0 RED test importing a not-yet-built profile would fail the package typecheck (Cannot-find-module), not just vitest.
**How to avoid:** The `packages/payroll` tsconfig **excludes `src/**/__tests__/**`** from the start (mirror the api/integrations exclusion Phase 88 added `[VERIFIED: STATE.md 88-01 "excluded src/**/__tests__/** from the integrations tsconfig"]`). Then vitest runs the RED tests while `tsc` ignores them.

### Pitfall 2: `terminatedAt` is on `PersonnelFile`, not `EmployeeProfile`
**What goes wrong:** The feed-builder queries `EmployeeProfile.terminatedAt`/`hireDate` — neither exists there.
**How to avoid:** Hire/termination anchors live on `PersonnelFile.hireDate`/`.terminatedAt` `[VERIFIED: personnel.prisma:49-50]`, joined via `workerId`. The feed-builder joins `Worker` → `EmployeeProfile` (1:1) → `PersonnelFile` (1:1). `EmploymentStatus` on `EmployeeProfile` is a bare enum, not a dated event `[VERIFIED: employee.prisma:45,58-63]`.

### Pitfall 3: PII leakage into export payload / logs
**What goes wrong:** Full PESEL/SSN/SV-Nr lands in the CSV/XML or a log line.
**How to avoid:** Feed carries `*Last4` only `[VERIFIED: employee.prisma:33-39]`. Where a statutory format legally requires the full identifier (DATEV SV-Nr, RTI NINO), fetch it through the audited `employeePii:read` reveal path at generation time and never log it (D-07). Cross-org leak test for any new read.

### Pitfall 4: Cross-org leak on `PayrollFeed` reads (IDOR)
**What goes wrong:** The export reads another org's employees.
**How to avoid:** `Worker`/`EmployeeProfile`/`PersonnelFile` are tenant-owning (absent from `globalModels`, inherit `withTenantScope`) `[VERIFIED: employee.prisma:7-10, personnel.prisma:15-18, worker.prisma:8-10]`. The `employeeIds` input is filtered by `organizationId` from session; add a two-org cross-leak regression test.

### Pitfall 5: Flag-off surface still reachable
**What goes wrong:** The payroll router is callable with `module.workforce-employees` OFF, or a target exports with its `payroll.*` flag PENDING.
**How to avoid:** Mount inside `conditionalWorkforceRouters` (METHOD_NOT_FOUND when OFF) `[VERIFIED: root.ts:185-196]` + per-request `assertWorkforceEnabled` + per-target `evaluate('payroll.<target>')`. Dev with `FLAG_SIGNOFF_BYPASS=local`.

### Pitfall 6: i18n parity + hardcoded-string lint on the export UI
**What goes wrong:** New export-UI strings break `i18n:parity` (en/de/pl/ar + en-US) or trip the hardcoded-string guard.
**How to avoid:** Every user-facing string via `useTranslations` with parity across all locales; target display names come from the profile `displayName` (data, not translated copy) or a keyed label. Mandatory loading/empty/error states.

### Pitfall 7: web-vite data-layer / layering guards
**What goes wrong:** tRPC calls in a Page or Container trip `check:web-vite-data-layer` / `check:web-vite-page-shells`.
**How to avoid:** Page = thin composer (no tRPC); Container calls the domain hook; the hook (`use-payroll-export.ts`) is the sole tRPC boundary; Component is presentational `[VERIFIED: CLAUDE.md §web-vite UI layers]`.

### Pitfall 8: DATEV/RTI format version drift
**What goes wrong:** A hand-built DATEV Lohn or RTI FPS layout silently diverges from the current statutory year's schema.
**How to avoid:** Pin the layout version in a `constants.ts` per profile, lock output with a golden fixture, and annotate the profile with an adviser-verify note (legal sign-off deferred, local-only). The RTI XSD validate seam is non-throwing when the year's bundle is absent (IRIS model) so the export never hard-blocks on a missing schema.

## Code Examples

### Payroll engine (clone of EInvoiceEngine)
```typescript
// packages/payroll/src/engine/engine.ts  — mirrors [VERIFIED: einvoice/engine/engine.ts:16-60]
import { getProfile, listProfiles } from '../registry.js';
export class PayrollExportEngine {
  async generate(profileId: string, feed: PayrollFeed, opts?: unknown): Promise<PayrollExportResult> {
    return getProfile(profileId).generate(feed, opts);
  }
  listTargets(): Array<{ profileId: string; country: string; displayName: string; flagKey: string }> {
    return listProfiles().map(p => ({ profileId: p.profileId, country: p.country, displayName: p.displayName, flagKey: p.flagKey }));
  }
}
```

### Symfonia CSV generator (model on generateCsv)
```typescript
// mirrors [VERIFIED: payment-export.ts:154-194] — exceljs + column contract + UTF-8 BOM
export async function generateSymfoniaCsv(feed: PayrollFeed): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Kadry');
  ws.columns = SYMFONIA_COLUMNS.map(c => ({ header: c.header, key: c.key }));   // pinned column contract
  for (const e of feed.employees) ws.addRow(mapEmployeeToSymfoniaRow(e));
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, Buffer.from(await wb.csv.writeBuffer())]);
}
```

### DATEV Lohn ASCII record (model on the BACS/NACHA length-guard)
```typescript
// mirrors [VERIFIED: payment-export.ts:545-552 padField/padZero + :879-888 assertLen]
function datevRecord(e: PayrollFeedEmployee): string {
  const rec = [ padField(e.displayName, 30), padField(cf(e,'lohnsteuerklasse') ?? '', 2),
                padField(cf(e,'svNummer') ?? '', 12), padField(e.hireDate ?? '', 10) /* … */ ].join(';');
  return rec; // header record 'EXTF'/'DTVF' authored per the DATEV Lohn import spec + golden-locked
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Payroll = out of scope (contractor-only ops) | Per-market payroll EXPORT adapters | Phase 94 (this) | New `packages/payroll`; 8 targets; Gusto/QuickBooks native. |
| Bank-file export only (`payment-export`) | A second export lifecycle for employee master data | Phase 94 | Cloned pattern, disjoint module (D-01). |
| Native integrations = IdP/e-sign/OCR/calendar | + Payroll (Gusto/QuickBooks) on the same framework | Phase 94 | Two new OAuth adapters, flag-deferred. |

**Deprecated/outdated:** none — all reused infra is current (einvoice, integrations, payment-export, feature-flags all shipped pre-v7.0).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PayrollFeed` (PII-masked DTO) is the right intermediate profiles map from | Pattern 2 | If a format needs the full national ID, the feed-builder reveals it via `employeePii:read` at generation — already accounted for. |
| A2 | Gusto/QuickBooks need no vendor SDK (pure `fetch`) | Standard Stack | If a planner prefers an SDK, gate the single install behind `checkpoint:human-verify` + 7-day age; low risk. |
| A3 | `payroll.sage-de` should be added (vs reuse `payroll.datev`) | Open Q1 | Reusing the market flag works but can't isolate Sage-only rollout; registry stays source of truth either way. |
| A4 | The export is stateless (no `PayrollExportRun` model) — audit via `writeAuditLog` | Runtime State | If persisted export history is required, add an archive model + `__`-prefixed migration; discretion. |
| A5 | RTI FPS/EPS ships export-only, XSD validate non-throwing when bundle absent | Pattern 3 / Pitfall 8 | Direct HMRC submission is PAYROLL-UK-02 (v7.5) — out of scope; export-only is the locked v7.0 posture. |
| A6 | DATEVconnect REST is a dark seam, DATEV ASCII is the shipping path | D-02 | Live REST needs a subscription; ASCII file-export ships regardless. |

## Open Questions (RESOLVED)

1. **Flag-granularity gap (Discretion).**
   - Known: PAYROLL-DE-02 (Sage DE) has no dedicated flag; UK BrightPay/Moneysoft grouped under `payroll.sage-uk`. The 8 keys exist `[VERIFIED: flags-core.ts:336+]`.
   - Recommendation: **add `payroll.sage-de`** (Sage DE ≠ DATEV); keep `payroll.sage-uk` as the UK RTI-export family gate (Sage/BrightPay/Moneysoft all import the same RTI FPS/EPS XML). Registry stays source of truth.
   - RESOLVED: add `payroll.sage-de` (Plan 94-04); UK vendors share `payroll.sage-uk` (Plan 94-05).

2. **Where native Gusto/QuickBooks register (Discretion).**
   - Recommendation: **bridge** — the OAuth adapter lives in `packages/integrations`; a thin payroll **profile** (`gusto`/`quickbooks`) registers in the payroll registry and delegates its `generate` to the integrations adapter (or returns the CSV fallback when dark). Keeps `engine.generate(profileId, feed)` uniform across file + native targets.
   - RESOLVED: bridge (Plans 94-07 / 94-08).

3. **Export trigger surface + UI reuse (Discretion).**
   - Recommendation: a **new light HR export surface** (target picker + employee selection + download) with a dedicated hook; reuse the payment-export **download** plumbing (buffer→signed download) for the file result, not its UI. Mandatory loading/empty/error + i18n parity.
   - RESOLVED: new surface + reused download (Plan 94-09).

4. **Export payload = master data only (locked D-04).**
   - RESOLVED: no P92 hours/leave in v7.0; feed = Worker + EmployeeProfile + PersonnelFile anchors.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `packages/einvoice` (pattern source) | `packages/payroll` scaffold | ✓ | in-tree | — |
| `packages/integrations` framework | Gusto/QuickBooks native | ✓ | in-tree | — |
| `exceljs` | CSV profiles | ✓ | in-tree | — |
| 8 `payroll.*` flags | gating | ✓ | `flags-core.ts:336+` | — |
| Phase 90 `EmployeeProfile` + per-market schemas | feed source | ✓ | in-tree | — |
| Phase 91 `PersonnelFile` (hire/terminatedAt) | feed on/off anchors | ✓ | `personnel.prisma:49-50` | — |
| Gusto/QuickBooks OAuth app + client secret | native live push | ✗ (partner setup) | — | **CSV file-export floor ships; live path dark behind `payroll.gusto`/`payroll.quickbooks`** |
| ADP Marketplace partner + mTLS | ADP native | ✗ (v7.1 lead-time) | — | **ADP CSV export ships; native seam dark behind `payroll.adp`** |
| HMRC RTI year XSD bundle | RTI strict validation | ✗ (offline bundle) | — | **Non-throwing validate seam (IRIS model); export ships without it** |

**Missing dependencies with no fallback:** none — every external dependency has a buildable-now fallback (CSV floor / non-throwing validate).
**Missing dependencies with fallback:** Gusto/QuickBooks OAuth creds (→ CSV fallback), ADP native (→ CSV), RTI XSD (→ non-throwing validate).

## Validation Architecture

> `nyquist_validation: true` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) `[VERIFIED: einvoice/package.json test script; payment-export tests]` |
| Config file | `packages/payroll/vitest.config.ts` (new); `packages/api/vitest.config.ts` |
| Quick run | `pnpm --filter @contractor-ops/payroll test <path>` / `pnpm --filter @contractor-ops/api test <path>` |
| Full suite | `pnpm --filter @contractor-ops/payroll test` |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` `[VERIFIED: MEMORY feedback_test_run_memory]`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (contract) | registry register/get/list/clear + duplicate throw; engine resolves profileId→generate | unit | `pnpm -F @contractor-ops/payroll test registry engine` | ❌ Wave 1 |
| PAYROLL-PL-01/02/03 | Symfonia/Comarch/Enova `generate(feed)` == golden fixture (CSV+XML) | unit (golden) | `pnpm -F @contractor-ops/payroll test symfonia comarch enova` | ❌ Wave 1 RED |
| PAYROLL-DE-01/02 | DATEV Lohn ASCII + Sage DE `generate(feed)` == golden fixture; exact record length | unit (golden) | `pnpm -F @contractor-ops/payroll test datev sage-de` | ❌ Wave 1 RED |
| PAYROLL-UK-01 | RTI FPS/EPS XML == golden fixture; XSD validate non-throwing when bundle absent | unit (golden) | `pnpm -F @contractor-ops/payroll test rti-fps rti-eps` | ❌ Wave 1 RED |
| PAYROLL-US-01 | ADP/Gusto/QuickBooks CSV == golden fixture | unit (golden) | `pnpm -F @contractor-ops/payroll test adp gusto-csv quickbooks-csv` | ❌ Wave 1 RED |
| PAYROLL-US-01 | Gusto/QuickBooks native adapter OAuth config + payload map; live call conditionally-skips without creds | unit + conditional | `pnpm -F @contractor-ops/integrations test gusto quickbooks` | ❌ Wave 1 RED |
| PAYROLL-* | `buildPayrollFeed` joins Worker+EmployeeProfile+PersonnelFile, masks PII to last-4 | unit | `pnpm -F @contractor-ops/api test payroll-feed` | ❌ Wave 1 RED |
| PAYROLL-* | Export procedure enforces `module.workforce-employees` + per-target flag; audits | unit | `pnpm -F @contractor-ops/api test payroll-export` | ❌ Wave 1 RED |
| PAYROLL-* | Cross-org leak: export never returns another org's employees | integration | `pnpm -F @contractor-ops/api test payroll-cross-org` | ❌ Wave 1 RED |

### Sampling Rate
- **Per task commit:** scoped `pnpm -F @contractor-ops/<pkg> test <changed-path>` (< 30s).
- **Per wave merge:** `pnpm -F @contractor-ops/payroll test` + `pnpm -F @contractor-ops/api test` + `pnpm typecheck --filter=@contractor-ops/api` + touched guards (`lint:schema`, `lint:audit-log`, `i18n:parity`, `check:web-vite-*`, `pnpm standards:check`).
- **Phase gate:** full scoped payroll + api suites green + `pnpm check:wiki-brain` green before `/gsd:verify-work`.

### Wave 0/1 Gaps (the RED net)
- [ ] `packages/payroll/src/__tests__/registry.test.ts` + `engine.test.ts` — contract
- [ ] `packages/payroll/src/__tests__/{symfonia,comarch,enova}.test.ts` (+ golden fixtures) — PL
- [ ] `packages/payroll/src/__tests__/{datev,sage-de}.test.ts` (+ golden) — DE
- [ ] `packages/payroll/src/__tests__/{rti-fps,rti-eps}.test.ts` (+ golden) — UK
- [ ] `packages/payroll/src/__tests__/{adp,gusto-csv,quickbooks-csv}.test.ts` (+ golden) — US CSV
- [ ] `packages/integrations/src/adapters/__tests__/{gusto,quickbooks}-adapter.test.ts` — native (conditional-skip live)
- [ ] `packages/api/src/services/__tests__/payroll-feed.test.ts` — feed-builder + PII mask
- [ ] `packages/api/src/routers/__tests__/payroll-export.test.ts` — flag gate + audit
- [ ] `packages/api/src/routers/__tests__/payroll-cross-org.test.ts` — IDOR

## Security Domain

> `security_enforcement` absent = enabled. Included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | **yes** | `assertWorkforceEnabled` + per-target `payroll.*` gate; `withTenantScope` on Worker/EmployeeProfile/PersonnelFile; HR-role RBAC (P89 `hr_admin`/`payroll_officer`) on export; native OAuth connections org-scoped. |
| V5 Input Validation | **yes** | Zod `.strict()` on export input (`targetId`, `employeeIds`); reject injected `organizationId`/`workerType`. |
| V6 Cryptography | no (reuse) | PII stays in encrypted columns (P90 keys); feed carries `*Last4`; full reveal only via audited `employeePii:read`, only when a format legally requires it. `[VERIFIED: employee.prisma:27-39]` |
| V7/V8 Logging & Data Protection | **yes** | `writeAuditLog` on every export (which employees, which target, when, by whom); native token exchange audited; no PII in logs. |

### Known Threat Patterns for {multi-tenant payroll export}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org employee export (IDOR) | Information Disclosure | `withTenantScope` + `employeeIds` filtered by session org + two-org leak test. |
| Full national ID leaking into export/logs | Information Disclosure | Feed masks to last-4; full value via audited reveal only; never logged. |
| Flag-off / signoff-PENDING target still exports | Elevation / Tampering | Conditional root.ts spread (METHOD_NOT_FOUND) + per-request `assertWorkforceEnabled` + per-target `evaluate`. |
| Native OAuth token theft / cross-org reuse | Spoofing / Elevation | Tokens in AES-256-GCM `credentialsRef` keyed on org+provider; live path dark until APPROVED. |
| Export presented as statutory filing | Repudiation / liability | Adviser-verify annotation on statutory formats; adapters export, incumbent files; legal sign-off deferred (local-only). |

## Project Constraints (from CLAUDE.md)

- **Tenant from session** (`organizationId`, region) — never client input; `withTenantScope` on all reads.
- **`writeAuditLog`** on every export mutation (pass `tx` in transactions).
- **Zod `.strict()`** on the export procedure; no unsafe `as` on external (Gusto/QuickBooks) payloads → `safeParse`.
- **No `console.*`** — `@contractor-ops/logger`.
- **Feature flags** only via `@contractor-ops/feature-flags` (`module.workforce-employees` + `payroll.*`); keys in `flags-core.ts`.
- **i18n parity** en/de/pl/ar (+ en-US); no hardcoded user-facing strings; mandatory loading/empty/error states.
- **web-vite layering:** Page (thin) → Container → Hook (sole tRPC) → Component; run `check:web-vite-*`.
- **New env** (`GUSTO_*`/`QUICKBOOKS_*`) → `.env.example` + package env schema; `pnpm check:no-process-env`.
- **New package** → root `tsconfig.json` references + `workspace:*` in `packages/api`; `packages/*` glob already covers it in `pnpm-workspace.yaml`.
- **Deps:** no new external packages for the floor; any SDK → 7-day `minimumReleaseAge` + `pnpm audit` + `security:scan` + `checkpoint:human-verify`.
- **Docs-follow-code:** wiki (`structure/packages.md`, `structure/key-services.md`, `patterns/feature-flags.md`, new `domains/payroll-export.md`), `MEMORY.md` invariant, `EXTERNAL-ENABLEMENT.md` rows, graph/BM25 — SAME change set; `pnpm check:wiki-brain`.
- **Git safety:** no `git stash`/`reset --hard`/`restore` without explicit approval.
- **`.planning/phases` is a symlink** — stage planning commits via real `milestones/v7.0-phases/` path.

## Sources

### Primary (HIGH confidence — in-tree, current HEAD)
- `packages/einvoice/src/{registry.ts,engine/engine.ts,types/profile.ts,index.ts}` — the profile-registry pattern to clone
- `packages/api/src/services/payment-export.ts` — CSV/Elixir/SEPA/SWIFT/Fedwire/BACS/NACHA generators (format idioms)
- `packages/api/src/routers/finance/payment-shared.ts:233-263` — `_generateExportFileForFormat` dispatch + download
- `packages/integrations/src/types/provider.ts` + `adapters/register-all.ts` — `IntegrationProviderAdapter`, `OAuthConfig`, lazy registration
- `packages/api/src/lib/integration-procedure.ts` — tRPC procedure factory
- `packages/db/prisma/schema/{worker,employee,personnel}.prisma` — feed source models + hire/terminatedAt anchors + tenant-owning headers
- `packages/validators/src/employee-country-fields.ts` — per-market field vocabulary + `employeeCountryFieldsSchemaMap`
- `packages/feature-flags/src/{flags-core.ts,signoff-registry-flags.json,schemas.ts}` — the 8 `payroll.*` flags + `payroll` category
- `packages/api/src/middleware/require-workforce-flag.ts` + `root.ts:178-196` — flag gate + dark mount
- `packages/iris/src/__tests__/{fixtures/golden-1099-nec.json,xsd-bundle-present.ts}` — golden-fixture + bundle-absent validate model
- `.planning/EXTERNAL-ENABLEMENT.md` — the flag-defer register to extend

### Secondary / Tertiary
- Vendor format specs (DATEV Lohn/LODAS import, HMRC RTI FPS/EPS schema, Symfonia/Comarch/Enova import layouts, Gusto/QuickBooks OAuth REST) — to be pinned per profile by the executor against the current published spec and locked with golden fixtures; no WebSearch performed (formats are stable + the executor pins exact versions at build time).

## Metadata

**Confidence breakdown:**
- Reuse seams (registry/engine/generators/integrations/flags): HIGH — every seam read at source at current HEAD.
- Feed source (Worker/EmployeeProfile/PersonnelFile join + per-market fields): HIGH — models + schema map verified.
- Per-target statutory layouts (DATEV ASCII, RTI FPS/EPS, Symfonia/Comarch/Enova/Sage columns): MEDIUM — the *idiom* is verified; the *exact field layout* is pinned by the executor against the vendor spec + golden fixture (D-05).
- Native OAuth (Gusto/QuickBooks): HIGH on framework fit; MEDIUM on exact endpoint/scope set (pinned at build time; flag-deferred).

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (stable repo infra; re-verify line numbers if HEAD advances — Theme B phases execute concurrently).
