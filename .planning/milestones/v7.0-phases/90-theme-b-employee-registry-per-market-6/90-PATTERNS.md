# Phase 90: Theme B — Employee Registry per Market (×6) - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 24 new/modified
**Analogs found:** 22 with strong in-tree analog / 24 total (2 are pure greenfield-algorithm files whose *idiom* analog exists but whose contents are new)

> **AUTHORITY:** RESEARCH.md is authoritative. Every analog below was re-Read this session and the cited line numbers + excerpts verified against the live tree. This map turns RESEARCH's per-market field→validator→PII→storage table into "new file → analog → copy / differs" instructions the planner can act on directly.

> **THREE KEY FLAGS (read first):**
> 1. **P89 HARD DEPENDENCY — EXECUTION BLOCKED.** Verified this session: `grep` for `employeeRouter` / `employeePii` / `EmployeeProfile` / `module.workforce-employees` across `packages/api/src`, `packages/auth/src`, `packages/db/prisma/schema` returns **ZERO** hits. There is no `Employee`/`Worker` model, no `employee` Better Auth resource, no HR roles, no flag. P90 can be **planned now**; **execution waits on P89**. Every plan that touches the router / Prisma FK / permissions / flag gate must declare `[HOLD until P89]` and assume P89 delivers: `Employee` table, `employee` resource + 4 HR roles (`HR_ADMIN`/`HR_MANAGER`/`PAYROLL_OFFICER`/`LEAVE_APPROVER`), `module.workforce-employees` flag.
> 2. **EMIRATES-ID CHECKSUM IS ADVISORY ONLY.** Strict format gate (`784-\d{4}-\d{7}-\d`) is mandatory; the Luhn check is a soft warning that **NEVER blocks save** (RESEARCH Pitfall 1, LOW confidence, false-negatives against ICP). UI: amber `Badge variant="warning"`, not `destructive`. Mirror the advisory-pill idiom, not the hard-`FieldError` idiom.
> 3. **DEDICATED `EMPLOYEE_PII_ENCRYPTION_KEY`.** SSN column REUSES the existing `SSN_ENCRYPTION_KEY` (`packages/validators/src/env.ts:194`). The 3 OTHER national IDs (PESEL / Iqama / Emirates-ID) use a NEW `EMPLOYEE_PII_ENCRYPTION_KEY` (hex-32) for blast-radius separation — add to `env.ts` (mirror `:186-194`) + `minimal-server-env` + `.env.example` + `pnpm check:no-process-env`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/validators/src/employee-validators.ts` | utility (pure fn) | transform | `packages/validators/src/de-validators.ts` | exact (idiom); contents greenfield |
| `packages/validators/src/employee-country-fields.ts` | utility (registry) | transform | `packages/validators/src/country-fields.ts` (`countryFieldsSchemaMap` :279, `validateCountryFields` :291) | exact |
| `packages/validators/src/employee-reference-lists.ts` | config (enums) | transform | inline enums in `country-fields.ts` / `bacs-modulus-tables.ts` headers | role-match |
| `packages/validators/src/reference-data/*.ts` (ZUS, urząd, Krankenkasse) | config (seed) | batch/lookup | `packages/validators/src/bacs-modulus-tables.ts` | exact (versioned-table template) |
| `packages/validators/src/__tests__/employee-validators.test.ts` | test | — | `packages/validators/src/__tests__/*-validators.test.ts` | role-match |
| `packages/validators/src/__tests__/employee-country-fields.test.ts` | test | — | existing `country-fields` test | role-match |
| `packages/validators/src/env.ts` (MODIFY) | config (env) | — | `env.ts:186-194` (`SSN_ENCRYPTION_KEY` block) | exact |
| `packages/validators/src/index.ts` (MODIFY) | config (barrel) | — | barrel re-export blocks (`:153,:177,:746,:750`) | exact |
| `packages/api/src/services/employee-pii-crypto.ts` | service | transform | `packages/api/src/services/ssn-crypto.ts` | exact |
| `packages/api/src/services/elstam-stub.ts` | service (seam) | request-response (stub) | (no analog — documented stub seam) | **no analog** |
| `packages/api/src/routers/employee/employee-registry-router.ts` | route/controller | CRUD + reveal | `packages/api/src/routers/core/contractor-tax.ts` (`updateUsProfile` :23, `revealSsn` :80) | exact |
| `packages/api/src/__tests__/employee-registry.test.ts` | test | — | `contractor-tax` / api router tests | role-match |
| `packages/api/src/__tests__/employee-cross-org-leak.test.ts` | test | — | `tenant-isolation.test.ts` | role-match |
| `packages/db/prisma/schema/employee.prisma` (NEW model `EmployeeProfile` + ref tables + enums) | model | CRUD | `contractor.prisma` (`Contractor` :9, `ContractorBillingProfile` :132) + `gulf.prisma` (`FreeZoneAssignment` :17, `UaeFreeZone` :100, `NitaqatBand` :118) | exact |
| `packages/db/src/tenant.ts` (verify, maybe MODIFY) | config (guard) | — | `tenant.ts:42` `globalModels` allowlist | exact (do-NOT-add guard) |
| `packages/auth/src/permissions.ts` (MODIFY) | config (RBAC) | — | `permissions.ts:44` `contractorPii: ['read']` | exact |
| `packages/auth/src/roles.ts` (MODIFY) | config (RBAC) | — | `roles.ts` `contractorPii` grant set | exact |
| `packages/logger/src/pii-mask.ts` (MODIFY) | config (logging) | — | `PII_MASK_PATHS` (existing `*.ssn` entry) | role-match |
| `apps/web-vite/.../employees/compliance/employee-compliance-section.tsx` | component (wired) | request-response | `contractors/country-compliance-section.tsx` (`CountryFieldsDispatch` :246, `CountryComplianceLoadingCard` :74) | exact |
| `apps/web-vite/.../employees/compliance/{pl,de,uk,us,ae,sa}-employee-fields.tsx` | component (presentational) | — | `UaeFields` :290 / `SaudiFields` :331 / `Uk`/`De`/`UsComplianceFields` imports :19-21 | exact |
| `apps/web-vite/.../employees/compliance/employee-pii-masked-reveal.tsx` | component (presentational) | — | `contractors/compliance/ssn-masked-reveal.tsx` | exact |
| `apps/web-vite/.../employees/compliance/reference-list-picker.tsx` | component (presentational) | — | `reui/combobox.tsx` + `reui/command.tsx` (UI-SPEC §Component Inventory) | role-match |
| `apps/web-vite/.../employees/compliance/hooks/use-employee-compliance.ts` | hook | request-response | `contractors/compliance/hooks/use-reveal-ssn.ts` (boundary idiom) + `hooks/use-country-compliance.ts` | exact |
| `apps/web-vite/.../employees/compliance/hooks/use-reveal-employee-pii.ts` | hook | request-response | `contractors/compliance/hooks/use-reveal-ssn.ts` | exact |
| `apps/web-vite/.../employees/employee-registration-page.tsx` | page (composer) | — | any flag-gated page (`useFlag` + `Suspense`); web-vite ARCHITECTURE.md | role-match |

---

## Pattern Assignments

### `packages/validators/src/employee-validators.ts` (utility, transform)

**Analog:** `packages/validators/src/de-validators.ts`

**Imports + module-header pattern** (`de-validators.ts:1-12`): file-top reference block citing the standard/source; import the reusable check-digit from the sibling.
```typescript
// Source comments cite ISO/python-stdnum/gov URLs (NO breadcrumb IDs — real domain refs only)
import { mod11_10CheckDigit } from './de-validators.js';   // REUSE — do NOT re-implement
```

**Core reuse — `mod11_10CheckDigit`** (`de-validators.ts:29-37`): the iterative ISO 7064 MOD 11,10. RESEARCH Pattern 1 `isValidSteuerIdNr` calls this. **Anti-pattern (RESEARCH Pitfall 3, `de-validators.ts:24-26` comment):** never re-implement as naive `Σ(w·d) mod 11` — that is the PESEL/NIP algorithm and is wrong for Steuer-IdNr.
```typescript
export function mod11_10CheckDigit(digits: readonly number[]): number {
  let product = 10;
  for (const d of digits) { let sum = (d + product) % 10; if (sum === 0) sum = 10; product = (sum * 2) % 11; }
  return (11 - product) % 10;
}
```

**Validator shape pattern** (`de-validators.ts:52-60` `isValidUstIdNr`, `:92-106` `isValidSvNummer`): normalize (`raw.replace(/[\s-]/g,'').toUpperCase()`) → anchored `^...$` regex (ReDoS-safe per Security V) → checksum. Return `boolean`. `isValidSvNummer` (`:92`) is **REUSED verbatim** for the DE SV-Nummer field.

**What to BUILD (greenfield, full depth — algorithms + verified vectors in RESEARCH Patterns 1-5):**
- `isValidPesel` — mod-11 weighted + embedded-DOB cross-check (RESEARCH Pattern 2; vector `44051401359`✓)
- `isValidSteuerIdNr` — reuses `mod11_10CheckDigit` + uniqueness rule "exactly one digit appears 2 or 3× in pos 1-10" (Pattern 1; `36574261809`✓, reject `36554266806`)
- `isValidNiNumber` — format + DWP exclusions (Pattern 4: first letters ∉ {D,F,I,Q,U,V}, 2nd ≠ O, prefix ∉ {BG,GB,KN,NK,NT,TN,ZZ})
- `isValidUkTaxCode` — 1257L grammar + emergency/W1/M1/K (Pattern 5)
- `classifySaudiId` → `1|2|false` — standard Luhn + leading-digit type (Pattern 3)
- `isValidEmiratesId` — strict format `^784-\d{4}-\d{7}-\d$`; **Luhn ADVISORY only, never block** (KEY FLAG 2)
- `isValidGosi` (~9 digit, lenient + adviser-verify), `isValidWpsEstablishmentId` (13-digit padded, lenient)

**What DIFFERS:** these validators have no checksum-reuse for PESEL (it is `Σ(w·d) mod 10`, weights `[1,3,7,9,1,3,7,9,1,3]`) — only Steuer-IdNr reuses `mod11_10CheckDigit`. Emirates-ID returns a structured `{ formatValid, checksumValid }` (or format-bool + separate advisory) rather than a single hard boolean, because the checksum must not gate.

---

### `packages/validators/src/employee-country-fields.ts` (utility, registry)

**Analog:** `packages/validators/src/country-fields.ts`

**Dispatch pattern to MIRROR (do NOT fork — D-02, RESEARCH anti-pattern)** (`country-fields.ts:279-298`):
```typescript
export const countryFieldsSchemaMap: Record<string, z.ZodTypeAny> = {
  AE: uaeCountryFieldsSchema, SA: saudiCountryFieldsSchema, GB: ukCountryFieldsSchema,
  DE: deCountryFieldsSchema, US: usCountryFieldsSchema,
};
export function validateCountryFields(countryCode: string, fields: unknown): Record<string, unknown> {
  const schema = countryFieldsSchemaMap[countryCode];
  if (!schema) return {};
  return schema.parse(fields) as Record<string, unknown>;
}
```

**What to BUILD:** a PARALLEL `employeeCountryFieldsSchemaMap` keyed `PL/DE/GB/US/AE/SA` + `validateEmployeeCountryFields(cc, fields)`. Reuse the existing TIN validators where a field overlaps — `validatePolishNip` (`:318`), `validateUaeTin` (`:305`), `validateSaudiTin` (`:310`). Export the per-country `*EmployeeCountryFields` z.infer types for the UI props (mirror `UsCountryFields` `:273`).

**What DIFFERS — CRITICAL (RESEARCH Anti-Pattern 1, Pitfall 4):** **NO national ID may live in `countryFields` JSON.** PESEL / SSN / Iqama / Emirates-ID are encrypted dedicated columns ONLY. The employee Zod schemas validate the *plain-but-gated* IDs (Steuer-IdNr, SV-Nummer, NI, PAYE) + all non-PII fields; the encrypted IDs are validated at the router boundary then split into their columns, never into the JSON. PL is a NEW key not present in the contractor map (contractor PL is TIN-only).

---

### `packages/validators/src/reference-data/*.ts` + `employee-reference-lists.ts` (config, seed)

**Analog:** `packages/validators/src/bacs-modulus-tables.ts`

**Versioned-table template** (`bacs-modulus-tables.ts:1-31`): file-header citing SOURCE URL + "subset / as-of" note + `*_VERSION` + `*_SOURCE` `as const` exports, then the typed array.
```typescript
export const VOCALINK_TABLE_VERSION = 'v8.40' as const;
export const VOCALINK_TABLE_SOURCE = 'https://www.vocalink.com/...' as const;
export const VOCALINK_MODULUS_TABLE_V840: ModulusEntry[] = [ /* ... */ ];
```

**What to BUILD (RESEARCH Code Examples + Pitfall 6):**
- Large seed tables (ZUS ~600, urząd skarbowy ~400, Krankenkasse ~100) → `reference-data/` files, each VERSION + SOURCE + as-of date + **adviser-verify annotation** (D-10).
- Small inline enums in `employee-reference-lists.ts` (NFZ 01-16, Lohnsteuerklasse I-VI, student-loan plan, W-4 step-1c, 10-state list + OTHER).

**What DIFFERS:** these are NON-PII reference data; their lookup *table* (if a Prisma seed model is added, e.g. mirror `UaeFreeZone` :100) MAY be `globalModels`-allowlisted (no `organizationId`) — opposite of `EmployeeProfile`. Every list carries the local-only / no-live-gov-API caveat (D-05).

---

### `packages/api/src/services/employee-pii-crypto.ts` (service, transform)

**Analog:** `packages/api/src/services/ssn-crypto.ts`

**Copy near-verbatim** (`ssn-crypto.ts:1-69`) — AES-256-GCM, `iv:authTag:ciphertext` hex format, `IV_LENGTH = 12`, `getAuthTag`/`setAuthTag`, `encrypt`/`decrypt`/`maskLast4` trio. RESEARCH "Don't Hand-Roll": never re-author the cipher; the IV/authTag handling is subtle + audited.
```typescript
const ALGORITHM = 'aes-256-gcm'; const IV_LENGTH = 12;
export function encryptSsn(ssn: string): string { /* iv:authTag:ciphertext */ }
export function maskSsnLast4(ssn: string): string { return ssn.replace(/\D/g,'').slice(-4); }
```

**What DIFFERS — KEY FLAG 3:** key source is the NEW `EMPLOYEE_PII_ENCRYPTION_KEY` (not `SSN_ENCRYPTION_KEY`). Generalize the crypto to `encryptPii(value)`/`decryptPii(blob)`/`maskLast4(value)` (field-agnostic) for PESEL/Iqama/Emirates-ID. **The US SSN column keeps using `ssn-crypto.ts` + `SSN_ENCRYPTION_KEY` unchanged** — do not migrate it. Header comment mirrors `ssn-crypto.ts:4-11` (blast-radius rationale).

---

### `packages/api/src/routers/employee/employee-registry-router.ts` (route/controller, CRUD + reveal)

**Analog:** `packages/api/src/routers/core/contractor-tax.ts`

**Imports + procedure scaffolding** (`contractor-tax.ts:1-16`): `tenantProcedure` + `requirePermission` + `writeAuditLog` + `TRPCError` + `z`; errors from `* as E from '../../errors'`.

**Write/encrypt pattern — `updateUsProfile`** (`contractor-tax.ts:23-78`): validate ID at boundary → `findUnique` with `organizationId` in `where` → build JSON via shared helper → encrypt into dedicated columns → **`omit: { ssnEncrypted: true }` on the return** (`:76`, RESEARCH Pitfall 4 — encrypted blob never round-trips).
```typescript
if (input.ssn && !isValidSsn(input.ssn)) throw new TRPCError({ code:'BAD_REQUEST', message: E.CONTRACTOR_INVALID_SSN });
data.ssnEncrypted = encryptSsn(cleaned); data.ssnLast4 = cleaned.slice(-4);
return ctx.db.contractor.update({ where:{ id, organizationId: ctx.organizationId }, data, omit:{ ssnEncrypted: true } });
```

**Reveal pattern — `revealSsn`** (`contractor-tax.ts:80-103`): `requirePermission({ <pii>: ['read'] })` → `findUnique` (org-scoped, select only the encrypted col) → `NOT_FOUND` if absent → decrypt → **`writeAuditLog`** (`action:'*.revealed'`, `resourceType`, `metadata:{ field }`) → return the plain value.
```typescript
.use(requirePermission({ contractorPii: ['read'] }))
... const ssn = decryptSsn(contractor.ssnEncrypted);
await writeAuditLog({ organizationId, actorType:'USER', actorId: ctx.user?.id, action:'contractor.ssn.revealed', resourceType:'CONTRACTOR', resourceId: contractor.id, metadata:{ field:'ssn' } });
```

**What to BUILD:** `employeeRegistryRouter` with `register` (Zod `.strict()` per D-09 — create `Employee` + `EmployeeProfile`, run `validateEmployeeCountryFields` + greenfield validators, encrypt the 4 national IDs into columns, split promoted typed columns + JSON, `omit` all `*Encrypted` on return), `revealPii` (parameterized by `field` → `employeePii:read`, audit), `listReferenceLists` (read seed tables).

**What DIFFERS:**
- Mounts on the **P89 `employeeRouter`** (NOT `contractorRouter`) — **`[HOLD until P89]`** (KEY FLAG 1).
- Permission gate is the NEW `employeePii: ['read']` (not `contractorPii`).
- `revealPii` is field-parameterized (4 ID types, 2 crypto keys) — switch on `field` to pick `decryptPii` vs `decryptSsn`.
- **NEVER on `portalAppRouter`** (staff-only — P84 lesson, RESEARCH Security threat table).
- Emirates-ID `register` validation: format-block, checksum-advisory (return a soft warning in the response, do not throw — KEY FLAG 2).

---

### `packages/db/prisma/schema/employee.prisma` (model, CRUD)

**Analogs:** `contractor.prisma` (`Contractor` :9-60, `ContractorBillingProfile` :132-173) + `gulf.prisma` (`FreeZoneAssignment` :17-44, `UaeFreeZone` :100-111, `NitaqatBand` :118-125)

**Hybrid-storage column pattern** (`contractor.prisma:38-44`): `countryFields Json?` for bulk non-PII + dedicated `*Encrypted`/`*Last4` string pairs for PII. Copy the comment intent (encrypt-at-rest, dedicated key, additive-nullable, reveal-gated) — but **strip the `Phase 84 / US-FIELD-02 / D-01` breadcrumb IDs** (`pnpm lint:no-breadcrumbs`); keep only WHY.
```prisma
countryFields  Json?            // per-country employee fields (validated by employeeCountryFieldsSchemaMap)
peselEncrypted String?          // iv:authTag:ciphertext, EMPLOYEE_PII_ENCRYPTION_KEY; reveal via employeePii:read
peselLast4     String?
ssnEncrypted   String?          // REUSE SSN_ENCRYPTION_KEY (US column)
ssnLast4       String?
iqamaEncrypted String?
iqamaLast4     String?
emiratesIdEncrypted String?
emiratesIdLast4     String?
```

**1:1 per-profile + tenant pattern** (`ContractorBillingProfile:132-173` / `FreeZoneAssignment:17-44`): `organizationId` + the parent FK with `@unique` + `@@unique([organizationId, <parentId>])` + `@@index([organizationId])`. `FreeZoneAssignment:20-22` shows the `contractorId String @unique` 1:1 idiom — mirror for `employeeId String @unique` (FK → P89 `Employee`).

**Promoted typed columns (RESEARCH storage table, D-01 mandatory three):** `saudizationCategory NitaqatBand?` (**REUSE** `gulf.prisma:118` enum), `etat Decimal @db.Decimal(3,2)?` (range 0.10-1.00; cf. `ContractorAssignment.allocationPercent Decimal @db.Decimal(5,2)` `contractor.prisma:183`), `employmentStatus <new enum>`. Optional 4th: `lohnsteuerklasse` (DE payroll filter).

**Reference-lookup model (if added):** mirror `UaeFreeZone` (`gulf.prisma:100-111`) — no `organizationId`, allowlisted in `lint:schema`.

**What DIFFERS — CRITICAL:**
- `EmployeeProfile` is **tenant-owning → NEVER in `globalModels`** (`tenant.ts:42`, RESEARCH Anti-Pattern 2). Cross-org leak test required (mirror `tenant-isolation.test.ts`).
- FK target is P89 `Employee`/`Worker` — **`[HOLD until P89]`** (the relation cannot compile until P89's model lands).
- Region note (`gulf.prisma:1-10`): AE/SA orgs live in the ME db; `EmployeeProfile` deploys to all regions but Gulf data is reached only via the region-aware client. Additive-only migration (multi-region, `[BLOCKING]`).
- **Discretion (RESEARCH):** NO AE/SA sub-table — visa/WPS/GOSI stay in JSON; revisit only if a later phase needs expiry reminders.

---

### `packages/auth/src/permissions.ts` + `roles.ts` (config, RBAC)

**Analog:** `permissions.ts:41-44` (`contractorPii: ['read']`)
```typescript
// Gate for revealing full SSN PII. Granted ONLY to owner/admin/finance_admin; deny-by-default for the rest.
contractorPii: ['read'],
```
**What to BUILD:** add `employeePii: ['read']` to `accessControlStatement` (`:12`). **Differs:** the comment must drop the `Phase`/`D-` breadcrumbs; grant set (in `roles.ts`) = `HR_ADMIN` + owner + admin, **exclude** `PAYROLL_OFFICER`/`LEAVE_APPROVER` unless a payroll-export need is shown (least-privilege, mirrors P84's `external_accountant` exclusion — RESEARCH Open Q3). The grant cannot be tested until P89's HR roles exist — **`[HOLD until P89]`** for `roles.ts`.

---

### `apps/web-vite/.../employees/compliance/employee-compliance-section.tsx` (component, wired)

**Analog:** `apps/web-vite/src/components/contractors/country-compliance-section.tsx`

**Dispatch switch to MIRROR** (`country-compliance-section.tsx:246-288` `CountryFieldsDispatch`): `switch(countryCode)` → per-market component, `default: return null`.
```typescript
switch (countryCode) {
  case 'AE': return <UaeFields .../>;  case 'SA': return <SaudiFields .../>;
  case 'GB': return <UkComplianceFields .../>; ... default: return null;
}
```
**Card shell + incomplete badge** (`:139-187`): `Card`/`CardHeader`/`CardTitle className="text-base font-semibold"` + amber incomplete-count `Badge variant="outline" className="border-warning/20 bg-warning/5 text-warning"` (`:146`) + save `Button` with `Loader2`/`Check` + `null` when no field set (`:120-124`). `CountryComplianceLoadingCard` (`:74-82`) → `EmployeeComplianceLoadingCard`.

**What to BUILD:** `EmployeeFieldsDispatch` switching PL/DE/UK/US/AE/SA → 6 field components; the wired section branches loading/empty/error; reads from the hook only.

**What DIFFERS — D-06 + RESEARCH Anti-Pattern 6 (load-bearing):** the contractor file ends with `CountryComplianceSectionContainer` (`:400`, `-container`-style) — **the employee files must NOT use a `*-container.tsx` suffix.** Follow the current web-vite layering: page → wired section → hook (sole tRPC boundary) → presentational. `pnpm check:web-vite-data-layer` enforces this. The contractor `-container` survivor is a grandfathered exception, not a template.

---

### `apps/web-vite/.../employees/compliance/employee-pii-masked-reveal.tsx` (component, presentational)

**Analog:** `apps/web-vite/src/components/contractors/compliance/ssn-masked-reveal.tsx`

**Copy the whole component idiom** (`ssn-masked-reveal.tsx:1-101`): mono `•••-••-{last4}` span (`role="img"` + `aria-label` `:62-67`), gated reveal `Button` **ABSENT not disabled** when no permission (`:71-89`), `aria-pressed={isRevealed}`, `Eye`/`EyeOff`/`Loader2`, masked-hint `<p>`, error `<p role="alert" aria-live="polite" text-xs text-destructive>`. UI-SPEC pins these verbatim.
```tsx
<span role="img" className="font-mono text-sm tabular-nums" aria-label={maskedLabel}>{`•••-••-${last4}`}</span>
{canReveal ? <Button ... aria-pressed={isRevealed}> ... </Button> : null}
```
**What DIFFERS:** parameterized by `field` (PESEL/SSN/Iqama/Emirates-ID) → drives mask shape (`peselLast4`, etc.) + i18n key namespace `Employees.compliance.pii.*`; `canReveal = can('employeePii', ['read'])`. Reveal value held in local state, never query cache (Pitfall 4).

---

### `apps/web-vite/.../employees/compliance/hooks/use-reveal-employee-pii.ts` + `use-employee-compliance.ts` (hook)

**Analog:** `apps/web-vite/src/components/contractors/compliance/hooks/use-reveal-ssn.ts`

**Sole-tRPC-boundary reveal hook** (`use-reveal-ssn.ts:1-44`): `useMutation(trpc.<x>.reveal*.mutationOptions({ onSuccess: r => setRevealed(r.<id>) }))`, value in `useState` (never cache — `:11-13` comment), `reveal`/`reset` callbacks, returns `{ reveal, revealedX, isPending, isError, error, reset }`.
```typescript
const [revealedSsn, setRevealedSsn] = useState<string|undefined>();
const mutation = useMutation(trpc.contractor.revealSsn.mutationOptions({ onSuccess: r => setRevealedSsn(r.ssn) }));
```
**What DIFFERS:** call `trpc.employee.revealPii` with `{ employeeId, field }`; the compliance read hook (`use-employee-compliance.ts`) mirrors `hooks/use-country-compliance.ts` (the section's config/fields/save queries) and is the ONLY place `useTRPC`/`useQuery`/`useMutation` appear for this surface. **`[HOLD until P89]`** — `trpc.employee.*` does not exist until the P89 router + this phase's procedures land.

---

### Per-market field components + page + remaining UI

`{pl,de,uk,us,ae,sa}-employee-fields.tsx` mirror the inline `UaeFields` (`:290-329`) / `SaudiFields` (`:331-394`) idiom: `useId()`, `space-y-2` field blocks, `Label className="text-sm font-medium"` + `Input`, `useCallback` change handlers, i18n via `useTranslations('Employees.compliance.<cc>')`. Selects use `EntityTypeSelect<T>` (Lohnsteuerklasse, W-4, student-loan, visa, `NitaqatBand`, 10-state). AE component surfaces the Emirates-ID advisory pill (amber `Badge variant="warning"`, KEY FLAG 2). `reference-list-picker.tsx` wraps `reui/combobox`. Page = thin composer with `useFlag('module.workforce-employees')` gate + `Suspense` (flag-off → render-tree removed, D-07). All copy = i18n keys, parity en/en-US/de/pl/ar (UI-SPEC Copywriting Contract).

---

## Shared Patterns

### Authentication / RBAC reveal gate
**Source:** `permissions.ts:44` (`contractorPii: ['read']`) + `contractor-tax.ts:80-103` (`requirePermission` + `writeAuditLog`)
**Apply to:** the router `revealPii` procedure + every `EmployeePiiMaskedReveal` (`canReveal = can('employeePii',['read'])`).
```typescript
.use(requirePermission({ employeePii: ['read'] }))   // NEW statement
// + writeAuditLog({ action:'employee.<field>.revealed', resourceType:'EMPLOYEE', metadata:{ field } })
```

### PII crypto + no-leak boundary
**Source:** `ssn-crypto.ts:1-69` + `contractor-tax.ts:76` (`omit`) + `contractor.prisma:39-44` (dedicated columns)
**Apply to:** all 4 encrypted national IDs. **Rule:** encrypt into dedicated columns, NEVER into `countryFields` JSON; `omit` `*Encrypted` on every router return; extend `packages/logger/src/pii-mask.ts` `PII_MASK_PATHS` with `*.pesel`/`*.iqama`/`*.emiratesId`/`*.nationalId` (+ `countryFields.*` + casing variants), mirroring the existing `*.ssn` entry (RESEARCH Security V7).

### Country-fields registry (mirror, don't fork)
**Source:** `country-fields.ts:279-298`
**Apply to:** `employee-country-fields.ts`. Parallel `employeeCountryFieldsSchemaMap` + `validateEmployeeCountryFields`; reuse `validatePolishNip`/`validateUaeTin`/`validateSaudiTin`/`mod11_10CheckDigit`/`isValidSvNummer`/`isValidSsn`/`isValidEin`.

### Tenant scoping + leak test
**Source:** `tenant.ts:42` (`globalModels`) + `tenant-isolation.test.ts`
**Apply to:** `EmployeeProfile` — `organizationId` in every `where`, NEVER in `globalModels`, `withTenantScope` inherited, dedicated cross-org leak test. Reference-lookup tables (non-PII, no org) MAY be allowlisted (mirror `UaeFreeZone`).

### Versioned reference data + adviser-verify
**Source:** `bacs-modulus-tables.ts:19-31`
**Apply to:** ZUS / urząd skarbowy / Krankenkasse seed files — `*_VERSION` + `*_SOURCE` + as-of + adviser-verify annotation (D-10); local-only, no live gov API (D-05).

### Dedicated env key
**Source:** `env.ts:186-194` (`SSN_ENCRYPTION_KEY: hex32`)
**Apply to:** add `EMPLOYEE_PII_ENCRYPTION_KEY: hex32` (new `usFieldsSchema`-style block) + `minimal-server-env` + `.env.example`; `pnpm check:no-process-env`.

---

## No Analog Found

| File | Role | Data Flow | Reason / Planner action |
|------|------|-----------|-------------------------|
| `packages/api/src/services/elstam-stub.ts` | service (seam) | request-response (stub) | No live-gov-lookup precedent (D-05 forbids it). Build a documented stub-hook interface returning a typed stub; NO network. Shape is planner's discretion (CONTEXT Claude's-Discretion). |
| `packages/validators/src/employee-validators.ts` (contents) | utility | transform | The *file idiom* mirrors `de-validators.ts`, but the ~14 validator algorithms are greenfield — copy algorithms + verified test vectors from RESEARCH Patterns 1-5, not from any in-tree analog. |

---

## Metadata

**Analog search scope:** `packages/validators/src`, `packages/api/src/{services,routers,__tests__}`, `packages/auth/src`, `packages/db/{prisma/schema,src}`, `apps/web-vite/src/components/contractors/**`.
**Files scanned / Read this session:** `country-fields.ts`, `de-validators.ts`, `ssn-crypto.ts`, `contractor-tax.ts`, `permissions.ts`, `use-reveal-ssn.ts`, `country-compliance-section.tsx`, `ssn-masked-reveal.tsx`, `tenant.ts` (globalModels), `contractor.prisma`, `gulf.prisma`, `bacs-modulus-tables.ts`, `env.ts`; P89-absence confirmed by grep.
**Pattern extraction date:** 2026-06-21
**Read-only:** no source files modified; PATTERNS.md is the only file written.
