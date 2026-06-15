# Phase 85: Theme A — W-Form Intake + Tax-Treaty Engine - Research

**Researched:** 2026-06-16
**Domain:** US tax-status form intake (W-9 / W-8BEN / W-8BEN-E) + US treaty-rate resolution engine
**Confidence:** HIGH (codebase patterns verified in-tree; IRS form line numbers CITED from irs.gov; treaty rates ASSUMED/adviser-deferred)

## Summary

Phase 85 is overwhelmingly a **pattern-replication** phase: every architectural primitive it needs already exists in-tree and was read+verified during this research. The treaty-rate engine extends the existing `WithholdingTaxRate` model (`tax.prisma:23`) with `sourceCountry='US'` rows — the table is already in the `global-lookup-allowlist`, already seeded via `wht-rates.ts` upsert, and already consumed by exactly **one** service (`tax-rate.service.ts → calculateWht`) that is hard-gated to `orgCountry === 'SA'`, so US rows are **non-breaking by construction**. The resolution-with-override-and-audit shape is a direct mirror of `reverse-charge.service.ts` (`detectReverseCharge` / `resolveReverseChargeDecision`). The wizard surface reuses the `reui` Stepper + react-hook-form idiom (`organization-onboarding.tsx`, `zatca/onboarding-wizard.tsx`). The portal self-service path runs through `portalProcedure` (cookie session → `ctx.contractorId` / `ctx.organizationId` / `ctx.db` regional tenant client). RBAC, audit, SSN crypto, and US validators all shipped in Phase 84.

The genuinely new build is: (1) a **new immutable `TaxFormSubmission` model** (snapshot + supersede chain + ESIGN attestation block), (2) a **new `treaty-rate.service.ts`** analog, (3) **new structured columns** on `WithholdingTaxRate` (`treatyArticle`, `incomeType`), (4) **portal wizard procedures** on `portalRouter` + a **staff read/track surface** on the existing `taxRouter`, and (5) the **W-form wizard UI** (en/en-US/de/pl/ar). No external e-sign — the existing `SigningEnvelope` (DocuSign) models in `esign.prisma` are deliberately NOT used (D-11).

**Primary recommendation:** Extend `WithholdingTaxRate` additively (two nullable columns, preserve the `@@unique` key), repurpose `serviceType` as the income-type axis (do NOT introduce a parallel `incomeType` column — see Open Question 1), build a `treaty-rate.service.ts` that mirrors `reverse-charge.service.ts`, store forms in a new immutable `TaxFormSubmission` table FK'd to `Contractor`, wire portal mutations on `portalRouter` + staff read on `taxRouter`, and gate the whole surface behind the already-registered `module.us-expansion` flag.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Treaty rate/article resolution | API service (`treaty-rate.service.ts`) | Database (`WithholdingTaxRate` lookup) | Mechanical published-table lookup; mirrors reverse-charge.service. Pure resolution function + DB read. Reused by P87 1042-S. |
| W-form storage (immutable record) | Database (`TaxFormSubmission`) | API (portal + staff routers) | Legal record of record; append-only + supersede chain. Never on `Contractor` columns (D-05). |
| W-form wizard (contractor self-cert) | Portal API (`portalRouter`) | Frontend (web-vite portal page→container→hook→component) | Beneficial owner is legally-correct signer (D-07). Mutation procedures on `portalAppRouter` only. |
| Form auto-routing (W-9 vs W-8BEN vs W-8BEN-E) | API (resolution from `countryCode` + entity type) | Frontend (confirm/override UI) | Single source of truth = existing profile; fewest wrong-form errors (D-09). |
| ESIGN attestation (perjury checkboxes + typed name + IP/ts) | API (captured into snapshot) | Database (immutable snapshot field) | Lightweight ESIGN-Act valid e-signature; NO external ceremony (D-11). |
| Staff read/track surface | Staff API (`taxRouter` extension) | Frontend (web-vite staff page) | Read/track only; PII-gated; NOT a co-equal entry path (D-08). |
| SSN/TIN reuse for W-9 | API (reuse P84 `ssnEncrypted`/`ssnLast4`/EIN) | — | Reuse P84 profile; never re-expose full SSN (D-09 discretion). |
| RBAC enforcement | Auth (`requirePermission` + Better Auth AC) | API middleware | `CONTRACTOR_PII:READ` for full-SSN reveal; staff-router only. |

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** EXTEND the existing `WithholdingTaxRate` model (`packages/db/prisma/schema/tax.prisma:23`) — add `sourceCountry='US'` rows, not a new US table. One lookup engine; P87 1042-S reuses it.
- **D-02:** `treatyReference` is free-text today — insufficient for auto-populate. Add a structured `treatyArticle` column + an `incomeType` discriminator (reuse/repurpose `serviceType` as income-type axis: independent-personal-services / business-profits). W-8BEN auto-populate reads article + rate + income type from this row.
- **D-03:** Seed the services/business-profits row per country (PL, DE, UK, UAE/AE, KSA/SA, IE, NL) with treaty article + rate — typically 0% when no US fixed base/PE. Royalties/other income out of scope. Default no-treaty = 30% statutory.
- **D-04:** Adviser-verify posture — seeded rates/articles are real but annotated for legal/tax-adviser verification. No determination presented as final legal advice.
- **D-05:** Dedicated immutable record (new `UsTaxForm`/`TaxFormSubmission` table, NOT columns on `Contractor`): `formType` (W9/W8BEN/W8BENE), `status` (draft/active/superseded), captured-field snapshot, treaty claim (article+rate+residency), signer identity, `signedAt`, `expiresAt` (~3yr), supersede chain, audit. FK to `Contractor`. Re-cert inserts new row + supersedes; never mutate a signed record.
- **D-06:** Official IRS-form PDF generation DEFERRED. Capture structured fields + immutable signed JSON snapshot + audit. Optional lightweight human-readable summary/receipt acceptable. Pixel-accurate PDFs land in P86/P87.
- **D-07:** Portal self-service PRIMARY. Contractor completes + self-certifies in the existing portal (`portalAppRouter`). Mutation procedures on `portalAppRouter`.
- **D-08:** Staff get a read/track surface (status, request/remind a form, PII-gated summary) — NOT a co-equal on-behalf entry path. Staff PII follows P84 gating (`CONTRACTOR_PII:READ`, staff-router only). Full staff "enter on behalf" deferred.
- **D-09:** Auto-route the form from existing profile + confirm/override. `countryCode='US'` → W-9; foreign individual/sole-trader → W-8BEN; foreign company → W-8BEN-E (driven by `Contractor.countryCode` + `type`). Show determination with confirm/override step.
- **D-10:** Auto-detect + override + reason — mirror `reverse-charge.service.ts`. Resolve treaty rate from (residency, US-source, income type), auto-populate W-8BEN article+rate, default 30% when no treaty/no valid form, allow manual override with required reason + `writeAuditLog`. Actual withholding deferred to P87.
- **D-11:** Lightweight ESIGN-Act e-attestation. Reproduce IRS "under penalties of perjury" language as required checkboxes + typed full legal name + date, capturing timestamp/IP/userId into immutable snapshot + audit. W-8BEN-E also captures LOB category field (line 14). NO external e-sign ceremony (DocuSign/Autenti) — deferred.
- **D-12:** Store against `Contractor` now (the `Worker` abstraction is Theme B / Phase 89, not built). Do NOT introduce a Theme-B dependency.
- **D-13:** Wizard UI fully i18n'd across en/en-US/de/pl/ar(RTL). Portal surface follows web-vite page→container→hook→component with mandatory loading/empty/error + WCAG states; `frontend-design` skill applies.

### Claude's Discretion

- Exact new column names/types on `WithholdingTaxRate` (`treatyArticle`, income-type representation) and whether `incomeType` is a Prisma enum vs reuse of `serviceType` — preserving the existing `@@unique` key shape.
- The `UsTaxForm` snapshot serialization (JSON shape) + expiry/re-cert reminder mechanics — a reminder/expiry surface may itself be a later concern.
- W-9 TIN handling: reuse P84 encrypted SSN / plain EIN vs re-collect — prefer reuse; never re-expose full SSN.
- FTIN + foreign-address capture shape for W-8BEN — mirror existing country-fields validation.
- Whether to render the optional summary receipt (D-06) and its format.

### Deferred Ideas (OUT OF SCOPE)

- Official pixel-accurate IRS W-9/W-8BEN/W-8BEN-E PDF rendering → P86/P87.
- Royalties + other income-type treaty rows → services/business-profits only this phase.
- Formal e-sign ceremony (DocuSign/Autenti) + richer structured LOB → lightweight ESIGN suffices.
- Staff "enter on behalf" as first-class path → portal self-service primary.
- Form expiry / re-certification reminder surface → `expiresAt` captured now; proactive reminder flow later.
- `Worker`-type FK → store against `Contractor`; re-point only after Theme B (P89).
- Seeded treaty-rate/article legal verification → annotated; legal/tax-adviser-deferred.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| US-FORM-01 | US-resident contractor completes a W-9 wizard (TIN + entity type + backup-withholding flag), stored against `Contractor` with audit trail | `TaxFormSubmission` model (new) + portal wizard on `portalRouter`; TIN reuses P84 `ssnEncrypted`/`ssnLast4`/EIN (`contractor-tax.ts`); audit via `writeAuditLog` (`audit-writer.ts`). Form fields → structured columns mapped below. |
| US-FORM-02 | Foreign contractor completes W-8BEN/W-8BEN-E wizard (treaty country + article picker, FTIN, certifications) | Same wizard stack; treaty article auto-populated by `treaty-rate.service.ts`; FTIN/foreign-address mirror `country-fields.ts` validators; perjury attestation per D-11. LOB field (W-8BEN-E line 14) captured. |
| US-LOC-02 | US tax-treaty rate table (PL/DE/UK/UAE/KSA/IE/NL) auto-applied when jurisdictions trigger a treaty | Extend `WithholdingTaxRate` with `sourceCountry='US'` rows (`wht-rates.ts` seed pattern); resolution mirrors `reverse-charge.service.ts`. Non-breaking — only `calculateWht` consumes the table and it is SA-gated. |
| US-LOC-03 | W-8BEN treaty-article auto-populate from contractor home jurisdiction + treaty table | New structured `treatyArticle` column read by the wizard's W-8BEN step (maps to IRS W-8BEN line 10 / W-8BEN-E line 15). |

---

## Standard Stack

### Core (all already in-tree — no new external packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma (`prisma-client` generator) | 7.x | New `TaxFormSubmission` model + `WithholdingTaxRate` extension | Repo-canonical ORM; `schema/` multi-file split [VERIFIED: codebase — `schema.prisma`] |
| tRPC v11 | 11.x | Portal mutations + staff read procedures | Repo-canonical; `portalAppRouter` already isolated [VERIFIED: codebase — `portal-root.ts`] |
| Zod | (workspace) | Input validation on every procedure + form snapshot schema | Repo convention; `country-fields.ts` validator pattern [VERIFIED: codebase] |
| react-hook-form + `@hookform/resolvers` (zod) | (workspace) | Multi-step wizard form state | Used by `organization-onboarding`, `zatca/onboarding-wizard`, `contractor-wizard` [VERIFIED: codebase] |
| `@contractor-ops/ui` reui Stepper | (workspace) | Wizard step indicator | `Stepper/StepperNav/StepperItem/StepperIndicator/StepperTitle/StepperSeparator` from `reui/stepper` [VERIFIED: codebase — `organization-onboarding.tsx:12-19`] |
| `@contractor-ops/logger` (Pino) | (workspace) | Structured logging (no `console.*`) | CLAUDE.md binding [VERIFIED: codebase] |
| `@contractor-ops/feature-flags` | (workspace) | `module.us-expansion` gating | FOUND7-02 registered the flag PENDING [VERIFIED: codebase — `flags-core.ts:211`] |

### Supporting (reuse from Phase 84)

| Library/Module | Purpose | When to Use |
|---------|---------|-------------|
| `us-validators.ts` (`isValidEin`, `isValidSsn`) | W-9 TIN format validation | W-9 wizard step + server input validation [VERIFIED: codebase] |
| `country-fields.ts` (`usEntityTypeEnum`, `usCountryFieldsSchema`) | US entity-type enum + US field schema | Form routing + W-9 entity step [VERIFIED: codebase] |
| `ssn-crypto.ts` (`encryptSsn`/`decryptSsn`) | SSN encrypt/decrypt | W-9 TIN reuse (never re-collect/re-expose) [VERIFIED: codebase — `contractor-tax.ts:10`] |
| `audit-writer.ts` (`writeAuditLog`) | Sign/override/reveal audit | Every sensitive mutation [VERIFIED: codebase] |
| `requirePermission` + Better Auth AC | RBAC | Staff PII-gated reads (`contractorPii: ['read']`) [VERIFIED: codebase — `rbac.ts`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reuse `serviceType` as income axis | New `incomeType` enum column | New column breaks the `@@unique` key shape + the existing `calculateWht` consumer expects `serviceType` as the axis already. Reuse is non-breaking; new column requires migrating the unique key. **Recommend reuse** (see Open Question 1). |
| New `TaxFormSubmission` table | Columns on `Contractor` | D-05 locks: immutability + supersede chain demand a row-per-version table; columns can't model the chain. |
| Lightweight ESIGN snapshot | Existing `SigningEnvelope`/`SigningRecipient` (DocuSign) models | D-11 defers external ceremony. The `esign.prisma` models are for provider-mediated contract signing, not self-attestation. Using them adds an `integrationConnectionId` dependency that does not exist for self-cert. |
| `zatca/stepper.tsx` (custom) | `reui/stepper` (organization-onboarding) | Both in-tree; `reui/stepper` is the newer composable idiom. Either acceptable; prefer `reui/stepper` for new wizards. |

**Installation:** No new external packages. (Verified: every dependency above resolves to a workspace package or already-installed dep.)

---

## Package Legitimacy Audit

> **N/A — no external packages installed this phase.** Every library is a workspace package (`@contractor-ops/*`) or already in the lockfile (`prisma`, `@trpc/server`, `zod`, `react-hook-form`). The 7-day-release-age gate (`pnpm-workspace.yaml` `minimumReleaseAge: 10080`) is not triggered because no `package.json` dependency lines change. If the planner discovers a need for a new dep (it should not), run the Package Legitimacy Gate before adding it.

---

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │  CONTRACTOR (portal session, magic-link)     │
                        └───────────────────┬─────────────────────────┘
                                            │ portal_session cookie
                                            ▼
              ┌──────────────────────────────────────────────────────────┐
              │  portalProcedure (portal-auth.ts)                          │
              │  → ctx.contractorId, ctx.organizationId, ctx.db (regional)│
              └──────────────────────┬───────────────────────────────────┘
                                     │
            ┌────────────────────────┼─────────────────────────────────┐
            ▼ getFormDetermination    ▼ saveDraft / submitTaxForm        ▼ getMyForms
   ┌──────────────────────┐  ┌────────────────────────────┐  ┌──────────────────┐
   │ Read Contractor      │  │ 1. Validate (Zod)          │  │ List own forms   │
   │ countryCode + type   │  │ 2. treaty-rate.service     │  │ (status, expiry) │
   │ → route W9/W8BEN/    │  │    .resolveTreaty(...)     │  └──────────────────┘
   │   W8BENE             │  │ 3. Build immutable snapshot│
   │ + auto-populate      │  │    (perjury attest + IP/ts)│
   │   article/rate       │  │ 4. supersede prior active  │
   └──────────┬───────────┘  │ 5. INSERT TaxFormSubmission│
              │              │ 6. writeAuditLog           │
              │              └───────────┬────────────────┘
              ▼                          │
   ┌──────────────────────┐             ▼
   │ treaty-rate.service  │   ┌─────────────────────────────┐
   │ resolveTreatyRate(   │   │ TaxFormSubmission (NEW)      │
   │   residency, US,     │   │ formType / status / snapshot│
   │   incomeType)        │◄──┤ treatyArticle / treatyRate  │
   │ + override+reason    │   │ signedAt / expiresAt        │
   └──────────┬───────────┘   │ supersedesId (chain)        │
              │               │ FK contractorId             │
              ▼               └─────────────────────────────┘
   ┌──────────────────────┐
   │ WithholdingTaxRate   │   ◄── seeded US rows (wht-rates.ts pattern):
   │ sourceCountry='US'   │       sourceCountry='US', residency∈{PL,DE,GB,AE,SA,IE,NL,XX},
   │ + treatyArticle      │       serviceType='business_profits', treatyRate, treatyArticle
   │ + serviceType(income)│
   └──────────────────────┘
                                     ▲
   ┌─────────────────────────────────┴────────────────────────┐
   │  STAFF (tenantProcedure)  → taxRouter extension            │
   │  • listFormSubmissions (status/track, PII-gated summary)   │
   │  • requestTaxForm / remind  • NO on-behalf entry           │
   │  • revealSsn already gated by contractorPii:read (P84)     │
   └────────────────────────────────────────────────────────────┘

   P87 (1042-S, future) reads the SAME WithholdingTaxRate row + TaxFormSubmission.treatyRate
```

### Recommended Project Structure

```
packages/db/prisma/schema/
└── tax.prisma                          # EXTEND WithholdingTaxRate (+treatyArticle, +serviceType income rows)
                                         # ADD TaxFormSubmission model + enums (TaxFormType, TaxFormStatus)
packages/db/prisma/seed/
├── wht-rates.ts                         # ADD US sourceCountry='US' rows (or new us-treaty-rates.ts + wire index.ts)
└── index.ts                            # wire new seed fn if split out
packages/api/src/services/
└── treaty-rate.service.ts              # NEW — mirror reverse-charge.service.ts (detect + resolve + override)
packages/api/src/services/
└── tax-form.service.ts                 # NEW — snapshot builder, supersede logic, expiry calc
packages/api/src/routers/portal/
├── portal-tax-form-router.ts           # NEW — portal mutations (saveDraft/submit/getDetermination/getMyForms)
└── portal.ts                           # mergeRouters(... portalTaxFormRouter)
packages/api/src/routers/core/
└── tax.ts                              # EXTEND taxRouter — staff list/track/request procedures
packages/validators/src/
├── w-form-validators.ts                # NEW — FTIN + W-form Zod schemas (per-form discriminated union)
└── us-validators.ts                    # (reuse isValidEin/isValidSsn)
apps/web-vite/src/components/portal/tax-forms/   # NEW portal wizard surface
├── tax-form-wizard.tsx                 # container (reui Stepper + RHF)
├── hooks/use-tax-form-wizard.ts        # tRPC/RHF boundary
├── step-determination.tsx              # confirm/override form routing
├── step-w9.tsx / step-w8ben.tsx / step-w8ben-e.tsx
└── step-attest.tsx                     # perjury checkboxes + typed name
apps/web-vite/src/components/contractors/tax-forms/  # NEW staff read/track surface
└── tax-form-status-card.tsx
apps/web-vite/messages/{en,de,pl,ar}.json + en-US.json  # wizard i18n keys
```

### Pattern 1: Treaty resolution mirrors reverse-charge (D-10)

**What:** A pure `resolveTreaty(...)` decision function + an `applyTreaty(...)` that loads DB and respects override.
**When to use:** Treaty rate/article resolution in the wizard and (later) P87 1042-S.
**Example (shape to replicate — verified source below):**
```typescript
// Source: packages/api/src/services/reverse-charge.service.ts:205-212 [VERIFIED: codebase]
export function resolveReverseChargeDecision(
  autoDetected: boolean,
  override: boolean | null | undefined,
): { isReverseCharge: boolean; autoDetected: boolean } {
  if (override === true) return { isReverseCharge: true, autoDetected };
  if (override === false) return { isReverseCharge: false, autoDetected };
  return { isReverseCharge: autoDetected, autoDetected };
}
// → treaty-rate.service.ts analog: resolveTreatyDecision(autoRate, autoArticle, overrideRate, overrideReason)
//   returns { rate, article, source: 'treaty'|'override'|'statutory_30', autoDetected }.
//   Override path REQUIRES a reason → writeAuditLog (D-10).
```

### Pattern 2: Treaty rate lookup mirrors `calculateWht` (D-01/D-02)

```typescript
// Source: packages/api/src/services/tax-rate.service.ts:117-145 [VERIFIED: codebase]
// Existing lookup: specific residency first, then 'XX' fallback, prefer treaty when not XX.
const rate = await prisma.withholdingTaxRate.findFirst({
  where: {
    sourceCountry: 'US',                                  // NEW US rows
    contractorResidency: { in: [contractorResidency, 'XX'] },
    serviceType: 'business_profits',                      // income-type axis (D-02 reuse)
    effectiveFrom: { lte: paymentDate },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: paymentDate } }],
  },
  orderBy: { contractorResidency: 'asc' },                // specific before 'XX'
});
// treaty-rate.service additionally reads `rate.treatyArticle` (new column) for line-10 auto-populate.
// Default when no row / no valid form: 30% statutory (D-03/D-10).
```

### Pattern 3: Immutable supersede-able record (D-05)

`TaxFormSubmission` follows the `WhtCertificate` immutability discipline (append-only; audit is `create`-only per `audit.prisma` contract). Re-cert = `INSERT new row` + `UPDATE prior.status = 'superseded'` + set `prior.supersededById`. Wrap in `ctx.db.$transaction` so the supersede + insert + audit commit atomically (mirror `portal-profile-router.ts:403` `$transaction` usage [VERIFIED: codebase]).

### Pattern 4: Portal mutation procedure (D-07)

```typescript
// Source: packages/api/src/routers/portal/portal-profile-router.ts (shape) [VERIFIED: codebase]
submitTaxForm: portalProcedure                            // cookie session → ctx.contractorId
  .input(taxFormSubmissionSchema)                         // Zod discriminated union per formType
  .mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async tx => {
      // 1. resolve treaty (treaty-rate.service)
      // 2. build immutable snapshot (perjury attest + ctx IP + Date.now() + ctx.contractorId)
      // 3. supersede prior active form for this contractor+formType
      // 4. insert TaxFormSubmission
      // 5. writeAuditLog({ tx, actorType: 'CONTRACTOR', actorId: ctx.contractorId, ... })
    });
  }),
```
**IP capture:** the portal context exposes request `ctx.headers`; derive client IP server-side (do NOT trust a client-supplied IP field) — mirror how `portal-shared.ts` treats inbound headers as untrusted (`deriveBaseUrl` security note [VERIFIED: codebase]).

### Pattern 5: Module-flag router gating (`module.us-expansion`)

```typescript
// Source: packages/api/src/root.ts:145-211 (conditionalClassificationRouters) [VERIFIED: codebase]
// Mirror the CLASSIFICATION_ENABLED pattern: module-level flag check + conditional spread.
// Defense-in-depth: a portal/tenant-level procedure guard ALSO blocks per-request
// (classification uses classificationProcedure middleware). Apply the same to US-form procedures.
```

### Anti-Patterns to Avoid

- **New `incomeType` column that breaks the `@@unique` key** — the unique key is `[sourceCountry, contractorResidency, serviceType, effectiveFrom]`. Adding a 5th key field requires a key migration AND updating the seed `upsert` `where` clause AND the `calculateWht` lookup. Reuse `serviceType` (D-02 explicitly permits "reuse/repurpose").
- **Storing SSN/full-TIN in the form snapshot in plaintext** — the W-9 TIN must reference the encrypted P84 column or store last-4 only in the snapshot. Full SSN in a JSON snapshot would bypass the `contractorPii:read` gate and the `pii-mask.ts` log mask.
- **Putting form mutations on the staff `appRouter`** — D-07 locks portal-primary; the beneficial owner signs. Staff get read/track only (D-08).
- **Using `SigningEnvelope`/DocuSign models for self-attestation** — D-11 defers external e-sign; these models require an `integrationConnectionId`.
- **Mutating a signed `TaxFormSubmission`** — append-only; re-cert inserts + supersedes (D-05).
- **Hardcoded user-facing strings** — every wizard label is i18n'd (D-13); `i18n:parity` gate enforces en/de/pl/ar, en-US via fallback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Treaty rate/article resolution | Custom if/else jurisdiction logic | `treaty-rate.service.ts` mirroring `reverse-charge.service.ts` + DB lookup | Override-precedence + audit shape already solved; consistency with reverse-charge |
| Override-with-reason decision | Inline ternaries scattered across procedures | `resolveTreatyDecision()` pure fn | Tested-once, reused by wizard + P87 |
| Audit log writes | Direct `prisma.auditLog.create` | `writeAuditLog()` | Append-only discipline + actor-type defaults + tx support [VERIFIED: `audit-writer.ts`] |
| SSN encryption | New crypto | `ssn-crypto.ts` (`encryptSsn`/`decryptSsn`) | P84 dedicated `SSN_ENCRYPTION_KEY` blast-radius separation |
| EIN/SSN validation | New regex | `isValidEin`/`isValidSsn` | P84 IRS-prefix + SSA-range tables |
| RBAC check | Manual role string compare | `requirePermission({ contractorPii: ['read'] })` | Better Auth AC + API-key scope path |
| Wizard step state | Custom step index reducer | react-hook-form + `reui/stepper` | Validation-per-step + a11y already wired |
| Tenant/region DB routing | Manual `getRegionalClient` in each procedure | `portalProcedure`/`tenantProcedure` `ctx.db` | Middleware already attaches regional tenant client |

**Key insight:** This phase has almost zero novel infrastructure. Every cross-cutting concern (audit, crypto, RBAC, tenant routing, flags, wizard, treaty lookup) has an in-tree owner. The risk is *re-implementing* one of these, not *missing* one.

---

## Runtime State Inventory

> This is an additive feature phase, not a rename/refactor. A focused inventory is still warranted because it touches a shared reference table and a regional DB.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `WithholdingTaxRate` table: today holds ONLY `sourceCountry='SA'` rows (verified: `wht-rates.ts` seeds only SA). US rows are net-new inserts — zero collision. New `TaxFormSubmission` table starts empty. | Data seed (US rows) + schema migration (new table + 2 columns) |
| Live service config | None. No Unleash toggle exists yet for `module.us-expansion` in the live instance (flag registered PENDING in code; backing Unleash toggle "created in later theme phases" per `flags-core.ts:209`). | Engineers dev with `FLAG_SIGNOFF_BYPASS=local`; production toggle creation is a deploy concern, not a code task |
| OS-registered state | None. | None |
| Secrets/env vars | `SSN_ENCRYPTION_KEY` (P84) reused for W-9 TIN — no new key. Regional `DATABASE_URL_US` already added (FOUND7-03, verified in `migrate-all-regions.ts:43`). | None new |
| Build artifacts | Prisma client regenerates on schema change (`prisma generate` → `src/generated/prisma/client`). Stale generated client after adding `TaxFormSubmission` → typecheck fails until regenerated. | `pnpm --filter @contractor-ops/db db:generate` after schema edit (BLOCKING — see Environment) |

**Critical non-breakage verification:** `grep` for `withholdingTaxRate` consumers returns exactly three files: the seed (`wht-rates.ts`), the lint allowlist (`global-lookup-allowlist.ts`), and `tax-rate.service.ts`. The only *runtime* consumer is `calculateWht`, which returns `null` for `orgCountry !== 'SA'`. **US rows cannot affect any existing Gulf WHT or payment path.** [VERIFIED: codebase grep + read of `tax-rate.service.ts:104-114`]

---

## W-Form Field → Structured Column Map

> IRS line numbers CITED from irs.gov form instructions (Rev. October 2021 forms). Treaty article/rate values are ASSUMED/adviser-deferred (D-04).

### W-9 (US persons) — US-FORM-01
| Field | IRS line | Source / target | Notes |
|-------|----------|-----------------|-------|
| Name | Line 1 | `Contractor.legalName` (reuse) | |
| Business/entity name | Line 2 | `Contractor.displayName` (reuse) | |
| Federal tax classification | Line 3a | `usEntityTypeEnum` (`countryFields`) → snapshot | `SOLE_PROPRIETOR/LLC/C_CORP/S_CORP/PARTNERSHIP/INDIVIDUAL` [VERIFIED: `country-fields.ts:236`] |
| TIN (SSN or EIN) | Part I | Reuse P84 `ssnEncrypted`/`ssnLast4` (SSN) or `countryFields.ein` (EIN) | NEVER re-collect/store full SSN in snapshot — store last-4 + reference (D-09) |
| Backup-withholding flag | Part II cert item 2 | NEW snapshot field `backupWithholding: boolean` | Contractor attests not subject to backup withholding |
| Certification (signature) | Part II | ESIGN attestation block (D-11) | Perjury checkbox + typed name + ts/IP |

### W-8BEN (foreign individuals) — US-FORM-02 / US-LOC-03
| Field | IRS line | Source / target | Notes |
|-------|----------|-----------------|-------|
| Name / country of citizenship | Line 1 / 2 | `Contractor.legalName` / `countryCode` | |
| Permanent residence address | Line 3 | NEW FTIN/foreign-address capture (mirror `country-fields`) | |
| FTIN (foreign TIN) | Line 6a | NEW snapshot field `ftin` | Validate format loosely (no US algorithm); store as captured |
| Treaty country claim | Line 9 | `Contractor.countryCode` → resolve | |
| **Special rates and conditions / treaty article** | **Line 10** | **`WithholdingTaxRate.treatyArticle` + `treatyRate` (auto-populate)** [CITED: irs.gov/instructions/iw8ben] | Line 10 used when claiming a specific rate requiring conditions (e.g. business profits not attributable to a US PE) |
| Certification (signature) | Part III | ESIGN attestation block | Perjury + typed name + date |

### W-8BEN-E (foreign entities) — US-FORM-02
| Field | IRS line | Source / target | Notes |
|-------|----------|-----------------|-------|
| Org name / country | Line 1 / 2 | `Contractor.legalName` / `countryCode` | |
| Chapter-3 status (entity type) | Line 4 | NEW snapshot field (entity classification) | |
| **LOB category (Limitation on Benefits)** | **Line 14b** | **NEW snapshot field `lobCategory`** [CITED: irs.gov/instructions/iw8bene] | D-11 explicitly requires capturing LOB category; check exactly one box |
| Treaty country claim | Line 14a | `Contractor.countryCode` | |
| **Special rates and conditions / treaty article** | **Line 15** | **`WithholdingTaxRate.treatyArticle` + `treatyRate`** [CITED: irs.gov/instructions/iw8bene] | W-8BEN-E uses line 15 (not 10) for special rate explanation |
| FTIN | Line 9b | NEW snapshot field `ftin` | |
| Certification (signature) | Part XXX | ESIGN attestation block | |

---

## Common Pitfalls

### Pitfall 1: `ContractorType` enum ≠ `usEntityTypeEnum` (form-routing mismatch)
**What goes wrong:** D-09 routes by "individual/sole-trader → W-8BEN, company → W-8BEN-E". But the Prisma `ContractorType` is `SOLE_TRADER | COMPANY | INDIVIDUAL_FREELANCER | OTHER` while the US entity type lives in `countryFields` JSONB as `SOLE_PROPRIETOR | LLC | C_CORP | S_CORP | PARTNERSHIP | INDIVIDUAL`. Routing off the wrong field misclassifies forms.
**Why it happens:** Two parallel type axes — the coarse `Contractor.type` column vs the fine-grained US `countryFields.entityType`.
**How to avoid:** For W-9 vs W-8 routing use `Contractor.countryCode === 'US'` (the decisive axis). For W-8BEN vs W-8BEN-E among foreign contractors, route on `Contractor.type` (`COMPANY` → W-8BEN-E; `SOLE_TRADER`/`INDIVIDUAL_FREELANCER` → W-8BEN). The fine-grained US entity type is only relevant for the W-9 line-3a classification, not the foreign-form split. Confirm the mapping in plan-phase and surface a confirm/override step (D-09) for edge cases.
**Warning signs:** A foreign sole-trader incorrectly offered W-8BEN-E.

### Pitfall 2: Duplicated `owner.allPermissions` (RBAC silent gap)
**What goes wrong:** Adding a new permission to `permissions.ts` `accessControlStatement` without also adding it to the DUPLICATE `allPermissions` const in `roles.ts` silently drops it from the `owner` role.
**Why it happens:** `roles.ts:18-42` `allPermissions` is a hand-maintained copy of the statement (Better Auth v1.5.5 bug workaround, documented in-file).
**How to avoid:** This phase likely does NOT need a new permission — `contractorPii:read` already exists for the full-SSN reveal, and form read/track can reuse `contractor:read`. **Do not add a new permission unless a genuinely new resource emerges.** If one is added, edit BOTH `permissions.ts` AND `roles.ts` `allPermissions`. [VERIFIED: codebase — `roles.ts:38-41` comment]

### Pitfall 3: Treaty rate stored as percent vs fraction
**What goes wrong:** `WithholdingTaxRate.treatyRate` is `Decimal(5,2)` storing whole-number percent (e.g. `5.00`, `0.00`, `30.00`). `calculateWht` divides by 100 (`grossAmountMinor * appliedRate / 100`). A new US row storing `0.30` instead of `30.00` would under-withhold 100×.
**How to avoid:** Seed US rows in percent units (`30.00`, `0.00`) consistent with the SA rows. [VERIFIED: codebase — `wht-rates.ts` uses `5.0`/`20.0`; `tax-rate.service.ts:135` divides by 100]

### Pitfall 4: Snapshot mutability after sign
**What goes wrong:** Treating `TaxFormSubmission` like a regular updatable row — editing a signed form retroactively destroys the legal record.
**How to avoid:** Status machine `draft → active → superseded`; only `draft` rows are mutable. `active`/`superseded` are append-only. Re-cert inserts a new row (D-05). Consider a DB-level guard or service-layer assertion that rejects updates to non-draft rows.

### Pitfall 5: Regional DB migration drift (US not migrated)
**What goes wrong:** Running `prisma migrate deploy` against EU only leaves the US region (`DATABASE_URL_US`) without the new table — US contractors hit "table does not exist" at runtime.
**How to avoid:** Use `pnpm --filter @contractor-ops/db db:migrate:all` (`migrate-all-regions.ts`) which iterates EU/ME/US and fails fast. [VERIFIED: codebase — `migrate-all-regions.ts:43`]. This is a BLOCKING task (see Environment).

### Pitfall 6: i18n parity gate fails on new wizard keys
**What goes wrong:** Adding English wizard keys without de/pl/ar translations red-CIs the `i18n:parity` gate.
**How to avoid:** Add all keys to en/de/pl/ar in the same change set; en-US inherits via fallback (P84 D-04 — en-US is fallback-parity, not literal-key parity). [VERIFIED: 84-CONTEXT.md D-04]

---

## Code Examples

### Extending `WithholdingTaxRate` (additive, preserves unique key)
```prisma
// Source: packages/db/prisma/schema/tax.prisma:23 (EXTEND) [VERIFIED: codebase]
model WithholdingTaxRate {
  id                  String    @id @default(cuid())
  sourceCountry       String    @db.Char(2)
  contractorResidency String    @db.Char(2)
  serviceType         String    @db.VarChar(50)   // repurposed as income-type axis for US rows: 'business_profits'
  standardRate        Decimal   @db.Decimal(5, 2)
  treatyRate          Decimal?  @db.Decimal(5, 2)
  treatyReference     String?   @db.VarChar(100)  // existing free-text (keep)
  treatyArticle       String?   @db.VarChar(40)   // NEW — structured, e.g. "Article 7" (D-02)
  effectiveFrom       DateTime  @db.Date
  effectiveTo         DateTime? @db.Date
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([sourceCountry, contractorResidency, serviceType, effectiveFrom]) // UNCHANGED
  @@index([sourceCountry])
  @@index([sourceCountry, contractorResidency])
}
```

### US treaty seed rows (mirror `wht-rates.ts` upsert)
```typescript
// Source: packages/db/prisma/seed/wht-rates.ts (pattern) [VERIFIED: codebase]
// ASSUMED rates — adviser-verify (D-04). Business profits / independent personal services,
// typically 0% when no US permanent establishment / fixed base.
const usTreatyRates = [
  { sourceCountry: 'US', contractorResidency: 'PL', serviceType: 'business_profits',
    standardRate: 30.0, treatyRate: 0.0, treatyArticle: 'Article 7',
    treatyReference: 'US-Poland Income Tax Treaty (2013) Article 7', effectiveFrom: new Date('2014-01-01') },
  { sourceCountry: 'US', contractorResidency: 'DE', serviceType: 'business_profits',
    standardRate: 30.0, treatyRate: 0.0, treatyArticle: 'Article 7',
    treatyReference: 'US-Germany Income Tax Treaty Article 7', effectiveFrom: new Date('2008-01-01') },
  // ... GB, AE, SA, IE, NL  + 'XX' fallback (treatyRate: null → 30% statutory)
];
// NOTE: every rate/article value below is [ASSUMED] — see Assumptions Log. Annotate as adviser-deferred.
```

### `TaxFormSubmission` model (new)
```prisma
// NEW model — immutable, supersede-able (D-05)
enum TaxFormType   { W9  W8BEN  W8BENE }
enum TaxFormStatus { DRAFT  ACTIVE  SUPERSEDED }

model TaxFormSubmission {
  id              String        @id @default(cuid())
  organizationId  String
  contractorId    String                                  // FK Contractor (D-12)
  formType        TaxFormType
  status          TaxFormStatus @default(DRAFT)
  snapshotJson    Json                                    // immutable captured fields + ESIGN attest + IP/ts/userId
  treatyArticle   String?       @db.VarChar(40)           // resolved claim (US-LOC-03)
  treatyRate      Decimal?      @db.Decimal(5, 2)
  contractorResidency String?   @db.Char(2)
  signerName      String?                                 // typed full legal name (D-11)
  signedAt        DateTime?
  expiresAt       DateTime?                               // W-8BEN ~3yr (D-05)
  supersededById  String?       @unique                   // supersede chain
  createdAt       DateTime      @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  contractor   Contractor   @relation(fields: [contractorId], references: [id])
  supersededBy TaxFormSubmission? @relation("Supersede", fields: [supersededById], references: [id])
  supersedes   TaxFormSubmission? @relation("Supersede")

  @@index([organizationId, contractorId, formType, status])
  @@index([organizationId, status, expiresAt])
}
```
*(Planner: add the back-relations on `Contractor` + `Organization` models — Prisma requires the inverse side.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text `treatyReference` only | Structured `treatyArticle` column for auto-populate | This phase (D-02) | Enables W-8BEN line-10 / W-8BEN-E line-15 auto-fill |
| WHT table SA-only | Multi-source-country (`US` rows added) | This phase (D-01) | Same engine feeds Gulf WHT cert + US 1042-S (P87) |
| Tax classification on `Contractor` columns | Dedicated immutable `TaxFormSubmission` | This phase (D-05) | Legal record-of-record + supersede chain |
| Current IRS forms | **W-9 (Rev. Oct 2021), W-8BEN (Rev. Oct 2021), W-8BEN-E (Rev. Oct 2021)** [CITED: irs.gov] | n/a | Line numbers above match these revisions — verify no newer revision before plan locks line refs |

**Deprecated/outdated:** None applicable. Note: confirm the current IRS form revision at plan-time — if the IRS released a 2024/2025 revision, the line numbers (esp. W-8BEN-E LOB line 14b) may shift. [ASSUMED: Oct-2021 revisions are still current as of research]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | US-Poland treaty business-profits WHT = 0% (Article 7, no PE) | Seed example | Wrong rate seeded → wrong auto-populate. Adviser-deferred (D-04). Mitigated: all rates annotated; planner seeds as placeholders pending verification. |
| A2 | US-DE/GB/AE/SA/IE/NL business-profits rates + article numbers | Seed | Same as A1 — every per-country rate/article is ASSUMED and adviser-deferred. |
| A3 | W-8BEN treaty article belongs on line 10; W-8BEN-E on line 15; LOB on line 14b | Field map | CITED from irs.gov instructions but line numbers are revision-dependent. Risk: form revision changed. Verify current revision at plan-time. |
| A4 | Oct-2021 form revisions are current as of 2026-06 | State of the Art | A newer revision would shift line numbers. Low risk for engine; medium for any printed summary receipt. |
| A5 | W-8BEN vs W-8BEN-E split routes on `Contractor.type` (COMPANY → BEN-E) | Pitfall 1 / D-09 | Edge cases (e.g. foreign single-member LLC) may need override — D-09 confirm/override step covers this. |
| A6 | UAE/KSA have NO US income-tax treaty (so foreign contractors there default to 30% unless other relief) | Seed scope | The phase lists UAE/KSA in the treaty set (D-03) — but the US has no comprehensive income-tax treaty with UAE or KSA. Planner MUST confirm: these likely seed as `treatyRate: null` (30% statutory) rows, NOT reduced-rate rows. HIGH-IMPACT — flag for adviser/user. |

**A6 is the highest-risk assumption** — the phase scope (PL/DE/UK/UAE/KSA/IE/NL) mixes treaty countries (PL, DE, UK, IE, NL have US treaties) with non-treaty countries (UAE, KSA have no US income-tax treaty). Surface this in discuss/plan: UAE/KSA rows should almost certainly be 30%-statutory (no treaty), which still validly exercises the "no treaty → 30%" default path.

---

## Open Questions

1. **`incomeType` representation: reuse `serviceType` vs new column?**
   - What we know: D-02 says "reuse/repurpose `serviceType`". The `@@unique` key includes `serviceType`; `calculateWht` already treats it as the discriminating axis; the seed `upsert` keys on it.
   - What's unclear: whether the planner wants a typed enum for clarity.
   - **Recommendation:** Reuse `serviceType` with the literal `'business_profits'` (and optionally `'independent_personal_services'`). A typed Zod enum (`whtServiceTypeEnum` already exists in validators) can constrain inputs without a schema change. Adding a 5th unique-key column is a breaking migration — avoid. **HIGH confidence this is correct per D-02.**

2. **Where does the W-9 backup-withholding flag live — snapshot only or also on `Contractor`?**
   - What we know: D-05 says capture in the immutable snapshot.
   - Recommendation: snapshot field only (the form is the record); if a payment-run path later needs it, denormalize then (P86). Don't pre-build.

3. **Staff "request a form / remind" — does a notification flow exist to reuse?**
   - What we know: there's a `notificationRouter` + `reminderRouter` in `appRouter` and portal notification preferences. D-08 mentions "request/remind a form".
   - Recommendation: plan-phase to check `notification`/`reminder` router surface; the reminder *delivery* may be deferrable (the deferred list includes "Form expiry / re-cert reminder surface"). A request-form action that flags status is in-scope; the email is likely deferrable.

4. **Does the portal context expose client IP for the attestation snapshot?**
   - What we know: `portalProcedure` has `ctx.headers`. P84 USPS rate-limiter and `portal-shared` derive values server-side.
   - Recommendation: derive IP from request headers server-side (e.g. `x-forwarded-for` first hop, validated) — confirm the deployment's trusted-proxy header at plan-time; never accept a client-body IP.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Prisma migrate (multi-region) | Schema change (new table + columns) | ✓ | `db:migrate:all` script present | — |
| `DATABASE_URL_US` | US region table | ✓ (env present per FOUND7-03) | — | `migrate-all-regions.ts` skips-on-missing locally |
| `prisma generate` | Typed client for new model | ✓ | `db:generate` script | typecheck blocks until run |
| `module.us-expansion` flag | Surface gating | ✓ registered PENDING | `flags-core.ts:211` | `FLAG_SIGNOFF_BYPASS=local` for dev |
| `SSN_ENCRYPTION_KEY` | W-9 TIN reuse | ✓ (P84) | — | — |
| vitest | Validation Architecture | ✓ | `packages/api/vitest.config.ts` | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Local `DATABASE_URL_US` may be unset — `migrate-all-regions.ts` skips it (no-op locally); CI/prod must have it.

### BLOCKING migration task (planner MUST include)

This phase changes the Prisma schema (new `TaxFormSubmission` model + 2 columns + 2 enums + back-relations on `Contractor`/`Organization`). Sequence:
1. Edit `tax.prisma` + add back-relations.
2. `pnpm --filter @contractor-ops/db db:generate` (regenerate client — typecheck depends on it).
3. Create migration: `pnpm --filter @contractor-ops/db db:migrate:dev` (generates SQL).
4. Apply across regions: `pnpm --filter @contractor-ops/db db:migrate:all` (EU/ME/US).
5. Seed US rows: extend `wht-rates.ts` (or new seed fn wired in `seed/index.ts`).

This is a `checkpoint`-grade BLOCKING step — downstream router/wizard tasks cannot typecheck or run until the client is regenerated. (Repo uses `prisma migrate`, NOT `prisma db push` — verified: only `db:migrate:*` scripts exist in `packages/db/package.json`.)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (turbo-orchestrated) |
| Config file | `packages/api/vitest.config.ts` (services + routers); `apps/web-vite/vitest.config.ts` (UI) |
| Quick run command | `pnpm --filter @contractor-ops/api test src/services/__tests__/treaty-rate.service.test.ts` |
| Full suite command | `pnpm --filter @contractor-ops/api test` (NEVER run full web-vite suite unscoped — see CLAUDE.md memory) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| US-LOC-02 | US treaty row resolves correct rate by (residency, US, income type); specific beats 'XX' | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/treaty-rate.service.test.ts` | ❌ Wave 0 |
| US-LOC-02 | No treaty row → 30% statutory default | unit | same file | ❌ Wave 0 |
| US-LOC-02 | US rows do NOT affect `calculateWht` SA path (non-breakage regression) | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/tax-rate.service.test.ts` | ✅ extend existing |
| US-LOC-03 | W-8BEN article auto-populates from residency + treaty row | unit | treaty-rate.service test | ❌ Wave 0 |
| US-LOC-02/03 | Manual override + reason wins over auto; emits audit | unit | treaty-rate.service test | ❌ Wave 0 |
| US-FORM-01 | W-9 submit inserts immutable row; supersede prior; audit row written | integration | `pnpm --filter @contractor-ops/api test src/routers/portal/__tests__/tax-form.test.ts` | ❌ Wave 0 |
| US-FORM-01 | Re-cert inserts NEW row + sets prior status=SUPERSEDED (immutability) | integration | same | ❌ Wave 0 |
| US-FORM-01 | Full SSN never appears in snapshot / portal response (PII) | integration | same (assert no `ssnEncrypted`/full SSN in output) | ❌ Wave 0 |
| US-FORM-02 | W-8BEN-E captures LOB category (line 14) + treaty article (line 15) | integration | same | ❌ Wave 0 |
| US-FORM-02 | Foreign company → W-8BEN-E; foreign individual → W-8BEN (routing) | unit | `src/services/__tests__/tax-form-routing.test.ts` | ❌ Wave 0 |
| US-FORM-01/02 | ESIGN attestation captures typed name + ts + IP + contractorId into snapshot | integration | tax-form integration test | ❌ Wave 0 |
| US-FORM-01/02 | Staff read/track surface returns status without leaking full SSN (RBAC) | integration | `src/routers/core/__tests__/tax-form-staff.test.ts` | ❌ Wave 0 |
| US-FORM-01/02 | Wizard renders loading/empty/error + RTL (ar) parity | component (web-vite) | `pnpm --filter @contractor-ops/web-vite test src/components/portal/tax-forms` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new/extended test file for the task (`pnpm --filter @contractor-ops/api test <path>`).
- **Per wave merge:** `pnpm --filter @contractor-ops/api test` (API package full) + scoped web-vite component tests by path.
- **Phase gate:** API package green + scoped web-vite green + `pnpm typecheck` + `pnpm check:web-vite-data-layer` (page→container→hook→component) + `i18n:parity` gate + `check:wiki-brain` before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/treaty-rate.service.test.ts` — covers US-LOC-02/03 (resolution, override, default, auto-populate)
- [ ] `packages/api/src/services/__tests__/tax-form-routing.test.ts` — form-routing logic (US-FORM-01/02)
- [ ] `packages/api/src/routers/portal/__tests__/tax-form.test.ts` — portal submit/draft/supersede/PII/ESIGN (needs portal-session test harness — pattern exists in portal session tests)
- [ ] `packages/api/src/routers/core/__tests__/tax-form-staff.test.ts` — staff read/track RBAC
- [ ] Extend `packages/api/src/services/__tests__/tax-rate.service.test.ts` — US-rows-don't-break-SA regression
- [ ] `apps/web-vite/src/components/portal/tax-forms/__tests__/` — wizard states + RTL
- [ ] Framework install: none (vitest present)

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` → treated as ENABLED.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Portal magic-link session (`portalProcedure` cookie); staff Better Auth session [VERIFIED: `portal-auth.ts`] |
| V3 Session Management | yes | HMAC-signed portal session token (`signPortalSessionToken`) [VERIFIED: `portal-shared.ts`] |
| V4 Access Control | yes | `requirePermission({ contractorPii: ['read'] })` for full-SSN reveal; tenant scoping via `ctx.organizationId` (never client input); portal forms scoped to `ctx.contractorId` |
| V5 Input Validation | yes | Zod on every procedure (form discriminated union); `safeParse` on any external/header-derived value |
| V6 Cryptography | yes | `ssn-crypto.ts` AES-256-GCM (dedicated `SSN_ENCRYPTION_KEY`) — never hand-roll; reuse for any TIN at rest |
| V7 Error/Logging | yes | `writeAuditLog` on sign/override/reveal; `pii-mask.ts` masks SSN/EIN in logs (P84 D-08) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Full SSN/TIN leakage via form snapshot JSON | Information Disclosure | Store last-4 + encrypted reference only; never plaintext SSN in `snapshotJson`; assert in tests |
| Cross-contractor form access (IDOR) | Elevation of Privilege | Scope all portal reads/writes to `ctx.contractorId` (never trust client `contractorId`); mirror `portal-profile-router` |
| Cross-tenant form access | Elevation of Privilege | `ctx.organizationId` from session; `ctx.db` regional tenant client auto-scopes |
| Forged attestation IP/identity | Tampering / Repudiation | Derive IP + userId server-side from session/headers; never accept client-supplied IP/identity in the snapshot |
| Mutating a signed legal record | Tampering / Repudiation | Append-only `TaxFormSubmission`; reject updates to non-DRAFT status; supersede chain |
| Treaty-rate tampering via override | Tampering | Override requires reason + `writeAuditLog`; auto-detected value persisted alongside for audit (mirror `resolveReverseChargeDecision`) |
| Staff on-behalf signing (weak cert) | Repudiation | D-08 — staff cannot sign; portal self-cert only (beneficial owner signs under perjury) |

---

## Project Constraints (from CLAUDE.md)

- **Documentation-follows-code (GATED):** same change set must update `wiki/structure/prisma-schema-areas.md` (`WithholdingTaxRate` + `TaxFormSubmission`), `wiki/structure/api-routers-catalog.md` (new portal + tax procedures), `wiki/structure/web-vite-domains.md` (wizard surface), a US-tax domain page, `wiki/log.md` + `hot.md`, `.planning/MEMORY.md` (new invariant), and `graphify update` after wiring changes. `pnpm check:wiki-brain` before done.
- **Tenant from session:** `organizationId`/region from session, never client input.
- **Zod at every boundary:** portal mutations, staff procedures, form snapshot, env.
- **No `console.*`:** `@contractor-ops/logger` only.
- **Feature flags via wrapper:** `@contractor-ops/feature-flags` (`module.us-expansion`); no direct Unleash SDK.
- **web-vite layering:** page (thin) → container (`*-container.tsx`, section states) → hook (`use-*.ts`, sole tRPC boundary) → component (presentational). `pnpm check:web-vite-data-layer`. DialogBody/DialogFooter convention if dialogs used.
- **UI skills:** `frontend-design` SKILL.md MANDATORY before web-vite edits, then `impeccable` + `PRODUCT.md` register for product surfaces (NEVER `design-taste-frontend` on product wizards). `semble search` before edits.
- **7-day release age:** no new deps expected; if any, respect `minimumReleaseAge` + `pnpm audit`/`security:scan`.
- **No planning-ID breadcrumbs in source comments** (`lint:no-breadcrumbs`) — real domain IDs (W-8BEN, W-9, 1042-S, Article 7) are fine; phase/req IDs are not.
- **`writeAuditLog` on sensitive mutations**, pass `tx` in transactions.
- **Read before Edit** on existing files; Edit > Write; minimal diff; no bulk sed/scripts.
- **en-US fallback-parity** (P84) — en-US inherits en; do not add en-US to strict `i18n:parity` peers.

---

## Sources

### Primary (HIGH confidence)
- Codebase (verified by Read): `tax.prisma:23` (`WithholdingTaxRate`), `wht-rates.ts` (seed), `reverse-charge.service.ts` (resolution pattern), `tax-rate.service.ts:104-145` (only runtime consumer, SA-gated), `wht-certificate.service.ts` (immutability analog), `portal-root.ts` / `portal.ts` / `portal-profile-router.ts` / `portal-auth.ts` / `portal-shared.ts` (portal surface), `audit-writer.ts` (`writeAuditLog`), `rbac.ts` (`requirePermission`), `permissions.ts` + `roles.ts` (`contractorPii`, duplicated-owner pitfall), `us-validators.ts` + `country-fields.ts` (validators + `usEntityTypeEnum`), `contractor-tax.ts` (`revealSsn`, `updateUsProfile`, `ssn-crypto`), `contractor.prisma:9-60` (Contractor + `ContractorType` enum), `esign.prisma` (DocuSign models — NOT used), `organization-onboarding.tsx` + `zatca/onboarding-wizard.tsx` (wizard idiom), `root.ts:145-211` (module-flag router gating), `flags-core.ts:211` + `signoff-registry-flags.json:98` (`module.us-expansion` PENDING), `migrate-all-regions.ts:43` (`DATABASE_URL_US`), `global-lookup-allowlist.ts:21` (`WithholdingTaxRate` global lookup), `.planning/config.json` (nyquist_validation true).
- IRS official instructions [CITED]:
  - W-8BEN line 10 (special rates / treaty article): https://www.irs.gov/instructions/iw8ben
  - W-8BEN-E line 14b (LOB) + line 15 (special rates): https://www.irs.gov/instructions/iw8bene
  - Requester instructions (validation): https://www.irs.gov/instructions/iw8

### Secondary (MEDIUM confidence)
- KPMG "Validating Form W-8BEN and BEN-E Treaty Claims": https://kpmg.com/kpmg-us/content/dam/kpmg/pdf/2023/073123-validating-form-w-8ben.pdf (line-10/15 usage corroboration)
- IRS tax treaty tables (rate verification deferred to adviser): https://www.irs.gov/individuals/international-taxpayers/tax-treaty-tables

### Tertiary (LOW confidence — ASSUMED, adviser-deferred)
- All specific per-country US treaty rates + article numbers (A1, A2) — ASSUMED training knowledge; D-04 mandates legal/tax-adviser verification before production.
- A6 (UAE/KSA no US income-tax treaty) — ASSUMED but high-confidence-direction; flag for confirmation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified in-tree; zero new external packages.
- Architecture: HIGH — all patterns (treaty lookup, override+audit, portal procedure, immutable record, wizard, flag gating) read and verified in the codebase.
- Field map / IRS line numbers: MEDIUM-HIGH — CITED from irs.gov but revision-dependent (verify current revision at plan-time).
- Treaty rate VALUES: LOW — ASSUMED, adviser-deferred per D-04; seed as annotated placeholders.
- Pitfalls: HIGH — derived from verified code (enum mismatch, duplicated-owner, percent units, regional migration) + project memory.

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (codebase patterns stable; re-verify IRS form revision + treaty rates with adviser before production)
