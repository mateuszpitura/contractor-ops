# Phase 90: Theme B — Employee Registry per Market (×6) - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

HR can **register an employee in any of the six supported markets** (PL / DE / UK / US / AE / SA)
with all statutory identifiers validated, stored on a new `EmployeeProfile` attached to the
Phase-89 `Worker`/`Employee` abstraction. Mirrors the contractor country-fields pattern.

Per-market field sets (EMP-REG-PL/DE/UK/US/AE/SA-01):
- **PL** — PESEL (mod-11 + DOB), urząd skarbowy ID, ZUS oddział ID, stanowisko, wymiar etatu (0.10–1.00), stawka brutto, ZUS title code, NFZ oddział.
- **DE** — Steuer-IdNr (11-digit mod-11), SV-Nummer (v5.0 validator), Krankenkasse ID, Lohnsteuerklasse (I–VI), Kinderfreibetrag, Kirchensteuer flag, ELStAM lookup hook.
- **UK** — NI number (format + DWP exclusion ranges), PAYE reference, tax code (1257L + emergency/W1/M1/K), student-loan plan, pension auto-enrol flag.
- **US** — SSN (PII-masked per US-FIELD-02), W-4 step-1c filing status, state withholding (10 highest-pop states + free-text fallback).
- **AE** — Emirates ID + visa type + WPS Establishment ID.
- **SA** — Iqama / National ID, GOSI registration number, Saudization category contribution flag.

**HARD DEPENDENCY:** **Phase 89 (Worker/Employee abstraction) must be executed first** — `EmployeeProfile`
attaches to the `Employee` (which links to the `Worker` base). This context can be planned, but
execution waits on 89.

**NOT this phase:**
- Personnel file / akta (P91), leave/time (P92), on/offboarding (P93), payroll export (P94),
  HRIS sync (P95), portal (P96), HR dashboard (P97).
- Full 50-state US withholding matrix → deferred (REQUIREMENTS.md line 218; v7.0 ships 10 + free-text).
- Live government lookups (ELStAM, ZUS, NFZ) → stub hooks / reference-list pickers only (local-only).
</domain>

<decisions>
## Implementation Decisions

### EmployeeProfile Storage Model (all EMP-REG-*)
- **D-01:** **New `EmployeeProfile` model, 1:1 per `Employee`, with `countryCode`.** Hybrid storage: (a) **`countryFields Json?`** holds the bulk per-market NON-PII fields, validated by a per-country Zod schema — mirror `Contractor.countryFields` + `validateCountryFields()`; (b) **dedicated AES-256-GCM-encrypted columns** for the PII national IDs (see D-04); (c) a small set of **promoted typed/indexed columns** for cross-market query needs the HR dashboard (P97) + payroll (P94) filter on — at minimum Saudization category, employment fraction (`etat` 0.10–1.00), and employment status. Tenant-owning (`organizationId`), NEVER in `globalModels`, cross-org leak test.
- **D-02:** **Mirror the contractor country-fields registry, do not fork it.** Extend the `validateCountryFields` dispatch (`packages/validators/src/country-fields.ts` `countryFieldsSchemaMap`) with employee per-country schemas — a parallel `employeeCountryFieldsSchemaMap` is acceptable, but the validator IDIOM + the reusable validators are shared (D-03).

### Validator Reuse + Depth (all EMP-REG-*)
- **D-03:** **Reuse the 16 existing validators** where they apply — DE `isValidSvNummer`/`isValidSteuerIdNr` (research flag's "v5.0 SV-Nummer"), the tax/company validators; build the **~14 greenfield** ones at full depth: PESEL (mod-11 + embedded-DOB cross-check), NI (format + DWP exclusion ranges), tax-code (1257L pattern + emergency/W1/M1/K/K-prefix flags), W-4 step-1c, Emirates ID, Iqama/National ID, GOSI, Krankenkasse, student-loan plan; **enums** for Lohnsteuerklasse (I–VI) + Saudization category; state-withholding = 10 states + free-text fallback.
- **D-05:** **Reference-list pickers + stub lookup hooks; NO live government calls** (local-only). ZUS oddział, NFZ oddział, urząd skarbowy ID = **seeded reference-list pickers** (code lists); ELStAM (DE) = a documented **stub hook** (no live German gov API), wired as a seam for later. Seeded statutory lists carry **adviser-verify** annotations.

### PII Boundary (EMP-REG-US-01 + PL/AE/SA national IDs)
- **D-04:** **Encrypt the national-person identifiers; store tax/social IDs plain (RBAC-gated).** PESEL (RODO-sensitive), SSN (reuse the P84 `ssn-crypto` pattern), Iqama/National ID, Emirates ID → AES-256-GCM encrypted + `last4`/masked + a new **`employeePii:read`** RBAC-gated reveal procedure + `writeAuditLog` on reveal (mirror `contractor.revealSsn`). Tax/social numbers (Steuer-IdNr, SV-Nummer, NI number, PAYE) → stored **plain but RBAC-gated** (employer-operational IDs that appear on payslips/payroll exports — encrypting them adds decrypt friction without meaningful re-identification benefit). A dedicated encryption key (or the P84 key family) per the existing convention; full PII value never logged, never in `countryFields` JSON.

### UI (all EMP-REG-* — UI-hint phase)
- **D-06:** **Per-market hand-built components**, mirroring `CountryComplianceSection`/`CountryFieldsDispatch`. New `apps/web-vite/src/components/employees/compliance/` with a dispatch switch → per-market field components (`PLEmployeeFields`, `DEEmployeeFields`, `UKEmployeeFields`, `USEmployeeFields`, `AEEmployeeFields`, `SAEmployeeFields`); reuse `SsnMaskedReveal`-style masked-reveal for encrypted PII, reference-list pickers for ZUS/NFZ/urząd. web-vite layering (page → wired section → hook = sole tRPC boundary → presentational; NO `*-container.tsx`); mandatory loading/empty/error + WCAG; i18n parity en/en-US/de/pl/ar.

### Cross-Cutting (carried forward — not re-asked)
- **D-07:** Whole employee surface gated on **`module.workforce-employees`** (P89 flag-off pattern); `EmployeeProfile` + the employee registration procedures live behind it.
- **D-08:** **Depends on P89** — `EmployeeProfile` FK to `Employee`/`Worker`; plan/execute only after 89's abstraction lands. Store statutory fields against the employee, not the contractor.
- **D-09:** `writeAuditLog` on employee registration + PII reveal; tenant from session; Zod `.strict()` on the registration procedure.
- **D-10:** Adviser-verify annotations on the statutory seed lists + the validation rules (local-only / legal-deferred); 50-state US deferred.

### Claude's Discretion
- Exact `EmployeeProfile` columns vs `countryFields` JSON split (which non-PII fields are promoted typed/indexed beyond the named three); whether a per-market sub-table (mirror `FreeZoneAssignment`) is warranted for AE/SA visa/WPS/GOSI vs JSON — planner.
- The reference-list seed-data source + shape (ZUS/NFZ oddział, urząd skarbowy code lists) + their maintenance note.
- Whether the employee country-fields schema map is a parallel map or a shared registry keyed by worker-type.
- Per-market required-vs-optional field matrix.
- The `employeePii:read` permission grant set across the 4 new HR roles (P89) + existing roles.
- ELStAM stub-hook interface shape.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — EMP-REG-PL/DE/UK/US/AE/SA-01 verbatim; line 218 (50-state US deferred).
- `.planning/ROADMAP.md` (Phase 90 entry) — goal + 4 success criteria + research flag (reuse v5.0 SV-Nummer + v4.0 Gulf; new models never in globalModels + cross-org leak test) + UI hint.
- `.planning/phases/89-theme-b-worker-model-abstraction-serial-gate/89-CONTEXT.md` — the Worker base + Employee abstraction `EmployeeProfile` attaches to (HARD dependency, D-08); `module.workforce-employees` flag.
- `.planning/phases/84-theme-a-us-contractor-profile-fields-en-us-locale/84-CONTEXT.md` — US SSN encrypt/mask/reveal + country-fields dispatch (the reused PII + dispatch patterns).

### Country-fields + validators
- `packages/validators/src/country-fields.ts` (`countryFieldsSchemaMap` ~279-298, `validateCountryFields`, per-country Zod schemas; `validatePolishNip` 318, `validateUaeTin`/`validateSaudiTin` 304-312) — the dispatch + the PL/AE/SA tax-ID validators to mirror/reuse.
- `packages/validators/src/de-validators.ts` (`isValidSvNummer` 92-106, `isValidSteuerIdNr`/`isValidUstIdNr`, `isValidSteuernummer`) — reusable DE validators.
- `packages/validators/src/uk-validators.ts` (`isValidUtr`, `isValidGbVat`, `isValidCompaniesHouseNumber`) + `us-validators.ts` (`isValidSsn`, `isValidEin`) — reusable.

### PII crypto + reveal
- `packages/api/src/services/ssn-crypto.ts` (`encryptSsn`/`decryptSsn` AES-256-GCM, dedicated key) + `packages/api/src/routers/core/contractor-tax.ts` (`contractor.revealSsn`, RBAC + audit) + `packages/auth/src/permissions.ts` (`contractorPii:read` → add `employeePii:read`).

### UI
- `apps/web-vite/src/components/contractors/country-compliance-section.tsx` (`CountryFieldsDispatch` switch; `UaeFields`/`SaudiFields`/`UkComplianceFields`/`DeComplianceFields`/`UsComplianceFields`) + `compliance/ssn-masked-reveal.tsx` + `hooks/use-reveal-ssn.ts` — the per-market dispatch + masked-reveal to mirror in `components/employees/compliance/`.

### Gulf + per-profile model analogs
- `packages/db/prisma/schema/gulf.prisma` (`FreeZoneAssignment` 1:1) + `contractor.prisma` (`ContractorBillingProfile` 1:1 132-173; `countryFields Json?` 38; `ssnEncrypted`/`ssnLast4` 43-44; Saudi `isSaudi` 193) — the per-profile model + JSONB + encrypted-column + Gulf-field analogs.

### Documentation-follows-code (update in the same change set)
- `.planning/brain/wiki/domains/` (employee-registry domain), `wiki/structure/{prisma-schema-areas.md (EmployeeProfile), packages.md (validators), web-vite-domains.md (employee compliance)}`, `wiki/patterns/` (country-fields dispatch reuse + PII boundary), `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` (the employee PII-encryption boundary + reference-list-not-live-gov invariants).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`validateCountryFields` + `countryFieldsSchemaMap`** dispatch — the employee side mirrors it (D-02); 16 validators reusable (SV-Nummer, Steuer-IdNr, UTR, VAT, Companies-House, SSN, EIN, NIP, AE/SA TIN).
- **P84 SSN crypto/reveal** (`ssn-crypto.ts` + `revealSsn` + `contractorPii:read`) — the encrypted-national-ID pattern (D-04), extended to PESEL/Iqama/Emirates-ID + a new `employeePii:read`.
- **`CountryFieldsDispatch` UI** + `SsnMaskedReveal` — the per-market form dispatch + masked-reveal (D-06).
- **`Contractor.countryFields Json?`** + **`ContractorBillingProfile`/`FreeZoneAssignment`** (1:1) — the JSONB + per-profile model templates (D-01).
- **P89 Worker/Employee abstraction + `module.workforce-employees`** — the attach point + the flag gate (D-07/D-08).

### Established Patterns
- **Country-fields registry: add a country schema, don't fork the engine** (D-02).
- **National-ID PII: encrypt + last4 + masked + RBAC-gated reveal + audit** (P84) — boundary set at national-person IDs (D-04).
- **Reference-list/seed-data + stub hooks instead of live gov APIs** (local-only) — ELStAM/ZUS/NFZ (D-05).
- **New tenant-owning model never in globalModels + cross-org leak test** (every prior tenant model).
- **No hardcoded user-facing strings; i18n parity; adviser-verify on statutory rules.**

### Integration Points
- `EmployeeProfile` FK → `Employee` (P89) → `Worker` base; gated by `module.workforce-employees`.
- The promoted typed columns (Saudization, etat, status) feed P97 HR dashboard + P94 payroll filters.
- The employee registration form dispatches per `countryCode`; PII fields use masked-reveal; reference pickers seed from the code lists.

</code_context>

<specifics>
## Specific Ideas

- **Mirror, don't reinvent** — the contractor country-fields + dispatch + PII patterns already solved "per-market validated fields with sensitive IDs"; the employee registry is that pattern applied to the P89 Employee, with a tightened PII boundary (PESEL/Iqama/Emirates-ID now encrypted, not just SSN).
- **Encrypt national IDs, expose operational IDs** — the boundary is re-identification risk vs payroll-export utility: national-person IDs encrypted (RODO/privacy), tax/social numbers plain-but-gated (they ride payslips).
- **Full validation depth, local-only lookups** — bad national IDs in a registry of record are unacceptable, so checksums are mandatory; but no live ELStAM/ZUS/NFZ calls — reference lists + stub hooks keep it local-only and seed data is adviser-verify-flagged.
- **This is registry-of-fields only** — akta/leave/payroll/onboarding/portal/dashboard all consume these fields later (P91–97); P90 just captures + validates + stores them.

</specifics>

<deferred>
## Deferred Ideas

- **Full 50-state US withholding matrix** → 10 states + free-text now (REQUIREMENTS line 218).
- **Live government lookups** (ELStAM, ZUS, NFZ, GOSI verification) → stub hooks + reference lists now; live integrations later if a market needs them.
- **Personnel file / akta, leave, time, on/offboarding, payroll, HRIS, portal, HR dashboard** → P91–97 (they consume these fields).
- **Per-market sub-tables for visa/WPS/GOSI** vs JSON → planner's discretion; deferred unless the field set demands it.

None of these expand the registry scope — discussion stayed within the per-market employee field-registry boundary.

</deferred>

---

*Phase: 90-theme-b-employee-registry-per-market-6*
*Context gathered: 2026-06-21*
