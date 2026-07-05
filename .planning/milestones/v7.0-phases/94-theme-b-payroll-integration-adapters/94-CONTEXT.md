# Phase 94: Theme B — Payroll Integration Adapters - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

HR **exports employee payroll data to the incumbent payroll system in each market** —
**adapters only, never an own payroll engine** (no gross→net math, no tax calculation, no
statutory filing; the target system computes and files). Eight export targets across four markets:

- **PL** — Symfonia Kadry i Płace (CSV + XML), Comarch ERP XL/Optima, Enova365 (PAYROLL-PL-01/02/03)
- **DE** — DATEV Lohn und Gehalt (ASCII import + DATEVconnect REST where subscribed), Sage HR/Personalwirtschaft (PAYROLL-DE-01/02)
- **UK** — Sage / BrightPay / Moneysoft, RTI-compatible FPS/EPS XML (PAYROLL-UK-01)
- **US** — Gusto + QuickBooks Payroll + ADP, CSV mappings + native API where available (PAYROLL-US-01)

**Depends on:** Phase 90 (`EmployeeProfile` registry fields = the export data source) and
Phase 93 (on/offboarding events = new-hire / termination movement).

**NOT this phase:**
- Own payroll engine / gross-to-net computation / tax calculation (commodity — Symfonia/DATEV/Sage/Gusto own it).
- US payroll tax filing (940/941 + state) — Gusto/QuickBooks territory; we push data, they file.
- HMRC RTI *direct submission* (Government Gateway OAuth) → PAYROLL-UK-02, deferred to v7.5; v7.0 ships RTI-compatible XML export-only.
- PL e-ZLA / DE eAU payroll-integration push (LEAVE-04/05) → deferred to v7.5.
- Workday / Paychex / Rippling-payroll adapters → v8.0+ on customer pull.
- HRIS two-way sync (Personio/BambooHR) → Phase 95; benefits enrollment → v8.0+.
</domain>

<decisions>
## Implementation Decisions

### Architecture — Adapter Home (D-01)
- **D-01:** **New `packages/payroll` package, mirroring `packages/einvoice`'s profile-registry engine.**
  Define a `PayrollExportProfile` interface + a `registerProfile`/`getProfile`/`listProfiles` registry +
  a thin engine that resolves a profileId → profile and orchestrates generation — exactly the
  einvoice shape (KSeF/ZATCA/Peppol profiles). Each of the 8 targets registers itself as one profile on import.
  **Do NOT overload the `payment-export` factory** (`_generateExportFileForFormat` / `PaymentExportFormat` enum):
  that is payment-run/bank-file oriented (SEPA/Elixir/NACHA per *payment run*), whereas payroll export is
  employee master-data oriented — different shape, different lifecycle. Reuse the *pattern*, not the module.

### Native-API Scope + External-Dep Deferral (D-02, D-03)
- **D-02:** **File-export is the v7.0 floor for all 8 targets; add Gusto + QuickBooks native API this phase.**
  - PL (Symfonia/Comarch/Enova), DE (DATEV ASCII, Sage), UK (Sage/BrightPay/Moneysoft RTI XML), and ADP → **file-export in v7.0.**
  - **Gusto + QuickBooks Payroll → native API this phase** (both have public OAuth 2.0 REST) — implemented as
    `IntegrationProviderAdapter`s on the **v2.0 `packages/integrations` framework** (OAuth + AES-256-GCM credential storage +
    health), invoked by the payroll engine when the org has connected. File/CSV export remains their fallback.
  - **DATEVconnect REST** is a wired **seam** filled "where subscribed" — not a v7.0 deliverable.
- **D-03:** **ADP native API → v7.1 flag-defer.** ADP requires Marketplace partner approval + mTLS — external lead-time
  outside the phase's control. v7.0 ships ADP **CSV file-export only**; the native seam stays dark behind `payroll.adp`.
  Per the external-deps invariant: never stall the phase on account/enrollment/partner approval — ship the floor, defer the live path.

### Export Payload — What "Payroll Data" Is (D-04)
- **D-04:** **The export is an employee master-data feed, not computed payroll.** Fields map from the Phase 90
  `EmployeeProfile` (per-market: tax class/code, Lohnsteuerklasse, Krankenkasse, NI/PAYE/tax code, gross rate,
  `etat` employment fraction, bank/IBAN, statutory IDs — SV-Nummer, Steuer-IdNr, PESEL, NI, SSN) plus Phase 93
  on/offboarding events (start date, termination date/reason for the new-hire / leaver records the target system needs).
  **No period hours / leave / absences in v7.0** (P92 time/leave data stays out — add later if a target format requires movement data).
  **No gross→net, no tax amounts** — the incumbent system computes those from the master data we push.

### Format Fidelity + Validation (D-05)
- **D-05:** **Hand-build each format against its real spec; validate in tests against golden fixtures** — mirror the
  Phase 86 IRIS-XSD approach (`buildIrisXml` + `xsdValidate`, non-throwing when the bundle is absent). Per target:
  DATEV Lohn ASCII layout, UK RTI FPS/EPS XML schema, Symfonia CSV/XML column contract, Comarch/Enova/Sage mappings,
  Gusto/QuickBooks API payload shape. Each adapter ships golden-file round-trip fixtures. Statutory format rules carry
  **adviser-verify** annotations (local-only, legal sign-off deferred — do not hard-block on Steuerberater/doradca approval).

### Cross-Cutting (carried forward — not re-asked)
- **D-06:** Whole surface gated on **`module.workforce-employees`** (Theme B umbrella) **plus per-adapter flags** already
  registered PENDING/ship-dark in `packages/feature-flags`: `payroll.symfonia`, `payroll.comarch`, `payroll.enova`,
  `payroll.datev`, `payroll.sage-uk`, `payroll.gusto`, `payroll.quickbooks`, `payroll.adp` (category `payroll`;
  flip APPROVED post-deploy; dev with `FLAG_SIGNOFF_BYPASS=local`). Native Gusto/QuickBooks live calls sit behind their
  own per-adapter flag with conditional-skip tests (auto-flip when creds land), per the external-deps invariant.
- **D-07:** Tenant `organizationId` from session (never client input); `writeAuditLog` on every payroll-export action
  (which employees, which target, when, by whom); Zod `.strict()` on export procedures; no `console.*` (`@contractor-ops/logger`);
  statutory PII (SSN/PESEL/etc.) never logged — masked in the export UI, revealed only through the P90 `employeePii:read` path.
- **D-08:** Reuse, don't rebuild — `packages/einvoice` profile-registry pattern, `packages/integrations` adapter framework
  for native API, existing payment-export *download/UI* plumbing where it fits a file result. Documentation-follows-code:
  new package + adapters → wiki (`structure/packages.md`, domain page, `patterns/feature-flags.md` for the 8 flags) in the same change set.

### Claude's Discretion
- Exact `PayrollExportProfile` interface surface (e.g. `generate(feed) → { buffer, ext, mime }` vs a richer result type; whether native-API profiles implement a superset or delegate to an integrations adapter).
- The canonical intermediate `PayrollFeed` DTO shape the profiles map *from* (which promoted `EmployeeProfile` columns vs `countryFields` JSON feed each target), and per-target required-vs-optional field matrix.
- **Flag granularity gap:** PAYROLL-DE-02 (Sage DE / Personalwirtschaft) has no dedicated flag (only `payroll.datev` for DE); UK BrightPay/Moneysoft are grouped under `payroll.sage-uk`. Planner decides: reuse market-level flag, or add `payroll.sage-de` (+ per-vendor UK flags) — keep the registry the source of truth.
- Whether Gusto/QuickBooks native adapters register in the payroll registry, the integrations registry, or both (bridge).
- Where the export is triggered from (backend procedure + reuse of payment-export download UI vs a new HR export surface); no new UI decision was locked — treat as a light UI-hint surface with mandatory loading/empty/error + i18n parity.
- Seed source + shape for any per-target code lists / mapping tables.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 94: Theme B — Payroll Integration Adapters" (goal, success criteria, research flag: PayrollExportProfile in existing factory, ADP lead-time → v7.1)
- `.planning/REQUIREMENTS.md` — PAYROLL-PL-01/02/03, PAYROLL-DE-01/02, PAYROLL-UK-01, PAYROLL-US-01; deferred table (PAYROLL-UK-02 RTI direct → v7.5; US Workday/Paychex/Rippling → v8.0; own engine = never); "US payroll adapters = exactly Gusto+QuickBooks+ADP" locked decision
- `.planning/milestones/v7.0-BACKLOG.md` — locked decisions #4 (US adapters) + #6 (e-ZLA/eAU/RTI deferral); reuse posture
- `.planning/research/SUMMARY.md` + `.planning/research/ARCHITECTURE.md` — reuse-existing-factories mandate

### Data source (upstream phases)
- `.planning/milestones/v7.0-phases/90-theme-b-employee-registry-per-market-6/90-CONTEXT.md` — `EmployeeProfile` field model (D-01..D-05: countryFields JSON + encrypted PII columns + promoted typed columns; per-market field sets = the export source)
- `.planning/milestones/v7.0-phases/93-theme-b-employee-on-offboarding/93-CONTEXT.md` — on/offboarding events (new-hire / leaver movement for the feed)

### Pattern to mirror (architecture)
- `packages/einvoice/src/registry.ts` — `registerProfile`/`getProfile`/`listProfiles` (the registry to clone for `packages/payroll`)
- `packages/einvoice/src/types/profile.ts` — `EInvoiceProfile` interface (the profile-contract analog for `PayrollExportProfile`)
- `packages/einvoice/src/engine/engine.ts` — engine orchestration (profileId → profile.generate)

### Reference implementations (file-format generators)
- `packages/api/src/routers/finance/payment-shared.ts` §`_generateExportFileForFormat` — format-switch idiom (CSV/Elixir/SWIFT) + download plumbing
- `packages/api/src/services/payment-format-detection.ts` — format enum + destination detection reference
- `packages/api/src/services/payment-export.ts` — `generateSwiftXml`/`generateElixir`/`generateCsv` (buffer generators to model DATEV ASCII / RTI XML / Symfonia CSV on)

### Native-API framework (Gusto/QuickBooks)
- `packages/integrations/src/types/provider.ts` — `IntegrationProviderAdapter` contract (OAuth/webhooks/health)
- `packages/integrations/src/registry.ts` + `packages/integrations/src/adapters/register-all.ts` — adapter registration + lazy heavy-adapter load

### Feature flags (gating)
- `packages/feature-flags/src/flags-core.ts` + `packages/feature-flags/src/signoff-registry-flags.json` — the 8 `payroll.*` ship-dark flags (source of truth); `packages/feature-flags/src/schemas.ts` (`payroll` category)

### Prior-art (validate-against-spec approach)
- Phase 86 IRIS: `packages/iris` (`buildIrisXml` + `xsdValidate`, non-throwing when bundle absent) — the golden-file/spec-validation model for D-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/einvoice` profile-registry** — direct template for `packages/payroll`: profile interface + registry + engine. Clone the shape, swap invoice→payroll.
- **`packages/integrations` adapter framework** — OAuth 2.0 + AES-256-GCM credential storage + health for Gusto/QuickBooks native adapters. No new auth plumbing needed.
- **payment-export generators** (`generateCsv`/`generateElixir`/`generateSwiftXml`) — proven CSV/flat-file/XML buffer patterns to model per-target formats on; download/UI plumbing reusable for file results.
- **P90 `EmployeeProfile`** — the master-data source (per-market validated fields, promoted columns HR/payroll filter on: Saudization, `etat`, employment status; encrypted PII with masked reveal).
- **P86 IRIS XSD pattern** — golden-file + spec-validation, non-throwing when the offline bundle is missing → the fidelity model for D-05.

### Established Patterns
- **Profile-registry** (einvoice, classification): country/target profile self-registers on import; engine resolves by id, fail-fast on missing.
- **Ship-dark flag gating** — per-adapter `payroll.*` flags default off, flipped APPROVED post-deploy; `FLAG_SIGNOFF_BYPASS=local` for dev.
- **External-dep flag-defer** — native/credentialed paths (ADP mTLS, DATEVconnect subscription, Gusto/QuickBooks OAuth) behind their flag with conditional-skip tests; the phase never stalls on enrollment.
- **Tenant + audit + Zod-strict** on every mutation; PII masked, never logged.

### Integration Points
- New `packages/payroll` consumed by a tRPC procedure (staff `appRouter`) that reads `EmployeeProfile` (P90) + on/offboarding events (P93), builds a `PayrollFeed`, and dispatches to the selected profile.
- Gusto/QuickBooks native adapters register on the `packages/integrations` framework (OAuth connect + credential store).
- The 8 `payroll.*` flags already exist in `packages/feature-flags` — wire the gate, don't invent new keys (except the possible `payroll.sage-de` gap, planner's call).

</code_context>

<specifics>
## Specific Ideas

- "Adapters only, never an own payroll engine" is the hard boundary — the phrase recurs across ROADMAP/REQUIREMENTS/BACKLOG. Every profile *exports*; none *computes* payroll.
- Mirror `packages/einvoice` deliberately — the roadmap's "PayrollExportProfile in the existing factory" is that profile-registry idiom, not the payment-export format enum.
- Validate like Phase 86 IRIS: hand-build to the real statutory format, prove it with golden fixtures, keep validation non-throwing when an offline spec bundle is unavailable.

</specifics>

<deferred>
## Deferred Ideas

- **ADP native API** — Marketplace approval + mTLS lead-time → v7.1; v7.0 ships ADP CSV export only (seam dark behind `payroll.adp`).
- **DATEVconnect REST** — live push "where subscribed"; v7.0 wires the seam, DATEV ASCII file-export is the shipping path.
- **Period movement data** (hours from P92, leave/absences) in the export payload — only if a target format proves it's required; v7.0 = master-data feed.
- **HMRC RTI direct submission** (PAYROLL-UK-02, Government Gateway OAuth) → v7.5; v7.0 = RTI-compatible XML export-only.
- **PL e-ZLA / DE eAU payroll push** (LEAVE-04/05) → v7.5.
- **Workday / Paychex / Rippling-payroll adapters** → v8.0+ on customer pull.
- **Own payroll engine** — explicitly never, unless integration friction proves dispositive.

None of the above are in Phase 94 scope — recorded so they aren't lost.

</deferred>

---

*Phase: 94-theme-b-payroll-integration-adapters*
*Context gathered: 2026-07-05*
