# Phase 90: Theme B — Employee Registry per Market (×6) - Research

**Researched:** 2026-06-21
**Domain:** Per-market statutory-identifier validation + PII boundary + hybrid Prisma model (PL/DE/UK/US/AE/SA employee registry)
**Confidence:** HIGH on in-tree reuse + PL/DE/UK validator algorithms; MEDIUM on Gulf ID formats (GOSI/WPS) + reference-list completeness; LOW on the Emirates-ID checksum

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New `EmployeeProfile` model, 1:1 per `Employee`, with `countryCode`. **Hybrid storage:** (a) `countryFields Json?` for bulk non-PII (per-country Zod, mirror `Contractor.countryFields` + `validateCountryFields()`); (b) AES-256-GCM-encrypted columns for PII national IDs (D-04); (c) a small set of promoted typed/indexed columns for cross-market query (HR dashboard P97 + payroll P94) — at minimum Saudization category, employment fraction (`etat` 0.10–1.00), employment status. Tenant-owning (`organizationId`), NEVER in `globalModels`, cross-org leak test.
- **D-02:** Mirror the contractor country-fields registry, do NOT fork it. Extend the `validateCountryFields` dispatch idiom; a parallel `employeeCountryFieldsSchemaMap` is acceptable. Validator IDIOM + reusable validators are shared.
- **D-03:** Reuse the 16 existing validators where they apply (DE `isValidSvNummer`/`isValidSteuerIdNr` ⚠️ see note, UK UTR/VAT/CH, US SSN/EIN, PL NIP, AE/SA TIN). Build the ~14 greenfield at FULL depth: PESEL (mod-11 + embedded-DOB), NI (format + DWP exclusions), tax-code (1257L + emergency/W1/M1/K), W-4 step-1c, Emirates ID, Iqama/National ID, GOSI, Krankenkasse, student-loan plan; enums for Lohnsteuerklasse (I–VI) + Saudization category; state-withholding = 10 states + free-text fallback.
- **D-04:** Encrypt national-person identifiers; store tax/social IDs plain (RBAC-gated). **Encrypt:** PESEL (RODO), SSN (reuse P84 `ssn-crypto`), Iqama/National ID, Emirates ID → AES-256-GCM + `last4`/masked + new `employeePii:read` reveal procedure + `writeAuditLog` (mirror `contractor.revealSsn`). **Plain-but-RBAC-gated:** Steuer-IdNr, SV-Nummer, NI number, PAYE. Full PII value never logged, never in `countryFields` JSON.
- **D-05:** Reference-list pickers + stub lookup hooks; NO live government calls (local-only). ZUS oddział, NFZ oddział, urząd skarbowy = seeded reference-list pickers; ELStAM (DE) = documented stub hook. Seeded lists carry adviser-verify annotations.
- **D-06:** Per-market hand-built components, mirroring `CountryComplianceSection`/`CountryFieldsDispatch`. New `apps/web-vite/src/components/employees/compliance/` with a dispatch switch → `PLEmployeeFields`/`DEEmployeeFields`/`UKEmployeeFields`/`USEmployeeFields`/`AEEmployeeFields`/`SAEmployeeFields`; reuse `SsnMaskedReveal`-style masked-reveal; reference-list pickers. web-vite layering (page → wired section → hook = sole tRPC boundary → presentational; NO `*-container.tsx`); mandatory loading/empty/error + WCAG; i18n parity en/en-US/de/pl/ar.
- **D-07:** Whole employee surface gated on `module.workforce-employees` (P89 flag-off pattern).
- **D-08:** Depends on P89 — `EmployeeProfile` FK to `Employee`/`Worker`; plan/execute only after 89's abstraction lands. Store statutory fields against the employee, not the contractor.
- **D-09:** `writeAuditLog` on employee registration + PII reveal; tenant from session; Zod `.strict()` on the registration procedure.
- **D-10:** Adviser-verify annotations on the statutory seed lists + validation rules (local-only / legal-deferred); 50-state US deferred.

### Claude's Discretion
- Exact `EmployeeProfile` columns vs `countryFields` JSON split (which non-PII fields promoted typed/indexed beyond the named three).
- Whether a per-market sub-table (mirror `FreeZoneAssignment`) is warranted for AE/SA visa/WPS/GOSI vs JSON.
- Reference-list seed-data source + shape (ZUS/NFZ oddział, urząd skarbowy) + maintenance note.
- Whether the employee country-fields schema map is a parallel map or a shared registry keyed by worker-type.
- Per-market required-vs-optional field matrix.
- The `employeePii:read` permission grant set across the 4 new HR roles (P89) + existing roles.
- ELStAM stub-hook interface shape.

### Deferred Ideas (OUT OF SCOPE)
- Full 50-state US withholding matrix → 10 states + free-text now (REQUIREMENTS line 218).
- Live government lookups (ELStAM, ZUS, NFZ, GOSI verification) → stub hooks + reference lists now.
- Personnel file/akta, leave, time, on/offboarding, payroll, HRIS, portal, HR dashboard → P91–97.
- Per-market sub-tables for visa/WPS/GOSI vs JSON → planner's discretion; deferred unless field set demands it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMP-REG-PL-01 | PL: PESEL (mod-11 + DOB), urząd skarbowy ID, ZUS oddział ID, stanowisko, wymiar etatu (0.10–1.00), stawka brutto, ZUS title code, NFZ oddział | PESEL algorithm verified (test vector `44051401359` ✓); NIP validator exists; ZUS/NFZ/US code-list formats found + adviser-verify; etat = `Decimal(3,2)` range 0.10–1.00; ZUS title code = 6-char structured |
| EMP-REG-DE-01 | DE: Steuer-IdNr (11-digit mod-11), SV-Nummer (v5.0 validator), Krankenkasse ID, Lohnsteuerklasse (I–VI), Kinderfreibetrag, Kirchensteuer flag, ELStAM hook | Steuer-IdNr = ISO7064 MOD11-10 + uniqueness rule (test vector `36574261809` ✓, reuses existing `mod11_10CheckDigit`); `isValidSvNummer` exists; Krankenkasse = 8-digit Betriebsnummer reference list; Lohnsteuerklasse enum I–VI; ELStAM = stub hook |
| EMP-REG-UK-01 | UK: NI number (format + DWP exclusions), PAYE reference, tax code (1257L + emergency/W1/M1/K), student-loan plan, pension auto-enrol flag | NI format + full DWP exclusion set from GOV.UK NIM39110; tax-code grammar from HMRC PAYE manual; student-loan = 5-value enum (Plan 1/2/4/5 + PGL); PAYE ref = `NNN/XXXXX...` |
| EMP-REG-US-01 | US: SSN (PII-masked per US-FIELD-02), W-4 step-1c filing status, state withholding (10 states + free-text) | `isValidSsn` + `ssn-crypto` reused verbatim; W-4 step-1c = 3-value enum (Single/MFJ/HoH); 10 highest-pop states list + free-text fallback |
| EMP-REG-AE-01 | AE: Emirates ID + visa type + WPS Establishment ID | Emirates ID = 15-digit `784-YYYY-NNNNNNN-N`; checksum LOW confidence (format-only + advisory Luhn); WPS Establishment ID = 13-digit (MOL); visa type = enum |
| EMP-REG-SA-01 | SA: Iqama/National ID, GOSI registration number, Saudization category | Iqama/National ID = 10-digit Luhn, leading 1=citizen/2=resident; GOSI = 9-digit (MEDIUM); Saudization = reuse existing `NitaqatBand` enum from `gulf.prisma` |
</phase_requirements>

## Summary

This phase applies an already-solved pattern (the contractor country-fields registry + the SSN encrypt/reveal boundary from Phase 84) to the Phase-89 `Employee`. There is very little genuinely new architecture: the planner reuses `validateCountryFields`/`countryFieldsSchemaMap`, the `mod11_10CheckDigit`/`isValidSvNummer`/`isValidSteuerIdNr`/`isValidUtr`/`isValidEin`/`isValidSsn`/`validatePolishNip` validators, the `ssn-crypto.ts` AES-256-GCM util + `SSN_ENCRYPTION_KEY`, the `contractor.revealSsn` RBAC+audit procedure, the `contractorPii:read` Better Auth statement, the `CountryFieldsDispatch`/`SsnMaskedReveal` UI, and the `FreeZoneAssignment` per-profile model template. The real research value is (a) getting the **~14 greenfield validator algorithms precisely right** with verified test vectors, and (b) the **hybrid-storage / PII-class / reference-list decisions** the planner must make per market.

**HARD GATE — verified in-tree:** Phase 89 has NOT been executed. There is no `Worker`/`Employee`/`EmployeeProfile` model, no `employee` resource in `permissions.ts`, no `employeeRouter`. P90 can be **planned now** but **execution is blocked on P89** (D-08). The plan must declare this dependency explicitly and assume P89 delivers: the `Employee` table, the `employee` Better Auth resource + 4 HR roles (`HR_ADMIN`/`HR_MANAGER`/`PAYROLL_OFFICER`/`LEAVE_APPROVER`), and the `module.workforce-employees` flag-off plumbing.

**Primary recommendation:** Add a parallel `employee-validators.ts` + `employee-country-fields.ts` in `packages/validators` (mirroring `de-validators.ts`/`country-fields.ts`), an `EmployeeProfile` Prisma model with the hybrid split below, an `EMPLOYEE_PII_ENCRYPTION_KEY` (blast-radius separation from SSN/bank keys), an `employeePii:read` Better Auth statement, an `employeeRouter.register`/`revealPii` procedure pair, seeded reference-list tables (versioned + source-cited like `bacs-modulus-tables.ts`), and per-market hand-built UI components. Every validator gets table-backed unit tests with the verified vectors in this document, and every statutory seed list carries an adviser-verify annotation per D-10.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| National-ID checksum/format validation | Shared validator pkg (`packages/validators`, pure fn) | API (tRPC Zod) + Browser (RHF resolver) | Pure, no-I/O validators run identically client + server (existing `us/uk/de-validators.ts` convention) |
| PII national-ID encryption + reveal | API (`packages/api` service + tRPC) | — | Crypto key + decrypt must never reach the client; staff-router only (P84 precedent) |
| Employee registration (write) | API (tRPC `employeeRouter` mutation) | DB (Prisma `EmployeeProfile`) | Tenant from session, audit, Zod `.strict()` |
| Promoted-column query (Saudization/etat/status) | DB (indexed columns) | API | P97/P94 filter on these — must be typed columns, not JSON |
| Reference-list lookup (ZUS/NFZ/US/Krankenkasse) | DB (seeded global-lookup table) | API (read procedure) | Local-only seed data; non-PII; versioned + adviser-verify |
| Per-market form dispatch + masked-reveal | Browser (React) | API (reveal mutation only) | Presentational; data only via the single hook (web-vite layering) |
| ELStAM lookup | API (stub hook seam) | — | NO live German gov API (D-05); documented interface only |

## Standard Stack

This phase introduces **no new external dependencies**. Everything is in-tree reuse + greenfield code in existing packages.

### Core (all in-tree — verified present)
| Module | Location | Purpose | Reuse / New |
|--------|----------|---------|-------------|
| `mod11_10CheckDigit` | `packages/validators/src/de-validators.ts:29` | ISO 7064 MOD 11,10 check digit | **Reuse** for Steuer-IdNr (same algorithm) |
| `isValidSvNummer` | `de-validators.ts:92` | SV-Nummer structural + weighted mod-10 | **Reuse** (the "v5.0 SV-Nummer" validator) |
| `isValidUtr`/`isValidGbVat`/`isValidCompaniesHouseNumber` | `uk-validators.ts` | UK tax/company IDs | **Reuse** (apply where employee fields overlap; mostly contractor-side) |
| `isValidSsn`/`isValidEin` | `us-validators.ts:124,152` | US SSN range-exclusion + EIN prefix | **Reuse** verbatim (SSN identical to P84) |
| `validatePolishNip` | `country-fields.ts:318` | Polish NIP mod-11 [6,5,7,2,3,4,5,6,7] | **Reuse** if NIP appears; PESEL is NEW |
| `validateUaeTin`/`validateSaudiTin` | `country-fields.ts:305,310` | AE TRN (15-digit) / SA TIN | **Reuse** for the tax-ID fields; ID-card validators are NEW |
| `validateCountryFields` + `countryFieldsSchemaMap` | `country-fields.ts:279,291` | per-country Zod dispatch | **Mirror** (parallel `employeeCountryFieldsSchemaMap`) |
| `encryptSsn`/`decryptSsn`/`maskSsnLast4` | `packages/api/src/services/ssn-crypto.ts` | AES-256-GCM `iv:authTag:ciphertext` | **Reuse for SSN**; create a parallel `employee-pii-crypto.ts` for PESEL/Iqama/Emirates-ID (same shape, dedicated key) |
| `contractor.revealSsn` | `routers/core/contractor-tax.ts:80` | RBAC + audit reveal procedure | **Mirror** as `employee.revealPii` (parameterized by field) |
| `contractorPii: ['read']` | `packages/auth/src/permissions.ts:44` | Better Auth statement | **Mirror** as `employeePii: ['read']` |
| `CountryFieldsDispatch` + `SsnMaskedReveal` + `useRevealSsn` | `apps/web-vite/.../country-compliance-section.tsx`, `compliance/ssn-masked-reveal.tsx`, `compliance/hooks/use-reveal-ssn.ts` | per-market form dispatch + masked PII reveal | **Mirror** in `components/employees/compliance/` |
| `FreeZoneAssignment` | `packages/db/prisma/schema/gulf.prisma:17` | 1:1 per-profile sub-table template | **Template** if AE/SA warrant a sub-table |
| `NitaqatBand` enum | `gulf.prisma:118` | PLATINUM/HIGH_GREEN/MID_GREEN/LOW_GREEN/YELLOW/RED | **Reuse** for the Saudization category |
| `globalModels` allowlist | `packages/db/src/tenant.ts:42` | tenant-scoping exemption set | **Do NOT add `EmployeeProfile`**; reference-lookup tables (non-PII) may be allowlisted like `UaeFreeZone` |
| `VOCALINK_MODULUS_TABLE_V840` pattern | `packages/validators/src/bacs-modulus-tables.ts` | versioned + source-cited + subset-documented reference table | **Template** for ZUS/NFZ/US/Krankenkasse seed lists |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Parallel `employeeCountryFieldsSchemaMap` | Shared map keyed by `(countryCode, workerType)` | Parallel map is simpler + zero risk to the snapshot-locked contractor path; shared keyed map is DRYer but couples two surfaces. **Recommend parallel** (D-02 permits it; lower blast radius). |
| Dedicated `EMPLOYEE_PII_ENCRYPTION_KEY` | Reuse `SSN_ENCRYPTION_KEY` | Dedicated key = blast-radius separation (the explicit P84 principle); SSN reuse is fine for the US SSN column itself but PESEL/Iqama/Emirates-ID warrant a separate key. **Recommend: SSN column reuses `SSN_ENCRYPTION_KEY`; the 3 other national IDs use a new `EMPLOYEE_PII_ENCRYPTION_KEY`.** |
| AE/SA sub-table (mirror `FreeZoneAssignment`) | All AE/SA fields in `countryFields` JSON | Sub-table only if a field needs an index/FK/expiry-reminder. Emirates-ID/Iqama are encrypted columns regardless; visa-type/WPS/GOSI are low-cardinality strings → **JSON is sufficient; no sub-table needed** unless a later phase needs expiry reminders (defer per D-10). |

**Installation:** None. All work lands in existing packages (`packages/validators`, `packages/api`, `packages/auth`, `packages/db`, `apps/web-vite`).

## Package Legitimacy Audit

This phase installs **no external packages** — it is entirely in-tree reuse + greenfield code within existing workspace packages. The Package Legitimacy Gate is therefore **N/A**.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No external installs in this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
                         HR user (apps/web-vite)
                                  │
                  EmployeeRegistrationPage (thin composer; useFlag gate)
                                  │
                  EmployeeComplianceSection (wired; loading/empty/error)
                                  │
            ┌─────────────────────┴──────────────────────┐
   useEmployeeCompliance (SOLE tRPC boundary)    useRevealEmployeePii (reveal mutation only)
            │                                             │
   EmployeeFieldsDispatch  switch(countryCode) ──→ PL/DE/UK/US/AE/SA field components
            │                                             │
            │                            reference-list pickers (ZUS/NFZ/US/Krankenkasse)
            ▼                                             ▼
   ───────────────────────────────  tRPC /api/trpc (staff)  ───────────────────────────
            │                                             │
   employeeRouter.register (Zod .strict)         employeeRouter.revealPii
            │                                             │ requirePermission(employeePii:read)
   validateEmployeeCountryFields(cc, fields)             │ + writeAuditLog
   + greenfield validators (PESEL/IdNr/NI/Iqama/...)     │
            │                                    decrypt PESEL/SSN/Iqama/Emirates-ID
   split: JSON  +  encrypted PII cols  +  promoted typed cols
            │
            ▼
   Prisma EmployeeProfile (tenant-scoped; FK → Employee → Worker; NOT in globalModels)
            │                                  ▲
            └── reads ── reference-lookup tables (seeded, versioned, adviser-verify)
                                               │
   ELStAM stub hook (seam; NO live German gov API call) ── returns documented stub
```

### Recommended Project Structure
```
packages/validators/src/
├── employee-validators.ts          # NEW: PESEL, validateSteuerIdNr (uniqueness+mod11-10),
│                                    #   isValidNiNumber, isValidUkTaxCode, isValidSaudiId,
│                                    #   isValidEmiratesId, isValidGosi, isValidWpsEstablishmentId
├── employee-country-fields.ts       # NEW: per-country employee Zod schemas + employeeCountryFieldsSchemaMap
├── employee-reference-lists.ts      # NEW: NFZ (01-16), Lohnsteuerklasse enum, student-loan enum,
│                                    #   US-state enum, W-4 enum — small inline enums
└── reference-data/                  # NEW: large seed lists (urząd skarbowy ~400, ZUS ~600,
                                     #   Krankenkasse ~100) — versioned + source-cited (bacs template)

packages/api/src/
├── services/employee-pii-crypto.ts  # NEW: AES-256-GCM, EMPLOYEE_PII_ENCRYPTION_KEY (mirror ssn-crypto.ts)
├── services/elstam-stub.ts          # NEW: documented stub hook (no network)
└── routers/employee/                # NEW: employeeRegistryRouter (register + revealPii + listReferenceLists)

packages/db/prisma/schema/
└── employee.prisma                  # NEW: EmployeeProfile + reference-lookup tables + enums

packages/auth/src/
├── permissions.ts                   # employeePii: ['read'] added to accessControlStatement
└── roles.ts                         # grant employeePii:read to HR_ADMIN/owner/admin (planner decides set)

apps/web-vite/src/components/employees/compliance/
├── employee-compliance-section.tsx  # dispatch + wired section
├── pl-employee-fields.tsx ... sa-employee-fields.tsx
├── reference-list-picker.tsx        # generic seeded-list combobox
├── employee-pii-masked-reveal.tsx   # mirror ssn-masked-reveal.tsx
└── hooks/use-employee-compliance.ts, use-reveal-employee-pii.ts
```

### Pattern 1: ISO 7064 MOD 11,10 reuse for Steuer-IdNr
**What:** The German Steuer-IdNr check digit uses the *same* ISO 7064 MOD 11,10 algorithm already implemented as `mod11_10CheckDigit` for the USt-IdNr. Do NOT re-implement.
**When to use:** The greenfield `validateSteuerIdNr` validator.
**Example:**
```typescript
// Source: python-stdnum stdnum.de.idnr [CITED: arthurdejong.org/python-stdnum] +
//   existing mod11_10CheckDigit (de-validators.ts:29) [VERIFIED: in-tree]
// Verified: 36574261809 → check digit 9 ✓ (computed in this session)
import { mod11_10CheckDigit } from './de-validators.js';

export function isValidSteuerIdNr(raw: string): boolean {
  const id = raw.replace(/[\s/]/g, '');
  if (!/^[1-9]\d{10}$/.test(id)) return false;          // 11 digits, first ≠ 0
  const body = id.slice(0, 10).split('').map(Number);
  // Uniqueness rule: exactly one digit appears 2 or 3 times in positions 1-10;
  // all other digits appear exactly once.
  const counts = new Map<number, number>();
  for (const d of body) counts.set(d, (counts.get(d) ?? 0) + 1);
  const repeated = [...counts.values()].filter(c => c > 1);
  if (repeated.length !== 1 || (repeated[0] !== 2 && repeated[0] !== 3)) return false;
  return mod11_10CheckDigit(body) === Number(id[10]);
}
```

### Pattern 2: PESEL — mod-11-style weighted checksum + embedded-DOB cross-check
**What:** PESEL is `YYMMDD` (century-encoded month) + 4-digit serial + sex digit (10th, odd=male) + check digit. Weights `[1,3,7,9,1,3,7,9,1,3]`, sum mod 10, check = `(10 − last)%10`.
**Example:**
```typescript
// Source: en.wikipedia.org/wiki/PESEL [CITED] — Verified: 44051401359 → check 9 ✓
const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3] as const;
const CENTURY_OFFSET: Record<number, number> = { 0: 1900, 20: 2000, 40: 2100, 60: 2200, 80: 1800 };

export function isValidPesel(raw: string): boolean {
  const p = raw.replace(/\s/g, '');
  if (!/^\d{11}$/.test(p)) return false;
  const d = p.split('').map(Number);
  // Checksum
  const sum = PESEL_WEIGHTS.reduce((a, w, i) => a + w * d[i], 0);
  if ((10 - (sum % 10)) % 10 !== d[10]) return false;
  // Embedded-DOB cross-check (century-encoded month)
  const yy = d[0] * 10 + d[1];
  const mmRaw = d[2] * 10 + d[3];
  const dd = d[4] * 10 + d[5];
  const offset = CENTURY_OFFSET[mmRaw - (mmRaw % 20)];
  if (offset === undefined) return false;
  const month = (mmRaw % 20);
  const year = offset + yy;
  const date = new Date(Date.UTC(year, month - 1, dd));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === dd && month >= 1 && month <= 12;
}
```

### Pattern 3: Saudi ID / Iqama — standard Luhn + leading-digit type
**Example:**
```typescript
// Source: alhazmy13/Saudi-ID-Validator + SAP KB 2384001 [CITED] — standard Luhn, mod-10
// Returns 1 (citizen), 2 (resident), or false. Leading digit encodes type.
export function classifySaudiId(raw: string): 1 | 2 | false {
  const id = raw.replace(/\s/g, '');
  if (!/^[12]\d{9}$/.test(id)) return false;
  let sum = 0, alt = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let n = Number(id[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  if (sum % 10 !== 0) return false;
  return id[0] === '1' ? 1 : 2;
}
```

### Pattern 4: UK NI number — format + DWP exclusions
```typescript
// Source: GOV.UK NIM39110 (HMRC manual) + en.wikipedia.org/wiki/National_Insurance_number [CITED]
// 2 letters + 6 digits + 1 suffix A-D. Neither prefix letter ∈ {D,F,I,Q,U,V}; 2nd letter ≠ O;
// prefix ∉ {BG,GB,KN,NK,NT,TN,ZZ}.
const NI_DISALLOWED_FIRST = /[DFIQUV]/;
const NI_DISALLOWED_PREFIXES = new Set(['BG', 'GB', 'KN', 'NK', 'NT', 'TN', 'ZZ']);

export function isValidNiNumber(raw: string): boolean {
  const ni = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{6}[A-D]$/.test(ni)) return false;
  const [c1, c2] = ni;
  if (NI_DISALLOWED_FIRST.test(c1) || NI_DISALLOWED_FIRST.test(c2)) return false;
  if (c2 === 'O') return false;
  if (NI_DISALLOWED_PREFIXES.has(c1 + c2)) return false;
  return true;
}
```

### Pattern 5: UK tax code grammar (1257L + emergency/K/special)
```typescript
// Source: GOV.UK PAYE manual PAYE11045/PAYE11075 + tax-codes/what-your-tax-code-means [CITED]
// Number+suffix(L/M/N/T) | K-prefix (K1257) | special (BR/D0/D1/0T/NT) | optional S/C jurisdiction prefix
// | optional emergency W1/M1/X suffix.
const TAX_CODE = /^(?:[SC])?(?:(?:\d{1,4}[LMNT])|(?:K\d{1,4})|0T|BR|D0|D1|NT)(?:\s?(?:W1|M1|X))?$/i;
export function isValidUkTaxCode(raw: string): boolean { return TAX_CODE.test(raw.replace(/\s/g, '')); }
```

### Anti-Patterns to Avoid
- **Putting any national ID in `countryFields` JSON.** `getCountryFields` returns the JSON wholesale and would leak PESEL/SSN/Iqama/Emirates-ID. Encrypted national IDs live in dedicated columns ONLY (the exact P84 SSN lesson — `country-fields.ts:227` comment).
- **Adding `EmployeeProfile` to `globalModels`** (`tenant.ts:42`). It is tenant-owning; cross-org leak test required (D-01).
- **Re-implementing a naive `Σ(w·d) mod 11` for Steuer-IdNr.** That is the PESEL/NIP algorithm and yields wrong results — the existing `de-validators.ts:29` comment explicitly warns against this confusion. Steuer-IdNr uses the *iterative* ISO 7064.
- **Hard-blocking save on the Emirates-ID checksum.** The Luhn variant has documented false-negatives (valid IDs fail). Format-validate strictly; treat the checksum as advisory only.
- **Forking the contractor country-fields engine.** D-02 — extend the idiom, don't copy-mutate it.
- **A `*-container.tsx` file in the employee UI.** D-06 mandates web-vite layering: page → wired section → hook → presentational, NO container suffix (the newer convention; the contractor code still has `-container` but employees follow the current spec).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ISO 7064 MOD 11,10 check digit | New mod-11 loop | `mod11_10CheckDigit` (`de-validators.ts:29`) | Iterative algorithm; naive mod-11 is wrong; already tested |
| AES-256-GCM PII crypto | New cipher code | Mirror `ssn-crypto.ts` exactly | `iv:authTag:ciphertext` format is audited; IV length, authTag handling are subtle |
| RBAC + audit reveal flow | Ad-hoc permission check | Mirror `contractor.revealSsn` + `requirePermission` + `writeAuditLog` | Staff-router-only, never portal; reveal held in local state never cached (see `use-reveal-ssn.ts`) |
| Luhn (Saudi ID) | New Luhn | Standard mod-10 Luhn (Pattern 3) | Well-defined; only the leading-digit type-classification is SA-specific |
| Tenant scoping | Manual `where: { organizationId }` everywhere | The `withTenantScope` extension on `ctx.db` | `EmployeeProfile` inherits it once it's a tenant model not in `globalModels` |
| Versioned reference table | Inline array with no provenance | `bacs-modulus-tables.ts` template (VERSION + SOURCE consts + subset note) | Adviser-verify + maintenance traceability (D-10) |

**Key insight:** This phase is ~80% mechanical reuse. The only genuinely novel code is the ~14 greenfield validators (algorithms in this doc, all with verified test vectors) and the seed-data assembly. Every "should I build X?" question has an in-tree precedent — name it in the plan.

## Runtime State Inventory

> Greenfield additive phase. No rename/refactor/migration of existing runtime state. The one migration concern is additive-only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `EmployeeProfile` is a NEW table; no existing rows store these IDs. The Worker/Employee backfill is P89's concern, not P90's. | None for P90 |
| Live service config | None — D-05 forbids live gov calls; ELStAM/ZUS/NFZ are stub hooks + local seed lists only. | None |
| OS-registered state | None — no schedulers/daemons touched. | None |
| Secrets/env vars | NEW: `EMPLOYEE_PII_ENCRYPTION_KEY` (hex-32) must be added to `packages/validators/src/env.ts` + `minimal-server-env.ts` + `.env.example` (mirror `SSN_ENCRYPTION_KEY` at `env.ts:194`). `SSN_ENCRYPTION_KEY` already exists and is reused for the SSN column. | Add new env var + schema + example |
| Build artifacts | Prisma client regenerates from the new `employee.prisma` — `pnpm --filter @contractor-ops/db generate` after schema add. | Regenerate Prisma client |

**Migration note:** The `EmployeeProfile` table + reference-lookup tables are purely additive (new tables, new columns) → follow the established additive/reversible/per-region migration convention (P83–88). Lower risk than P89's backfill (no existing-row mutation). The migration is `[BLOCKING]` multi-region (EU/ME/US) per repo convention — note that AE/SA orgs live in the ME database (`gulf.prisma` REGION comment), so `EmployeeProfile` deploys to all regions but Gulf data is only reached via the region-aware client.

## Common Pitfalls

### Pitfall 1: Emirates-ID checksum false-negatives
**What goes wrong:** Implementing a strict Luhn `(sum×9)%10` checksum and hard-blocking save rejects real, valid Emirates IDs.
**Why it happens:** UAE publishes no official checksum spec; the community Luhn variant is reverse-engineered and has confirmed discrepancies against ICP databases.
**How to avoid:** Strict format check (`784-\d{4}-\d{7}-\d`) is mandatory; the Luhn check is **advisory only** — surface a soft warning, never block. Annotate adviser-verify (D-10). Confidence: LOW on checksum, HIGH on format.
**Warning signs:** Test failures on real EID samples; user reports of "valid ID rejected".

### Pitfall 2: GOSI / WPS format drift
**What goes wrong:** Hard-coding GOSI = 9 digits or WPS Establishment ID = 13 digits as a strict regex when the real format has more structure or padding rules.
**Why it happens:** These are operational employer registration numbers, not standardized national IDs; sources are secondary (bank WPS SIF specs, GOSI portal guides) not primary statutory specs.
**How to avoid:** Lenient digit-length validation + adviser-verify annotation. WPS Establishment ID: 13 digits with leading-zero padding (MOL SIF spec). GOSI: ~9 digits. Mark MEDIUM confidence; execution-time re-verify with a Gulf adviser.
**Warning signs:** Valid registration numbers rejected.

### Pitfall 3: Steuer-IdNr digit-uniqueness rule mis-implemented
**What goes wrong:** Treating "no two consecutive identical digits" (USt-IdNr-style) instead of the IdNr rule "exactly one digit appears 2 OR 3 times in positions 1–10".
**Why it happens:** Two different German numbers, two different repetition rules; web sources conflate them.
**How to avoid:** Use Pattern 1 exactly (count occurrences, require exactly one digit with count 2 or 3). Test vector `36574261809` passes; `36554266806` fails the repetition rule. Confidence: HIGH (verified against python-stdnum source).

### Pitfall 4: PII national ID leaking through the registration response
**What goes wrong:** The `register` mutation returns the full `EmployeeProfile` including encrypted columns, or the encrypted value round-trips to the client.
**Why it happens:** Default Prisma return shape includes all columns.
**How to avoid:** Mirror `contractor-tax.ts:76` — `omit: { …Encrypted: true }` on the update/create return; full PII only via the audit-logged `revealPii` procedure held in local state (never query cache, per `use-reveal-ssn.ts` comment).
**Warning signs:** Encrypted blob or decrypted ID visible in network response / React Query cache.

### Pitfall 5: Promoted-vs-JSON misallocation
**What goes wrong:** Saudization category / etat / employment status buried in `countryFields` JSON → P97 HR dashboard + P94 payroll can't filter/aggregate without JSON path queries.
**Why it happens:** Over-applying "everything in JSON" from the contractor pattern.
**How to avoid:** D-01 names three mandatory promoted columns. See the storage table below for the recommended full promotion set.

### Pitfall 6: Polish reference lists are large + change over time
**What goes wrong:** Treating urząd skarbowy (~400 offices, 4-digit codes) or ZUS jednostki terenowe (6-char codes, ~600) as a tiny inline enum, or shipping a stale snapshot with no version.
**How to avoid:** Seed as versioned reference-lookup tables (bacs template: VERSION const + SOURCE URL + "subset/as-of date" note + adviser-verify). NFZ is small (16 wojewódzki branches, codes 01–16) → inline enum is fine. ZUS/urząd skarbowy → seed table.

## Code Examples

### Reference-list seed table (versioned + adviser-verify, bacs template)
```typescript
// Source pattern: packages/validators/src/bacs-modulus-tables.ts [VERIFIED: in-tree]
// LOCAL-ONLY / adviser-verify (D-10): list accuracy + as-of date need a PL payroll
// adviser sign-off before production. No live ZUS/NFZ API (D-05).
export const NFZ_ODDZIAL_VERSION = '2026-06' as const;
export const NFZ_ODDZIAL_SOURCE = 'https://www.nfz.gov.pl/o-nfz/struktura-nfz/identyfikatory-oddzialow-wojewodzkich-nfz/' as const;
export const NFZ_ODDZIALY = [
  { code: '01', name: 'Dolnośląski OW NFZ' },   // … 02–16
] as const;
```

### Better Auth statement + grant (mirror contractorPii)
```typescript
// permissions.ts — add to accessControlStatement (mirror contractorPii at :44)
employeePii: ['read'],   // reveal full PESEL/SSN/Iqama/Emirates-ID; HR roles + owner/admin only
// roles.ts — grant employeePii:read to the relevant set (planner decides: HR_ADMIN, owner, admin;
//   exclude PAYROLL_OFFICER/LEAVE_APPROVER unless justified — least-privilege, mirrors the
//   external_accountant exclusion from P84 D-09).
```

## Per-Market Field → Validator → PII-class → Storage Table

> The planner acts on this directly. **Storage legend:** `JSON` = `countryFields` JSONB · `ENC` = AES-256-GCM dedicated column (+`last4`/masked) · `TYPED` = promoted typed/indexed column · `REF` = seeded reference-lookup table FK/code.

### PL (EMP-REG-PL-01)
| Field | Validator | PII class | Storage | Confidence |
|-------|-----------|-----------|---------|-----------|
| PESEL | `isValidPesel` (NEW, Pattern 2) | NATIONAL-PERSON → encrypt | ENC (`EMPLOYEE_PII_ENCRYPTION_KEY`) + `peselLast4` | HIGH |
| urząd skarbowy ID | code in seeded list (4-digit) | non-PII | REF (seed table) | MEDIUM (list completeness) |
| ZUS oddział ID | code in seeded list (6-char territorial) | non-PII | REF (seed table) | MEDIUM |
| NFZ oddział | enum 01–16 | non-PII | JSON or TYPED enum | HIGH |
| stanowisko (job title) | free text | non-PII | JSON | HIGH |
| wymiar etatu | `Decimal(3,2)` 0.10–1.00 | non-PII | **TYPED** (`etat`, P94/P97 filter) | HIGH |
| stawka brutto (gross rate) | money (mirror existing money pattern) | non-PII (but sensitive) | JSON or TYPED | HIGH |
| ZUS title code (kod tytułu ubezpieczenia) | 6-char structured (`^\d{6}$`, XX XX X X) | non-PII | JSON | MEDIUM |

### DE (EMP-REG-DE-01)
| Field | Validator | PII class | Storage | Confidence |
|-------|-----------|-----------|---------|-----------|
| Steuer-IdNr | `isValidSteuerIdNr` (NEW, Pattern 1; reuses `mod11_10CheckDigit`) | tax ID → **plain, RBAC-gated** (D-04) | JSON (RBAC-gated read) | HIGH |
| SV-Nummer | `isValidSvNummer` (REUSE `de-validators.ts:92`) | social ID → plain, RBAC-gated | JSON | HIGH |
| Krankenkasse ID | 8-digit Betriebsnummer, code in seeded list (~100 funds) | non-PII | REF | MEDIUM |
| Lohnsteuerklasse | enum I/II/III/IV/V/VI (NEW enum) | non-PII | TYPED enum (payroll filter) | HIGH |
| Kinderfreibetrag | `Decimal` (e.g. 0.5/1.0/2.0 allowances) | non-PII | JSON | HIGH |
| Kirchensteuer | boolean (+ optional confession) | non-PII | JSON | HIGH |
| ELStAM lookup | stub hook (NO live API, D-05) | non-PII | service seam (`elstam-stub.ts`) | HIGH (it IS a stub) |

### UK (EMP-REG-UK-01)
| Field | Validator | PII class | Storage | Confidence |
|-------|-----------|-----------|---------|-----------|
| NI number | `isValidNiNumber` (NEW, Pattern 4) | social ID → **plain, RBAC-gated** (D-04) | JSON (RBAC-gated) | HIGH |
| PAYE reference | `^\d{3}\/[A-Z0-9]{1,10}$` (NNN/refs) | non-PII (employer ID) | JSON | MEDIUM |
| tax code | `isValidUkTaxCode` (NEW, Pattern 5) | non-PII | JSON | HIGH |
| student-loan plan | enum PLAN_1/PLAN_2/PLAN_4/PLAN_5/POSTGRAD/NONE | non-PII | JSON | HIGH |
| pension auto-enrol | boolean | non-PII | JSON | HIGH |

### US (EMP-REG-US-01)
| Field | Validator | PII class | Storage | Confidence |
|-------|-----------|-----------|---------|-----------|
| SSN | `isValidSsn` (REUSE `us-validators.ts:152`) | NATIONAL-PERSON → encrypt (REUSE `ssn-crypto.ts` + `SSN_ENCRYPTION_KEY`) | ENC + `ssnLast4` | HIGH |
| W-4 step-1c filing status | enum SINGLE/MARRIED_FILING_JOINTLY/HEAD_OF_HOUSEHOLD | non-PII | JSON or TYPED | HIGH |
| state withholding | enum of 10 highest-pop states + `OTHER` + free-text `stateOther` | non-PII | JSON | HIGH (10-state list below) |

**10 highest-population US states (2025/26):** CA, TX, FL, NY, PA, IL, OH, GA, NC, MI. Plus `OTHER` + free-text fallback (REQUIREMENTS line 218; full 50-state matrix deferred to v7.5). Confidence MEDIUM on exact ordering — verify population ranking at execution; the *set* is stable.

### AE (EMP-REG-AE-01)
| Field | Validator | PII class | Storage | Confidence |
|-------|-----------|-----------|---------|-----------|
| Emirates ID | `isValidEmiratesId` (NEW: strict format `784-\d{4}-\d{7}-\d`; Luhn ADVISORY only) | NATIONAL-PERSON → encrypt | ENC + `emiratesIdLast4` | format HIGH / checksum LOW |
| visa type | enum (e.g. EMPLOYMENT/GOLDEN/INVESTOR/FAMILY/STUDENT — adviser-verify) | non-PII | JSON | MEDIUM |
| WPS Establishment ID | `^\d{1,13}$` (13-digit padded, MOL) | non-PII (employer ID) | JSON | MEDIUM |

### SA (EMP-REG-SA-01)
| Field | Validator | PII class | Storage | Confidence |
|-------|-----------|-----------|---------|-----------|
| Iqama / National ID | `classifySaudiId` (NEW, Pattern 3; Luhn, leading 1=citizen/2=resident) | NATIONAL-PERSON → encrypt | ENC + `iqamaLast4` (+ optional typed `saudiIdType` 1/2) | HIGH |
| GOSI registration number | `^\d{9}$` (~9 digits) | non-PII (employer reg) | JSON | MEDIUM |
| Saudization category | REUSE `NitaqatBand` enum (`gulf.prisma:118`) | non-PII | **TYPED** (`saudizationCategory`, P97 filter — D-01) | HIGH |

### Recommended promoted typed-column set (Claude's-discretion resolution)
Per D-01 the three mandatory: `saudizationCategory` (NitaqatBand?), `etat` (Decimal(3,2)?), `employmentStatus` (enum). **Recommend also promoting:** `lohnsteuerklasse` (DE payroll filter) — optional, planner's call. Everything else stays in `countryFields` JSON. Encrypted PII (`peselEncrypted`/`ssnEncrypted`/`iqamaEncrypted`/`emiratesIdEncrypted` + their `*Last4`) are dedicated columns by definition. **No AE/SA sub-table needed** — visa/WPS/GOSI are JSON; revisit only if a later phase needs expiry reminders.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSN/tax IDs in `countryFields` JSON | National IDs in dedicated encrypted columns | P84 (2026-06) | The PII boundary this phase extends to PESEL/Iqama/Emirates-ID |
| `*-container.tsx` UI suffix | page → wired section → hook → presentational (no container) | web-vite ARCHITECTURE.md current spec | Employee UI must NOT use `-container` (D-06) |
| Naive `Σ(w·d) mod 11` for German IDs | Iterative ISO 7064 MOD 11,10 (`mod11_10CheckDigit`) | de-validators.ts (v5.0) | Steuer-IdNr reuses it; never re-implement |

**Deprecated/outdated:**
- SSN randomization (2011-06-25) removed geographic significance → no area-to-state table (already reflected in `isValidSsn`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Emirates-ID uses Luhn `(sum×9)%10` over first 14 digits | Pattern, AE table | LOW-confidence checksum → kept ADVISORY (mitigated; format is the gate) |
| A2 | GOSI registration number = 9 digits | SA table | Valid numbers rejected → use lenient length + adviser-verify |
| A3 | WPS Establishment ID = 13 digits (leading-zero padded) | AE table | Same — lenient + adviser-verify |
| A4 | urząd skarbowy = 4-digit codes (~400 offices) | PL table, reference lists | Seed list incomplete → versioned + as-of date + adviser-verify |
| A5 | ZUS jednostka terenowa = 6-char territorial code | PL table | Format/list drift → seed + adviser-verify |
| A6 | ZUS kod tytułu ubezpieczenia = 6-char structured (`^\d{6}$`) | PL table | Over/under-strict → format-only, adviser-verify |
| A7 | 10 highest-pop states = CA,TX,FL,NY,PA,IL,OH,GA,NC,MI | US table | Ranking shifts → the *set* is stable; verify at execution |
| A8 | Krankenkasse = 8-digit Betriebsnummer; ~100 funds | DE table | Seed list scope → versioned + adviser-verify |
| A9 | AE visa-type enum values | AE table | Enum incomplete → adviser-verify; allow `OTHER` |
| A10 | PAYE reference format `NNN/refs` | UK table | Lenient regex; adviser-verify |
| A11 | Steuer-IdNr uniqueness = exactly one digit 2-or-3× | Pattern 1 | HIGH (python-stdnum source + test vector) — low risk |

> Per the package-name provenance rule, all of A1–A10 are `[ASSUMED]`/`[CITED]` from non-primary or web sources and need adviser/execution-time confirmation. A11 + the PESEL/SV-Nummer/SSN/NIP algorithms are verified (test vectors computed this session) → HIGH.

## Open Questions

1. **Exact Gulf operational-ID formats (GOSI/WPS) and AE visa-type enum.**
   - What we know: GOSI ≈ 9 digits, WPS Establishment ID = 13 digits (secondary sources).
   - What's unclear: precise structure/padding; the canonical visa-type list.
   - Recommendation: lenient length validators + adviser-verify annotation; allow `OTHER` for visa type. Re-verify at execution with a Gulf payroll adviser (local-only posture permits shipping lenient).

2. **Reference-list completeness (urząd skarbowy, ZUS, Krankenkasse).**
   - What we know: formats + authoritative source URLs (NFZ small; the others large).
   - What's unclear: a complete, current machine-readable list isn't fetched in this session.
   - Recommendation: seed from the cited gov sources, version + date-stamp, mark adviser-verify (D-10). NFZ inline; the rest as seed tables.

3. **`employeePii:read` grant set across the 4 P89 HR roles.**
   - What we know: P84 granted `contractorPii:read` to owner/admin/finance_admin only (least-privilege; external_accountant excluded).
   - Recommendation: grant to `HR_ADMIN` + owner + admin; exclude `PAYROLL_OFFICER`/`LEAVE_APPROVER` unless a payroll-export need is shown (mirror P84 D-09). Planner's discretion (D-06 list).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Phase 89 (Worker/Employee + `employee` resource + 4 HR roles + `module.workforce-employees`) | EVERYTHING (D-08 hard dep) | ✗ NOT YET (verified: no models/resource/router) | — | None — execution BLOCKED until P89 lands. Plan now, execute after. |
| `SSN_ENCRYPTION_KEY` (hex-32) | SSN column reuse | ✓ | `env.ts:194` | — |
| `EMPLOYEE_PII_ENCRYPTION_KEY` (hex-32) | PESEL/Iqama/Emirates-ID | ✗ (new) | — | Add to env schema + `.env.example` |
| vitest | Validator unit tests | ✓ | 4.1.5 | — |
| Prisma 7 multi-region migrate | Additive `employee.prisma` migration | ✓ | repo-standard | — |
| Live ELStAM/ZUS/NFZ/GOSI APIs | (NOT used — D-05) | n/a | — | Stub hook + seed lists (by design) |

**Missing dependencies with no fallback:** Phase 89 (blocks execution only, not planning).
**Missing dependencies with fallback:** `EMPLOYEE_PII_ENCRYPTION_KEY` (add it).

## Validation Architecture

> nyquist_validation = true (config.json). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 (turbo) |
| Config file | `packages/validators/vitest.config.ts`; `packages/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @contractor-ops/validators test src/__tests__/employee-validators.test.ts` |
| Full suite command | `pnpm --filter @contractor-ops/validators test && pnpm --filter @contractor-ops/api test` (NEVER full web-vite suite — RAM; scope it) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMP-REG-PL-01 | PESEL accept `44051401359`, reject bad checksum + bad DOB; etat range 0.10–1.00 | unit | `pnpm --filter @contractor-ops/validators test employee-validators` | ❌ Wave 0 |
| EMP-REG-DE-01 | Steuer-IdNr accept `36574261809`, reject `36554266806` (uniqueness) + bad mod11-10; Lohnsteuerklasse enum | unit | same | ❌ Wave 0 |
| EMP-REG-UK-01 | NI accept valid, reject D/F/I/Q/U/V first, O second, BG/GB/KN/NK/NT/TN/ZZ prefix; tax code 1257L/K100/BR/0T/+W1 | unit | same | ❌ Wave 0 |
| EMP-REG-US-01 | SSN reuse (existing test covers); W-4 enum; 10-state enum + free-text | unit | `pnpm --filter @contractor-ops/validators test country-fields` (extend) | ⚠️ partial (SSN exists) |
| EMP-REG-AE-01 | Emirates ID format accept/reject; checksum advisory (no hard fail) | unit | employee-validators | ❌ Wave 0 |
| EMP-REG-SA-01 | Saudi ID Luhn accept citizen(1)/resident(2), reject bad Luhn; NitaqatBand reuse | unit | employee-validators | ❌ Wave 0 |
| EMP-REG-* (model) | `EmployeeProfile` cross-org leak rejected; PII not in JSON; reveal RBAC+audit | integration | `pnpm --filter @contractor-ops/api test` (mirror `tenant-isolation.test.ts`) | ❌ Wave 0 |
| EMP-REG-* (PII) | `register` response omits encrypted cols; `revealPii` requires `employeePii:read` + writes audit | integration | api test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/validators test <touched test file>`
- **Per wave merge:** `pnpm --filter @contractor-ops/validators test && pnpm --filter @contractor-ops/api test`
- **Phase gate:** both green + `pnpm lint:schema` (globalModels guard) + `pnpm typecheck --filter=@contractor-ops/api` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/validators/src/__tests__/employee-validators.test.ts` — PESEL/SteuerIdNr/NI/taxCode/SaudiId/EmiratesId/GOSI/WPS vectors (use vectors in this doc)
- [ ] `packages/validators/src/__tests__/employee-country-fields.test.ts` — per-country Zod dispatch + required-vs-optional
- [ ] `packages/api/src/__tests__/employee-registry.test.ts` — register + revealPii RBAC/audit; mirror `contractor-tax`/`tenant-isolation` patterns
- [ ] `packages/api/src/__tests__/employee-cross-org-leak.test.ts` — `EmployeeProfile` tenant isolation (mirror `tenant-isolation.test.ts`)
- [ ] Framework install: none (vitest present)

## Security Domain

> security_enforcement absent → enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Session from Better Auth (existing) |
| V3 Session Management | no | Existing tenant session |
| V4 Access Control | **yes** | `employeePii:read` Better Auth statement + `requirePermission`; tenant scoping via `withTenantScope`; `globalModels` exclusion; cross-org leak test |
| V5 Input Validation | **yes** | Zod `.strict()` on `register` (D-09); pure validators at client + server boundary; `safeParse` no unsafe `as` |
| V6 Cryptography | **yes** | AES-256-GCM via `ssn-crypto`/`employee-pii-crypto` (never hand-roll); dedicated `EMPLOYEE_PII_ENCRYPTION_KEY` blast-radius separation |
| V7 Error/Logging | **yes** | PII never logged — extend `packages/logger/src/pii-mask.ts` `PII_MASK_PATHS` with `*.pesel`, `*.iqama`, `*.emiratesId`, `*.nationalId`, `*.ssn` (+ casing/`countryFields.*` variants), mirroring P84 D-08 |
| V8 Data Protection | **yes** | National IDs encrypted-at-rest + `last4`-only default; reveal audit-logged; reveal value held in local state never cached (per `use-reveal-ssn.ts`) |

### Known Threat Patterns for {Prisma/tRPC/React employee registry}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leak via `countryFields` JSON wholesale read | Information Disclosure | National IDs in dedicated encrypted columns ONLY, never JSON (Anti-Pattern 1) |
| Cross-org `EmployeeProfile` read (IDOR) | Information Disclosure | `withTenantScope` + `organizationId` in every where + `globalModels` exclusion + leak test |
| Encrypted blob round-tripped to client | Information Disclosure | `omit: { …Encrypted: true }` on register/update return (`contractor-tax.ts:76`) |
| Reveal without authz/audit | Elevation / Repudiation | `requirePermission(employeePii:read)` + `writeAuditLog` on `revealPii` (mirror `revealSsn`) |
| PII in application logs | Information Disclosure | `PII_MASK_PATHS` extension (V7) |
| ReDoS on adversarial ID input | DoS | Anchored regex `^...$` in all validators (existing convention) |
| Reveal procedure exposed on portal | Information Disclosure | Staff-router ONLY, never `portalAppRouter` (P84 lesson) |

## Project Constraints (from CLAUDE.md)
- pnpm 10 + Turborepo; Prisma 7 (`prisma-client` generator); tRPC v11; Zod on every procedure (`.strict()` per D-09); `safeParse` for boundaries, no unsafe `as`.
- No `console.*` — `@contractor-ops/logger` (Pino). Extend `PII_MASK_PATHS`.
- Feature flags via `@contractor-ops/feature-flags` only — `module.workforce-employees` (reuse, P89 registers; do NOT re-register).
- 7-day release age on deps — N/A (no new deps).
- `packages/*` change → check `apps/*` + `pnpm typecheck --filter`. New env var → `.env.example` + package `env` schema (`packages/validators/src/env.ts`) + `pnpm check:no-process-env`.
- No breadcrumb IDs in source comments (no `Phase 90`, `EMP-REG-PL-01`, `D-04` in code) — `pnpm lint:no-breadcrumbs`. Real domain IDs (PESEL, W-8BEN-style, RODO) stay.
- Tenant from session; `writeAuditLog` on sensitive mutations (register + reveal).
- web-vite layering: page → wired section → hook (sole tRPC boundary) → presentational; mandatory loading/empty/error + WCAG; i18n parity en/en-US/de/pl/ar; `frontend-design` skill before UI edits; `pnpm check:web-vite-data-layer`.
- Documentation-follows-code: update `wiki/domains/` (employee-registry), `wiki/structure/{prisma-schema-areas, packages, web-vite-domains}.md`, `wiki/patterns/` (country-fields reuse + PII boundary), `log.md` + `hot.md`, `.planning/MEMORY.md`, graph rebuild — in the SAME change set. `pnpm check:wiki-brain` before done.
- `pnpm lint:schema` guards the schema (globalModels) — `EmployeeProfile` must be tenant-owning.

## Sources

### Primary (HIGH confidence)
- In-tree code (VERIFIED by Read this session): `de-validators.ts`, `us-validators.ts`, `uk-validators.ts`, `country-fields.ts`, `ssn-crypto.ts`, `contractor-tax.ts`, `permissions.ts`, `country-compliance-section.tsx`, `use-reveal-ssn.ts`, `gulf.prisma`, `contractor.prisma`, `bacs-modulus-tables.ts`, `tenant.ts` (globalModels), `env.ts` (SSN key).
- Checksum test vectors computed this session: PESEL `44051401359`→9 ✓; Steuer-IdNr `36574261809`→9 (ISO7064 MOD11-10) ✓; NIP `5260001246`→6 ✓.
- GOV.UK HMRC NIM39110 (NI format/security) — https://www.gov.uk/hmrc-internal-manuals/national-insurance-manual/nim39110
- GOV.UK PAYE manual PAYE11045/PAYE11075 (tax-code suffix rules) + https://www.gov.uk/tax-codes/what-your-tax-code-means
- GOV.UK student-loan employer guidance — https://www.gov.uk/guidance/special-rules-for-student-loans
- python-stdnum `stdnum.de.idnr` (Steuer-IdNr algorithm + test vector) — https://arthurdejong.org/python-stdnum/doc/

### Secondary (MEDIUM confidence)
- PESEL structure — https://en.wikipedia.org/wiki/PESEL (algorithm cross-checked against verified test vector)
- NI exclusions — https://en.wikipedia.org/wiki/National_Insurance_number
- Saudi ID Luhn — github.com/alhazmy13/Saudi-ID-Validator + SAP KB 2384001 (https://userapps.support.sap.com/sap/support/knowledge/en/2384001)
- NFZ oddziały (01–16) — https://www.nfz.gov.pl/o-nfz/struktura-nfz/identyfikatory-oddzialow-wojewodzkich-nfz/
- ZUS kody terytorialne — przepisy.gofin.pl + isap.sejm.gov.pl
- Krankenkasse Betriebsnummern + Lohnsteuerklassen — krankenkasseninfo.de, de.wikipedia.org/wiki/Lohnsteuerklasse
- W-4 2020 step-1c + no-income-tax states — https://www.irs.gov/newsroom/faqs-on-the-2020-form-w-4
- WPS Establishment ID (13-digit) — MOL/bank WPS SIF specs; GOSI (9-digit) — gosi.gov.sa guides

### Tertiary (LOW confidence — execution-time re-verify)
- Emirates-ID Luhn variant `(sum×9)%10` — community gists (documented false-negatives); checksum ADVISORY only
- GOSI/WPS exact structure + AE visa-type enum — secondary sources; Gulf adviser verification needed
- urząd skarbowy / ZUS full reference-list contents — formats known, complete current list not fetched this session

## Metadata

**Confidence breakdown:**
- In-tree reuse + architecture: HIGH — every asset Read + verified present; P89-gap confirmed.
- PL/DE/UK validator algorithms: HIGH — verified against computed test vectors + primary gov/python-stdnum sources.
- US: HIGH — SSN/EIN reused verbatim; W-4/state-list straightforward.
- Gulf (AE/SA) ID checksums: SA HIGH (standard Luhn), AE LOW (no official spec) — format-strict, checksum-advisory.
- Reference-list completeness + GOSI/WPS formats: MEDIUM — formats known, full data + exact structure adviser-deferred (D-10).

**Research date:** 2026-06-21
**Valid until:** 2026-07-21 (30 days; statutory ID formats are stable; reference-list contents + state population ranking are the volatile parts — re-verify at execution)

## RESEARCH COMPLETE
