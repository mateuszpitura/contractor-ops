# Phase 85: Theme A — W-Form Intake + Tax-Treaty Engine - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 18 new/modified
**Analogs found:** 17 / 18 (1 partial — portal-tax-form integration test harness)

> Every analog below was Read in-tree and verified this session — the RESEARCH.md
> file/pattern map is confirmed accurate. Line numbers are load-bearing for the
> planner; copy from the cited ranges. This is a pattern-replication phase: almost
> nothing is novel infrastructure.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema/tax.prisma` (EXTEND `WithholdingTaxRate` + ADD `TaxFormSubmission`) | model/migration | CRUD | self (`WithholdingTaxRate` L23) + `WhtCertificate` L41 (immutable record) | exact |
| `packages/db/prisma/seed/wht-rates.ts` (ADD US rows) | seed/config | batch | self (SA seed rows + `upsert` L147-162) | exact |
| `packages/db/prisma/seed/index.ts` (wire if seed split out) | config | batch | self (L30-34 `main()`) | exact |
| `packages/api/src/services/treaty-rate.service.ts` (NEW) | service | transform/lookup | `reverse-charge.service.ts` (detect+resolve+override) + `tax-rate.service.ts` `calculateWht` L104-146 (DB lookup) | exact |
| `packages/api/src/services/tax-form.service.ts` (NEW — snapshot/supersede/expiry) | service | CRUD | `wht-certificate.service.ts` (immutable create) + `audit-writer.ts` | role-match |
| `packages/api/src/routers/portal/portal-tax-form-router.ts` (NEW) | router | request-response/CRUD | `portal-profile-router.ts` (`portalProcedure` + `$transaction` + `writeAuditLog` L383-470) | exact |
| `packages/api/src/routers/portal/portal.ts` (MERGE new router) | router | — | self (`mergeRouters` L14-20) | exact |
| `packages/api/src/routers/core/tax.ts` (EXTEND — staff list/track/request) | router | request-response | self (`taxRouter` `tenantProcedure` L13-55) + `contractor-tax.ts` (PII-gated reveal L80-103) | exact |
| `packages/validators/src/w-form-validators.ts` (NEW — FTIN + discriminated union) | utility | transform | `country-fields.ts` `usCountryFieldsSchema` L247-273 + `us-validators.ts` | exact |
| `apps/web-vite/src/components/portal/tax-forms/tax-form-wizard.tsx` (NEW container) | component/container | request-response | `onboarding/organization-onboarding.tsx` (reui Stepper + RHF) + `zatca/onboarding-wizard.tsx` (step dispatch) | exact |
| `apps/web-vite/src/components/portal/tax-forms/hooks/use-tax-form-wizard.ts` (NEW hook) | hook | request-response | `onboarding/hooks/use-organization-onboarding.ts` (RHF+zod, sole tRPC boundary) | exact |
| `apps/web-vite/src/components/portal/tax-forms/step-determination.tsx` (NEW — confirm/override) | component | — | `organization-onboarding.tsx` `OrgDetailsStep` L90-189 (Controller+Select) | role-match |
| `apps/web-vite/src/components/portal/tax-forms/step-w9.tsx / step-w8ben.tsx / step-w8ben-e.tsx` (NEW) | component | — | `organization-onboarding.tsx` field rendering L109-184 | role-match |
| `apps/web-vite/src/components/portal/tax-forms/step-attest.tsx` (NEW — perjury checkboxes + typed name) | component | — | `organization-onboarding.tsx` form pattern (no exact attest analog) | role-match |
| `apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx` (NEW staff surface) | component | request-response | `usps-address-status-pill.tsx` (Badge variant map) + `ssn-masked-reveal.tsx` (gated reveal) | exact |
| `packages/api/src/root.ts` (gate `tax.*` US procedures behind `module.us-expansion`) | config | — | self (`CLASSIFICATION_ENABLED` L114-147) | exact |
| `packages/db/scripts/migrate-all-regions.ts` (BLOCKING — run, do not edit) | migration | batch | self (L43 `DATABASE_URL_US` wired) | exact |
| `apps/web-vite/messages/{en,de,pl,ar}.json` + `en-US.json` (i18n keys) | config | — | existing message files (en-US fallback-parity, P84 D-04) | exact |

---

## Pattern Assignments

### `packages/db/prisma/schema/tax.prisma` (model, CRUD) — EXTEND + ADD

**Analog A (extend, additive):** `WithholdingTaxRate` (self, L23-39). Add ONE nullable column `treatyArticle String? @db.VarChar(40)`. **DO NOT** add a 5th unique-key field — the key `@@unique([sourceCountry, contractorResidency, serviceType, effectiveFrom])` (L36) must stay UNCHANGED (Pitfall 1 below). Reuse `serviceType` as the income-type axis with literal `'business_profits'` (D-02). `treatyReference` free-text (L30) stays.

**Analog B (immutability model):** `WhtCertificate` (self, L41-64) is the closest immutable-record analog — note it is `create`-only (no update path in its service). For `TaxFormSubmission`, follow the same create-only discipline PLUS a supersede chain. `TaxIdValidation` (L83-104) shows the FK-to-`Contractor`/`Organization` relation idiom + multi-index pattern to copy:
```prisma
organization Organization @relation(fields: [organizationId], references: [id])
contractor   Contractor   @relation(fields: [contractorId], references: [id])
@@index([contractorId, taxIdType, requestedAt(sort: Desc)])
```
Add the inverse back-relations on `Contractor` (contractor.prisma) and `Organization`. `ContractorType` enum lives at `contractor.prisma:310` = `SOLE_TRADER | COMPANY | INDIVIDUAL_FREELANCER | OTHER` (form-routing axis, Pitfall 1).

---

### `packages/db/prisma/seed/wht-rates.ts` (seed, batch) — ADD US rows

**Analog:** self. The exact row shape + `upsert` keyed on the composite unique (L147-162):
```typescript
await prisma.withholdingTaxRate.upsert({
  where: {
    sourceCountry_contractorResidency_serviceType_effectiveFrom: {
      sourceCountry: rate.sourceCountry,
      contractorResidency: rate.contractorResidency,
      serviceType: rate.serviceType,
      effectiveFrom: rate.effectiveFrom,
    },
  },
  update: { ...rate },
  create: { ...rate },
});
```
Existing SA rows store rate as **whole-number percent** (`5.0`, `20.0`, `null`) — US rows MUST follow (`30.0`, `0.0`, `null`), NOT fractions (Pitfall 3). The `'XX'` fallback rows (L108-144) are the template for the no-treaty default. UAE/KSA (`AE`/`SA`) should seed as `treatyRate: null` (30% statutory — no US treaty; A6 high-risk). Mirror the existing AE row (L32-40, `treatyRate: null`). Add `treatyArticle` to each new US row object (e.g. `'Article 7'`). Seed wiring point: `seed/index.ts:31-33` (`await seedWhtRates(prisma)` already called — extend in-place, or add a new `seedUsTreatyRates` fn and call it in `main()`).

---

### `packages/api/src/services/treaty-rate.service.ts` (service, transform) — NEW

**Analog A (override-precedence + auto-detect):** `reverse-charge.service.ts`.
- Pure decision fn to mirror exactly (`resolveReverseChargeDecision` L205-212):
```typescript
export function resolveReverseChargeDecision(
  autoDetected: boolean,
  override: boolean | null | undefined,
): { isReverseCharge: boolean; autoDetected: boolean } {
  if (override === true) return { isReverseCharge: true, autoDetected };
  if (override === false) return { isReverseCharge: false, autoDetected };
  return { isReverseCharge: autoDetected, autoDetected };
}
```
→ `resolveTreatyDecision(autoRate, autoArticle, overrideRate, overrideReason)` returning `{ rate, article, source: 'treaty'|'override'|'statutory_30', autoDetected }`. The override branch REQUIRES a reason → `writeAuditLog` (D-10).
- The detect → resolve → apply layering (`detectReverseCharge` L131-195 pure, `applyReverseCharge` L218-270 loads DB + short-circuits override BEFORE the DB read at L231).

**Analog B (DB lookup, the ONLY runtime `WithholdingTaxRate` consumer):** `tax-rate.service.ts` `calculateWht` L104-146. Copy the specific-residency-first-then-`XX`-fallback lookup (L117-129):
```typescript
const rate = await prisma.withholdingTaxRate.findFirst({
  where: {
    sourceCountry: 'US',
    contractorResidency: { in: [contractorResidency, 'XX'] },
    serviceType: 'business_profits',
    effectiveFrom: { lte: paymentDate },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: paymentDate } }],
  },
  orderBy: { contractorResidency: 'asc' }, // specific before 'XX'
});
```
Additionally read `rate.treatyArticle` (new column) for line-10/15 auto-populate. Default 30% when no row (L131 returns null → caller falls back to statutory). **Regression contract:** `calculateWht` returns null for `orgCountry !== 'SA'` (L112) — US rows cannot affect the SA path. The new service is a PARALLEL function, not an edit to `calculateWht`.

---

### `packages/api/src/services/tax-form.service.ts` (service, CRUD) — NEW

**Analog:** `wht-certificate.service.ts` (immutable `create`-only, L53-71) + `audit-writer.ts`. Snapshot builder + supersede logic. The certificate-number sequence pattern (`generateCertificateNumber` L8-22) is a reuse candidate if forms need a human-readable ref. Supersede = INSERT new row + UPDATE prior `status='SUPERSEDED'` + set `supersededById`, wrapped in `$transaction` (see portal pattern below). Only `DRAFT` rows are mutable (Pitfall 4).

---

### `packages/api/src/routers/portal/portal-tax-form-router.ts` (router, request-response) — NEW

**Analog:** `portal-profile-router.ts`. The `portalProcedure` self-service idiom + `$transaction` + `writeAuditLog` with `actorType: 'CONTRACTOR'` (L383-470, `submitUploadReplacement`):
```typescript
submitUploadReplacement: portalProcedure
  .input(z.object({ /* Zod */ }))
  .mutation(async ({ ctx, input }) => {
    return await ctx.db.$transaction(async tx => {
      // ... scoped to ctx.contractorId + ctx.organizationId (never client id)
      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'CONTRACTOR',
        actorId: ctx.contractorId,
        action: 'compliance.upload.submitted',
        resourceType: 'CONTRACTOR',
        resourceId: item.contractorId,
        metadata: { /* ... */ },
      });
    });
  }),
```
**Context shape** (`portal-auth.ts` L75-88): `portalProcedure` provides `ctx.contractorId`, `ctx.organizationId`, `ctx.contractor`, `ctx.region`, `ctx.db` (regional tenant-scoped client), `ctx.headers`. IDOR guard: every read/write scoped to `ctx.contractorId` + `ctx.organizationId` (see `complianceItems` L355-369 and `getProfile` L56-71 which NEVER selects `ssnEncrypted`/`bankAccountEncrypted`). **IP capture for attestation:** derive server-side from `ctx.headers` — never accept a client-body IP (Open Question 4 / Security Domain).

**Mount:** `portal.ts` uses `mergeRouters` for a FLAT `portal.*` namespace (L14-20) — add `portalTaxFormRouter` to that call. (NOTE: portal uses `mergeRouters`; the staff `appRouter` uses nested `router({...})` — do not mix.)

---

### `packages/api/src/routers/core/tax.ts` (router, request-response) — EXTEND (staff read/track)

**Analog A (host router):** self. `taxRouter` is `router({...})` of `tenantProcedure` queries (L13-55), already mounted at `tax:` in `root.ts:208`. Add staff `listFormSubmissions` / `requestTaxForm` here.

**Analog B (PII-gated staff read — the decisive one):** `contractor-tax.ts` `revealSsn` (L80-103) — the EXACT `requirePermission({ contractorPii: ['read'] })` + audit-on-reveal pattern to reuse for any full-SSN exposure in the staff summary:
```typescript
revealSsn: tenantProcedure
  .use(requirePermission({ contractorPii: ['read'] }))
  .input(z.object({ contractorId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    // ... decryptSsn(contractor.ssnEncrypted)
    await writeAuditLog({ organizationId: ctx.organizationId, actorType: 'USER',
      actorId: ctx.user?.id, action: 'contractor.ssn.revealed',
      resourceType: 'CONTRACTOR', resourceId: contractor.id, metadata: { field: 'ssn' } });
    return { ssn };
  }),
```
Staff list/track returns status only — full SSN ABSENT from output unless `contractorPii:read` (D-08). Reuse the existing `revealSsn` procedure; do NOT re-expose SSN in the form snapshot/summary (Anti-pattern + Pitfall: full SSN in snapshot JSON bypasses the gate).

---

### `packages/validators/src/w-form-validators.ts` (utility, transform) — NEW

**Analog:** `country-fields.ts`. The conditional-required `superRefine` discriminator idiom — `usCountryFieldsSchema` L247-273 (entity-type-conditional EIN) is the closest; build a discriminated union keyed on `formType` (W9/W8BEN/W8BENE). `usEntityTypeEnum` L236-243 already exports the W-9 line-3a classification. `us-validators.ts` `isValidEin` L124-128 / `isValidSsn` L152-161 are pure, reused on client RHF resolver AND server (do NOT re-collect full SSN — D-09). FTIN: store as captured, loose validation (no US algorithm) — mirror the optional `.refine` shape (e.g. `uaeCountryFieldsSchema` L12-17). `validateCountryFields` dispatch (L291-298) is the per-country pattern.

---

### `apps/web-vite/src/components/portal/tax-forms/tax-form-wizard.tsx` + `hooks/use-tax-form-wizard.ts` (container + hook)

**Analog A (page→container→hook layering, the canonical one):** `onboarding/organization-onboarding.tsx` + `onboarding/hooks/use-organization-onboarding.ts`.
- The container owns layout + reui Stepper + step dispatch; the hook is the SOLE tRPC/RHF boundary (`check:web-vite-data-layer`).
- Stepper imports + indicator (`organization-onboarding.tsx` L12-19, `OnboardingStepIndicator` L55-83) with `aria-current="step"`, `Progress` fill, RTL `rtl:rotate-180` on the arrow (L256).
- RHF + zodResolver + per-field `aria-invalid` + `aria-describedby` + `role="alert"` errors (`OrgDetailsStep` L109-184); `Controller`-bound `Select` (L134-160).
- Hook shape: `useForm` + `zodResolver`, `useId`, i18n via `useTranslations`, multi-step `useState`, `handleSubmit(onValid)` returned as `onSubmit` (`use-organization-onboarding.ts` L68-163). Translations: `useTranslations('<Namespace>')` from `../../i18n/useTranslations.js`.

**Analog B (step-component dispatch by index):** `zatca/onboarding-wizard.tsx` `OnboardingWizardView` L50-78 (`{activeStep === N && <StepComponent onSuccess={goNext} onBack={goBack} />}`) + `OnboardingWizardSkeleton` L19-42 (the loading state pattern). The zatca dir has a full hook-per-section set under `zatca/hooks/` to mirror for the staff/portal split.

**Entrance animation:** `AnimateIn` (fade+slide, staggered `delay`) — `organization-onboarding.tsx` L276/289/300; component at `components/shared/animate-in.js`.

---

### `apps/web-vite/src/components/contractors/tax-forms/tax-form-status-card.tsx` (staff surface)

**Analog A (status pill):** `usps-address-status-pill.tsx` — the Badge variant map + tooltip + `data-status` advisory idiom (L43-109). Reuse `VARIANT_MAP` shape (status → `{ labelKey, badgeVariant: 'success'|'warning'|'secondary', icon, tooltipKey }`) for form status (ACTIVE/DRAFT/SUPERSEDED/expiring). Advisory, never blocks.

**Analog B (gated SSN reveal):** `ssn-masked-reveal.tsx` — reuse VERBATIM for W-9 staff summary (L28-100). Props `{ contractorId, last4, canReveal }`; control ABSENT (not disabled) when `!canReveal` (L70); reveal only on explicit click via `use-reveal-ssn.js` hook; `font-mono tabular-nums` for digits; `role="alert" aria-live="polite"` on error (L94).

---

### `packages/api/src/root.ts` (config — flag gating)

**Analog:** self. Mirror `CLASSIFICATION_ENABLED` (L114-147) for `module.us-expansion`:
```typescript
const ClassificationFlagBag = buildFlagBag({ organizationId: 'ROOT', region: 'EU' });
const CLASSIFICATION_ENABLED =
  ClassificationFlagBag.isEnabled('module.classification-engine') ||
  Boolean(process.env.QA_DEFAULT_ORG_ID);
const conditionalClassificationRouters = CLASSIFICATION_ENABLED
  ? classificationRouters : ({} as typeof classificationRouters);
// ... spread into appRouter: ...conditionalClassificationRouters,
```
Flag is REGISTERED PENDING (`flags-core.ts:211-219`, `module.us-expansion`, `default: false`, `jurisdiction: 'ANY'`, `ship dark`). Defense-in-depth: also gate per-request at the procedure layer (classification uses `classificationProcedure` middleware). Dev bypass: `FLAG_SIGNOFF_BYPASS=local` (`flags-core.ts:62`).

---

### `packages/db/scripts/migrate-all-regions.ts` (BLOCKING — run, do NOT edit)

**Analog:** self. `DATABASE_URL_US` is already in `REGION_ENV_VARS` (L43); the script iterates EU/ME/US and fails fast (L51-92). After `tax.prisma` edit: `db:generate` → `db:migrate:dev` → `db:migrate:all` (Pitfall 5; BLOCKING sequence in RESEARCH Environment). Repo uses `prisma migrate`, NOT `db push`.

---

## Shared Patterns

### Audit logging (sign / override / staff reveal)
**Source:** `packages/api/src/services/audit-writer.ts` `writeAuditLog` (L118-137).
**Apply to:** `portal-tax-form-router.ts` (sign/submit, `actorType: 'CONTRACTOR'`), `tax.ts` staff override (`actorType: 'USER'`, `actorId: ctx.user?.id`), `treaty-rate.service.ts` override branch.
- `create`-only (append-only per audit.prisma); pass `tx` inside `$transaction` so it commits atomically. `actorType` accepts `'CONTRACTOR'` (L25). `resourceType` enum subset L28-44 (use `'CONTRACTOR'`).
```typescript
await writeAuditLog({ tx, organizationId, actorType: 'CONTRACTOR', actorId, action, resourceType: 'CONTRACTOR', resourceId, metadata });
```

### Portal self-service context + tenant scoping
**Source:** `packages/api/src/middleware/portal-auth.ts` (L42-109).
**Apply to:** every procedure in `portal-tax-form-router.ts`.
`ctx.contractorId` / `ctx.organizationId` / `ctx.region` / `ctx.db` (regional tenant-scoped) / `ctx.contractor` / `ctx.headers` — all from the HMAC-signed portal session. NEVER trust a client-supplied `contractorId`. `ctx.db` auto-scopes to the org via `tenantStore`.

### RBAC permission gate (PII)
**Source:** `packages/api/src/middleware/rbac.ts` `requirePermission` (L19-61) + `packages/auth/src/permissions.ts` `contractorPii: ['read']` (L44).
**Apply to:** staff full-SSN reveal only. `contractorPii:read` is granted to owner/admin/finance_admin only (`roles.ts`). **DO NOT add a new permission** — form read/track reuses `contractor:read` (Pitfall 2). If a new permission is genuinely needed, edit BOTH `permissions.ts` `accessControlStatement` (L12-46) AND the DUPLICATE `allPermissions` const in `roles.ts` (L18-42) or `owner` silently loses it.

### SSN crypto reuse (W-9 TIN)
**Source:** `contractor-tax.ts` `encryptSsn`/`decryptSsn` (L10, L58-62, L90) → `services/ssn-crypto.ts`.
**Apply to:** W-9 TIN. Reuse the P84 encrypted column (`ssnEncrypted` + `ssnLast4`); store last-4 only in the snapshot, never plaintext SSN (Anti-pattern). `updateUsProfile` (L23-78) shows `omit: { ssnEncrypted: true }` on the response.

### i18n parity
**Source:** existing `messages/{en,de,pl,ar}.json` + `en-US.json`.
**Apply to:** every wizard label/state string (D-13). Add en/de/pl/ar in the same change set; en-US inherits en via fallback-parity (P84 D-04 — do NOT add en-US to strict `i18n:parity` peers). Logical RTL props only (`ms-*`/`me-*`, `text-start`/`text-end`, `rtl:rotate-180`) per `organization-onboarding.tsx`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `step-attest.tsx` (perjury checkboxes + typed-name e-sign) | component | — | No ESIGN-attestation surface exists in-tree (esign.prisma DocuSign models deliberately NOT used per D-11). Build from the `organization-onboarding` form + checkbox-group primitives; the gate logic (all checkboxes + typed-name-matches before CTA enables) is novel UX from UI-SPEC. |
| `portal-tax-form-router.test.ts` (portal-session integration test) | test | — | Partial: a portal-session test harness exists (`packages/api/src/routers/__tests__/portal-profile.test.ts`, `portal.test.ts`) to mirror, but no W-form test exists yet (Wave 0). Use those as the session-mock harness analog. |

---

## Metadata

**Analog search scope:** `packages/db/prisma/{schema,seed,scripts}`, `packages/api/src/{services,routers/portal,routers/core,middleware}`, `packages/validators/src`, `packages/auth/src`, `packages/feature-flags/src`, `apps/web-vite/src/components/{onboarding,zatca,contractors}`.
**Files scanned (Read):** 21 (reverse-charge.service, tax-rate.service, tax.prisma, wht-rates seed, wht-certificate.service, audit-writer, contractor-tax router, portal.ts, portal-profile-router, portal-auth, seed/index, us-validators, country-fields, rbac, permissions, roles, migrate-all-regions, root.ts ×2, flags registry + flags-core, organization-onboarding ×2, ssn-masked-reveal, usps-address-status-pill, zatca/onboarding-wizard, contractor.prisma, tax.ts).
**Pattern extraction date:** 2026-06-16
