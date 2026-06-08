# Phase 84: Theme A — US Contractor Profile Fields + en-US Locale - Research

**Researched:** 2026-06-08
**Domain:** US identity-field capture (EIN/SSN/USPS) + RBAC PII-reveal + field-encryption + en-US i18n, all bolted onto verified in-tree compliance/validator/i18n patterns.
**Confidence:** HIGH (every anchor read in-tree; the only external-fact areas — USPS endpoint shape, IRS prefixes, SSN ranges — are CITED to authoritative sources and flagged legal-deferred).

## Summary

This is a **consistency phase with a load-bearing security surface**, not a greenfield build. Four of the five requirements (EIN/SSN validators, the US profile component, en-US locale) slot 1:1 into patterns already shipped for UK/DE in Phases 47/56/57/63/70. The fifth (USPS) is a new external adapter, but the repo already has the *exact* template: `packages/gov-api` (HMRC VAT client = OAuth2 client-credentials + token cache + single-flight refresh + Upstash sliding-window rate-limiter + Zod-boundary + fail-open).

The two genuinely new things are: (1) **encrypt-at-rest SSN** — but even this has a precise in-tree mirror in `ContractorBillingProfile.bankAccountEncrypted`/`bankAccountMasked` + `packages/api/src/services/bank-account-crypto.ts` (`encryptBankAccount`/`decryptBankAccount`, single string, single env key, `iv:authTag:ciphertext`); and (2) a **new RBAC permission** `contractorPii:read` — which is a Better Auth access-control statement edit in `packages/auth/src/permissions.ts` + `roles.ts`, NOT a custom map.

**CRITICAL CORRECTION to CONTEXT hints:** The platform has **10 roles, not 8**, and the role names in CONTEXT (`owner/admin/manager/member/viewer/it_admin`) are WRONG. Actual roles: `owner, admin, finance_admin, ops_manager, team_manager, legal_compliance_viewer, it_admin, external_accountant, readonly, platform_operator`. D-02's "finance/accountant" maps to **`finance_admin` + `external_accountant`**; there is no `manager`/`member`/`viewer` role. The planner MUST use these exact names.

**Primary recommendation:** Mirror `bank-account-crypto.ts` (not the credential-store) for SSN; add `contractorPii:['read']` to the access-control statement and grant it to `owner/admin/finance_admin (D-09: external_accountant DENIED)`; build the USPS client as a new `packages/gov-api/src/clients/usps-client.ts` subclass of `GovApiClient`; persist SSN as dedicated `Contractor.ssnEncrypted`/`ssnLast4` columns (NOT inside `countryFields` JSONB); ship en-US as a thin-override `en-US.json` and extend the parity guard with a fallback-aware peer mode.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full SSN **encrypted-at-rest** (reuse existing AES-256-GCM field-encryption util — the credential/integration-store pattern), plain `ssnLast4` for default display. Server returns last-4 only; full value only through a dedicated **audit-logged reveal procedure** gated by NEW `CONTRACTOR_PII:READ`. EIN stored plain (business ID) but added to the **log** PII-mask.
- **D-02:** `CONTRACTOR_PII:READ` granted by default to **owner + admin + finance/accountant** roles; NOT manager/member/viewer/it_admin. Reveal calls `writeAuditLog`.
- **D-03:** USPS **advisory, non-blocking.** Server-side normalize-to-CASS on save; surface normalized suggestion + `verified`/`unverified` flag; NEVER hard-block save. USPS down OR 60 req/hr throttle hit → accept unverified-with-flag + allow later re-validation. Throttle/cache mechanics (OAuth2, 60/hr token bucket, no-batch, cache keyed by raw address) deferred to plan-phase.
- **D-04:** **Thin-override** `apps/web-vite/messages/en-US.json` (only divergent keys); `fallbackLng` map `en-US → en → pl`(default). Add `'en-US'` to `SUPPORTED_LOCALES` + `localeMeta` + bundle loader. **Teach `i18n:parity` that en-US inherits en** (fallback-parity, not literal-key parity). US date/currency/measure via `Intl` `en-US`.
- **D-05:** **Strict, table-backed.** EIN = `XX-XXXXXXX` + IRS-published valid-prefix table; SSN = format + invalid-range rejection (area `000`/`666`/`900–999`, group `00`, serial `0000`). Both in `packages/validators/src/us-validators.ts` (mirror uk/de-validators) consumed by new `usCountryFieldsSchema` in `country-fields.ts`. IRS-prefix accuracy → legal/tax-adviser-deferred.
- **D-06:** US section dispatches from `CountryComplianceSection`; add `UsComplianceFields` (mirror Uk/De); register `'US'` in country-compliance config. web-vite page→container→hook→component; `frontend-design` skill; loading/empty/error + WCAG. SSN field = masked-input + gated-reveal.
- **D-07:** US-LOC-02 (tax-treaty table) + US-LOC-03 (W-8BEN auto-populate) are **Phase 85** — do NOT build treaty logic here.
- **D-08:** Add `*.ssn`, `*.ein`, `*.countryFields.ssn`, `*.countryFields.ein` (+ casing variants) to `packages/logger/src/pii-mask.ts` `PII_MASK_PATHS`.

### Claude's Discretion

- Exact field-encryption util + key management for the SSN column (reuse existing per-field/credential AES-256-GCM helper) — planner.
- Initial divergent-key set in `en-US.json` (planner derives from `en`: spelling + date/currency/measure keys + US-specific labels added this phase).
- USPS throttle/cache implementation (token bucket / Redis) — plan-phase.

### Deferred Ideas (OUT OF SCOPE)

- US tax-treaty rate table + W-8BEN treaty-article auto-populate (US-LOC-02/03) — Phase 85.
- USPS batch validation — API is no-batch; single-address only.
- IRS-prefix-table / SSN-range legal verification — annotate; legal/tax-adviser-deferred.
- Full 50-state-specific address rules — CASS normalize only; no per-state logic.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| US-FIELD-01 | EIN validator (`XX-XXXXXXX` + IRS prefix table) | `us-validators.ts` mirrors `uk-validators.ts`; IRS valid-prefix list captured below `[CITED: irs.gov]` |
| US-FIELD-02 | SSN intake, PII-grade masking (last-4 default; full behind `CONTRACTOR_PII:READ`) | `bank-account-crypto.ts` + `bankAccountEncrypted`/`bankAccountMasked`/`****last4` pattern is exact mirror; RBAC via `permissions.ts`/`roles.ts`; reveal via `writeAuditLog` |
| US-FIELD-03 | US address validation via USPS Addresses (CASS) | `packages/gov-api` HMRC-VAT client = full OAuth2+cache+ratelimit+fail-open template; USPS endpoints `[CITED: developers.usps.com]` |
| US-FIELD-04 | US profile component dispatched from `CountryComplianceSection` | `CountryFieldsDispatch` switch + `getCountryFieldsConfig` server config; `UsComplianceFields` mirrors `UkComplianceFields` |
| US-LOC-01 | `en-US` full key parity vs `en` (date/currency/measure + American copy) | `messages.ts` `SUPPORTED_LOCALES`/`localeMeta`/loaders; `i18n/index.ts` `fallbackLng`; `scripts/i18n-parity.mjs` + `run-guard.ts` parity mechanics |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| EIN/SSN format+range validation | `packages/validators` (shared) | web-vite (RHF resolver) + API (tRPC input) | Pure functions run client+server, same as uk/de-validators |
| SSN encrypt/decrypt | API service (`packages/api/src/services`) | — | Key + crypto are server-only; never crosses to client |
| SSN last-4 derivation + masked display | API (server-derived) | web-vite (renders masked value) | Server returns `ssnLast4` only; full never enters the DOM except transient reveal |
| `contractorPii:read` permission gate | `packages/auth` (statement+roles) + API middleware (`requirePermission`) | — | Better Auth access-control + `hasPermission`; re-read live per call |
| SSN reveal + audit log | API tRPC procedure | — | `writeAuditLog` is server-only; staff router (NOT portal) |
| USPS OAuth+validation+throttle+cache | `packages/gov-api` (external-API adapter) | API (orchestration on save) | External gov API belongs in gov-api; mirrors HMRC/VIES |
| USPS advisory status pill + suggestion UI | web-vite (component) | API (returns verified flag + normalized) | Mirrors `VatValidationStatusPill` |
| US profile section dispatch | web-vite (component) | API (`getCountryFieldsConfig`) | `CountryFieldsDispatch` switch + server config gate |
| en-US locale rendering + formatting | web-vite (i18n) | — | `Intl` en-US + i18next fallback; client-only |
| en-US parity enforcement | `scripts/` + `packages/lint-guards` (CI) | — | Build-time gate, not runtime |

## Standard Stack

### Core (all already in-tree — NO new external packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | in-tree (v4-era, `z.enum`/`superRefine` API) | EIN/SSN/usCountryFields schemas | Every country-fields schema uses it |
| `@upstash/ratelimit` | `^2.0.8` (in `packages/gov-api`, `packages/api`) | USPS 60/hr sliding-window | `GovApiRateLimiter` already wraps it `[VERIFIED: package.json]` |
| `@upstash/redis` | `^1.38.0` (in `packages/gov-api`, `packages/api`) | Rate-limit + address-cache backing | Already a dep `[VERIFIED: package.json]` |
| `node:crypto` | stdlib | AES-256-GCM SSN encrypt | `bank-account-crypto.ts` uses `createCipheriv('aes-256-gcm', …)` |
| `i18next` + `i18next-icu` + `react-i18next` | in-tree | en-US locale + ICU | `apps/web-vite/src/i18n/index.ts` |
| `date-fns` | in-tree | relative timestamps in pills | `VatValidationStatusPill` imports `formatDistanceToNow` |
| `vitest` | `^4.1.5` (all packages) | unit tests | `[VERIFIED: package.json]` |

### Supporting (first-party `@contractor-ops/ui` shadcn primitives — already in tree)

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `Card`/`CardHeader`/`CardTitle`/`CardContent` | Section chrome | Inherited from `CountryComplianceSection` unchanged |
| `Input`/`Label`/`Button`/`Badge`/`Tooltip*` | Fields, save, pills | Per UI-SPEC Registry Safety table |
| `EntityTypeSelect<T>` | US entity-type dropdown | Reuse generic, do NOT fork (UI-SPEC) |
| `lucide-react` (`Eye`/`EyeOff`/`Loader2`/`CheckCircle2`/`AlertTriangle`/`WifiOff`/`Minus`) | Reveal toggle + USPS pill icons | Matches existing icon usage |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reuse `bank-account-crypto.ts` directly for SSN | New `ssn-crypto.ts` with own `SSN_ENCRYPTION_KEY` | **Recommend new file + new key** — key separation per data type is cleaner (bank vs SSN blast-radius); but the *implementation* is a near-copy. Reusing `encryptBankAccount` verbatim couples two unrelated secrets to one key — avoid. |
| `credential-service.ts` (D-01's literal hint) | `bank-account-crypto.ts` | **bank-account-crypto wins** — it encrypts a single string with a single env key (SSN is a single string); credential-service encrypts a JSON blob keyed by `providerSlug` (wrong shape for a DB column). |
| USPS client in new package | New `clients/usps-client.ts` in `packages/gov-api` | **gov-api wins** — it already has `GovApiClient` base, rate-limiter, audit-logger, schemas dir; USPS is conceptually identical to HMRC/VIES. |

**Installation:** None. All required packages are already workspace deps. Only a **new env var** (`SSN_ENCRYPTION_KEY` hex-32) is added to `packages/validators/src/env.ts` + `minimal-server-env.ts` + `.env.example`, plus USPS optional creds (`USPS_CLIENT_ID`/`USPS_CLIENT_SECRET` or secret-store paths — optional-env per LOCAL-ONLY).

## Package Legitimacy Audit

> No external packages are installed this phase. Every library used is already a workspace dependency (verified in the respective `package.json` files). slopcheck/registry verification is **not applicable** — there is no new install surface. The only additions are: (1) a new env var, (2) new source files within existing packages.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No new installs — phase reuses in-tree deps only |

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────── web-vite (browser) ───────────────────────┐
  US contractor profile  │  page (thin) → CountryComplianceSectionContainer                  │
  edit                   │      → useCountryCompliance (hooks: ONLY tRPC boundary)           │
                         │      → CountryComplianceSectionView                               │
                         │           → CountryFieldsDispatch  switch(countryCode)            │
                         │                case 'US' → <UsComplianceFields>                   │
                         │                    EntityTypeSelect, EIN Input, SSN masked+reveal,│
                         │                    US address + <UspsAddressStatusPill>           │
                         └──────────────┬──────────────────────────────────┬────────────────┘
                                        │ tRPC (staff /api/trpc)            │ reveal (separate proc)
                                        ▼                                   ▼
        ┌──────────────── packages/api (Fastify tRPC) ─────────────────────────────────────┐
        │  contractor.updateCountryFields ──validate──> usCountryFieldsSchema (validators)  │
        │  contractor.updateUsProfile (NEW): EIN plain, SSN → ssn-crypto.encryptSsn()       │
        │       → Contractor.ssnEncrypted + ssnLast4  (dedicated columns, NOT JSONB)        │
        │       → USPS normalize (advisory) ──────────────────┐                             │
        │  contractor.revealSsn (NEW): requirePermission({contractorPii:['read']})          │
        │       → decryptSsn() → writeAuditLog(action:'contractor.ssn.revealed')            │
        └────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
                ┌──────── packages/gov-api ───▼──────────────────────────────────────┐
                │  UspsAddressClient extends GovApiClient                             │
                │    OAuth2 client-credentials → POST apis.usps.com/oauth2/v3/token   │
                │      (in-mem token cache, TTL−5min, single-flight refresh)          │
                │    GET /addresses/v3/address (CASS normalize + DPV)                 │
                │    GovApiRateLimiter sliding-window 60/3600s, GLOBAL key (per-cred) │
                │    address-result cache (Redis, key = sha256(raw address))          │
                │    FAIL-OPEN: throttle/Redis/USPS-down → return unverified, no throw│
                └────────────────────────────────────────────────────────────────────┘

   packages/logger/pii-mask.ts  ── PII_MASK_PATHS += ssn/ein (log redaction, orthogonal to display+RBAC)
   packages/auth/permissions.ts ── accessControlStatement += contractorPii:['read']
   packages/auth/roles.ts       ── grant contractorPii:['read'] to owner/admin/finance_admin (D-09: external_accountant DENIED)
```

### Recommended File-Placement Map (verified anchors)

```
packages/validators/src/
├── us-validators.ts                    # NEW — isValidEin, isValidSsn (mirror uk-validators.ts)
├── country-fields.ts                   # EDIT — add usCountryFieldsSchema + 'US' to countryFieldsSchemaMap
├── env.ts                              # EDIT — add SSN_ENCRYPTION_KEY: hex32 (+ optional USPS creds)
├── minimal-server-env.ts               # EDIT — add SSN_ENCRYPTION_KEY: HEX32
└── index.ts                            # EDIT — re-export us-validators + usCountryFieldsSchema

packages/api/src/
├── services/ssn-crypto.ts              # NEW — encryptSsn/decryptSsn (mirror bank-account-crypto.ts)
└── routers/core/contractor.ts          # EDIT — getCountryFieldsConfig 'US' fields list; updateUsProfile + revealSsn procedures

packages/auth/src/
├── permissions.ts                      # EDIT — accessControlStatement: contractorPii:['read']
└── roles.ts                            # EDIT — add to allPermissions + owner/admin/finance_admin (D-09: external_accountant DENIED)

packages/logger/src/pii-mask.ts         # EDIT — PII_MASK_PATHS += ssn/ein variants

packages/gov-api/src/
├── clients/usps-client.ts              # NEW — UspsAddressClient (mirror hmrc-vat-client.ts)
├── schemas/usps-address.schema.ts      # NEW — Zod for token + address response
└── index.ts                            # EDIT — export

packages/db/prisma/schema/contractor.prisma  # EDIT — Contractor: ssnEncrypted String?, ssnLast4 String?,
                                              #        usAddress* / uspsVerified Boolean? / uspsValidatedAt

apps/web-vite/src/components/contractors/
├── compliance/us-compliance-fields.tsx          # NEW — mirror uk-compliance-fields.tsx
├── compliance/ssn-masked-reveal.tsx             # NEW — masked + gated reveal (UI-SPEC §B)
├── usps-address-status-pill.tsx                 # NEW — mirror vat-validation-status-pill.tsx
├── country-compliance-section.tsx               # EDIT — CountryFieldsDispatch case 'US' + COUNTRY_LABELS.US
└── hooks/use-country-compliance.ts              # EDIT (or new hook) — revealSsn mutation + USPS revalidate

apps/web-vite/src/i18n/
├── messages.ts                         # EDIT — SUPPORTED_LOCALES += 'en-US'; localeMeta; localeLoaders
└── index.ts                            # EDIT — fallbackLng map (en-US → en)

apps/web-vite/messages/en-US.json       # NEW — thin override (divergent keys only)
apps/web-vite/messages/en.json          # EDIT — Contractors.compliance.us.* + countryCompliance.us.* + countries.US

scripts/i18n-parity.mjs                 # EDIT — fallback-aware peer mode for en-US
packages/lint-guards/src/i18n-parity/run-guard.ts  # EDIT — add fallbackBase option
```

### Pattern 1: AES-256-GCM single-string column encryption (SSN)
**What:** Mirror `bank-account-crypto.ts` exactly — single string in, `iv:authTag:ciphertext` out, single hex-32 env key.
**When to use:** The dedicated `Contractor.ssnEncrypted` column.
```typescript
// Source: packages/api/src/services/bank-account-crypto.ts (the precise mirror)
const ALGORITHM = 'aes-256-gcm'; const IV_LENGTH = 12;
function getEncryptionKey(): Buffer {
  return Buffer.from(getServerEnv().SSN_ENCRYPTION_KEY, 'hex'); // NEW key, separate from bank
}
export function encryptSsn(ssn: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let enc = cipher.update(ssn, 'utf8', 'hex'); enc += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}
// last-4 + masked column, written alongside (mirror contractor.ts:270-271):
//   ssnEncrypted = encryptSsn(cleaned); ssnLast4 = cleaned.slice(-4);
```

### Pattern 2: New RBAC permission via Better Auth access control
**What:** RBAC is **Better Auth `createAccessControl` statements**, not a custom map. Add a resource-action pair, then grant it per-role.
```typescript
// Source: packages/auth/src/permissions.ts — add to accessControlStatement:
contractorPii: ['read'],
// Source: packages/auth/src/roles.ts — add to allPermissions (for owner) AND to:
//   admin, finance_admin  → contractorPii: ['read']   (D-09: external_accountant EXCLUDED — DENIED)
//   (NOT external_accountant/ops_manager/team_manager/legal_compliance_viewer/it_admin/readonly/platform_operator)
// Middleware (packages/api/src/middleware/rbac.ts, already exists):
revealSsn: tenantProcedure.use(requirePermission({ contractorPii: ['read'] }))…
```
Note `requirePermission` re-reads `member.role` live every call (config.ts:278 comment) — no cookie-cache staleness for RBAC.

### Pattern 3: External gov-API adapter (USPS) on `packages/gov-api`
**What:** Subclass `GovApiClient`; OAuth2 client-credentials with in-memory token cache (TTL − 5min buffer, single-flight refresh); `GovApiRateLimiter` sliding-window; Zod `safeParse` boundary; typed errors; **fail-open** on throttle/Redis/USPS-down.
**When to use:** USPS Addresses 3.0 validation.
```typescript
// Source: packages/gov-api/src/clients/hmrc-vat-client.ts (the template)
// Differences for USPS:
//   - token endpoint: POST https://apis.usps.com/oauth2/v3/token (grant_type=client_credentials)
//   - validate: GET https://apis.usps.com/addresses/v3/address?streetAddress=…&city=…&state=…&ZIPCode=…
//   - rate limiter identifier: a FIXED key (e.g. 'usps-global'), NOT orgId — the 60/hr cap
//     is per-credential GLOBAL, so per-org bucketing would over-permit.
//   - config: { maxRequests: 60, windowMs: 3_600_000 }
//   - D-03 advisory: on self-throttle / 5xx / network error → return {verified:false} (no throw to the save path)
```

### Pattern 4: thin-override locale + fallback-aware parity gate
**What:** en-US is registered as a locale but its JSON holds only divergent keys; the parity gate must treat a key present in `en` as covered for `en-US`.
```javascript
// scripts/i18n-parity.mjs currently: base:'en', peers:['de','pl','ar'] — en-US is NOT a strict peer.
// Add en-US in a fallback-aware mode: a key counts as covered if present in en-US OR en.
// run-guard.ts: add `fallbackBase?: Set<string>` — when peer === en-US, treat
//   `peerKeys ∪ fallbackBaseKeys` as the covered set. en-US is then allowed to be a subset.
```

### Anti-Patterns to Avoid
- **Storing SSN inside `countryFields` JSONB.** The JSONB blob is the plain, Zod-validated, log-masked store (UTR/Steuernummer level). SSN needs encrypt-at-rest + dedicated `ssnEncrypted`/`ssnLast4` columns + a reveal procedure. Putting it in JSONB defeats D-01 and risks it leaking via `getCountryFields` (which returns the whole blob).
- **Exposing SSN reveal on the portal.** The portal-profile-router reveals bank account to the contractor themselves; SSN reveal is a STAFF action gated by `contractorPii:read`. Add it to the staff `contractor` router only — never `portalAppRouter`.
- **Per-org USPS rate-limit bucket.** HMRC's limiter keys on orgId because HMRC quota is generous (3 req/s). USPS is 60/hr **per credential, global** — keying on orgId would let N orgs each get 60/hr and blow the real cap. Use a fixed global key.
- **Adding `en-US` to the parity `peers` array as a strict peer.** That would fail CI the moment en-US.json is a subset of en (which is the whole point). Use fallback-aware mode.
- **Hardcoding new user-facing strings.** `VatValidationStatusPill` hardcodes labels (legacy), but CLAUDE.md forbids it; all new pill/section/error copy must be i18n keys (UI-SPEC Copywriting Contract).
- **`prisma migrate dev`.** Pre-existing migration-history drift blocks it (STATE.md). Use additive `db push` / direct ALTER for the new nullable columns; per-region prod apply deferred (matches Phase 82/83 posture).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM column crypto | Custom cipher wrapper | Mirror `bank-account-crypto.ts` | IV/authTag/format already correct + tested; reinventing risks nonce reuse |
| RBAC permission map | A bespoke role→permission object | Better Auth `accessControlStatement` + `roles.ts` | `requirePermission`/`hasPermission` already wired; a parallel map would drift |
| OAuth2 token cache + refresh | Hand-rolled token mgmt | `GovApiClient` + HMRC pattern | single-flight + TTL buffer + 401-retry already solved |
| Rate limiting | Custom counter | `GovApiRateLimiter` (Upstash sliding window) | fail-open + Redis-failure throttling already correct |
| Address-result caching | Ad-hoc map | Upstash Redis keyed by `sha256(raw address)` | survives restarts; shared across pods; respects 60/hr |
| i18n key-parity check | A new script | extend `run-guard.ts` | baseline-diff + flatten already implemented |
| PII log redaction | Manual scrubbing | `PII_MASK_PATHS` (pino redact) | wildcard dotted-path engine already in place |

**Key insight:** Every "hard" part of this phase already exists for a sibling country/data-type. The phase's real work is *wiring*, not *inventing* — and the highest-risk inventions (SSN crypto, RBAC perm) have exact in-tree mirrors.

## Runtime State Inventory

> Phase 84 is **additive** (new columns, new validators, new component, new locale) — not a rename/refactor. Still, the encrypted-column + new-locale + new-permission additions have runtime-state implications worth enumerating.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing US contractor rows carry SSN/EIN (US region just shipped Phase 83; `countryFieldsSchemaMap` has no `US` yet). No backfill/migration of existing data needed. | Code-write path only (new columns default NULL). |
| Live service config | USPS credentials live in env/secret-store, NOT git. LOCAL-ONLY: no live creds — design optional-env + fail-open so absence yields `unverified`, never a crash. | Optional-env declaration; non-blocking path. |
| OS-registered state | None — no scheduler/cron registration changes (USPS validate is request-time, not a cron). | None — verified: no new cron in this phase (USPS is on-save, advisory). |
| Secrets/env vars | NEW `SSN_ENCRYPTION_KEY` (hex-32, required-in-schema like `BANK_ACCOUNT_ENCRYPTION_KEY`); NEW optional `USPS_CLIENT_ID`/`USPS_CLIENT_SECRET` (or secret-store paths). Reading code (`getServerEnv().SSN_ENCRYPTION_KEY`) throws if unset → must add to `.env.example` + both env schemas + dev key. | Add to `env.ts`, `minimal-server-env.ts`, `.env.example`; generate a dev key. |
| Build artifacts | Adding `'en-US'` to `localeLoaders` adds a new dynamic-import chunk (`en-US.json`); the on-demand bundle loader picks it up automatically. No stale artifact. | None beyond creating `en-US.json`. |

**The canonical question:** *After every file is updated, what runtime systems still have stale state?* → Only the **env schema**: if `SSN_ENCRYPTION_KEY` is not added to `.env.example` + a dev value provided, the API will throw on first SSN write. This is the one runtime-state gotcha; everything else is additive-NULL-safe.

## Common Pitfalls

### Pitfall 1: Wrong role names (CONTEXT hint is stale)
**What goes wrong:** CONTEXT says "owner + admin + finance/accountant; NOT manager/member/viewer/it_admin" and "8 roles". The codebase has **10 roles** and no `manager`/`member`/`viewer`.
**Why it happens:** CONTEXT used generic role names, not the in-tree set.
**How to avoid:** Grant `contractorPii:['read']` to exactly `owner, admin, finance_admin` (**D-09 — `external_accountant` is EXCLUDED**, a deliberate liability/data-minimization call). Deny is implicit for `external_accountant, ops_manager, team_manager, legal_compliance_viewer, it_admin, readonly, platform_operator`. Add a permission-matrix test asserting all 10.
**Warning signs:** A plan referencing a `manager` or `viewer` role — those don't exist.

### Pitfall 2: `allPermissions` duplication in roles.ts (owner drift)
**What goes wrong:** `owner` is built from a local `allPermissions` const in `roles.ts` (lines 18-38) that DUPLICATES `accessControlStatement`. Adding `contractorPii` to `permissions.ts` but forgetting `allPermissions` means owner silently lacks the new permission.
**Why it happens:** Two parallel sources of truth (comment in permissions.ts even notes the `admin:boe-rate` exception).
**How to avoid:** Edit BOTH `accessControlStatement` (permissions.ts) AND `allPermissions` (roles.ts) for owner, plus the per-role grants.
**Warning signs:** An owner-role test for `contractorPii:read` failing while admin passes.

### Pitfall 3: `getCountryFields` returns the whole `countryFields` JSONB
**What goes wrong:** `contractor.getCountryFields` returns `contractor.countryFields ?? {}` wholesale. If SSN were in JSONB it would leak unmasked to every `contractor:read` caller, bypassing the reveal gate.
**Why it happens:** The JSONB blob is designed for plain, low-sensitivity IDs.
**How to avoid:** Keep SSN in dedicated columns; never `select` `ssnEncrypted` in the normal read path; expose only `ssnLast4`. Reveal is a separate, permission-gated, audit-logged procedure.
**Warning signs:** `ssnEncrypted` appearing in any `select` outside the reveal procedure.

### Pitfall 4: USPS per-credential 60/hr cap (global, not per-org)
**What goes wrong:** Copying HMRC's `checkLimit(orgId)` lets each org consume 60/hr → real USPS cap blown, 429s.
**How to avoid:** Fixed global rate-limit identifier; address-result cache to amortize. Treat 429/throttle as advisory `unverified` (D-03).
**Warning signs:** USPS 429s in logs under multi-org load.

### Pitfall 5: en-US added to strict parity peers → CI red
**What goes wrong:** Adding `'en-US'` to `peers: ['de','pl','ar']` makes the guard demand full key parity from a thin-override file → immediate failure.
**How to avoid:** Fallback-aware mode (key covered if in en-US OR en). Add tests for both: a divergent key present only in en-US passes; a key only in en passes for en-US; a key missing from a real peer (de) still fails.
**Warning signs:** Parity gate failing with `en-US` missing hundreds of keys.

### Pitfall 6: SSN reveal exposed on the portal
**What goes wrong:** The portal already reveals bank account to the contractor. Mirroring that for SSN would let a contractor reveal their own (or worse) SSN outside staff RBAC.
**How to avoid:** Reveal lives ONLY on the staff `contractor` router behind `contractorPii:read`. Never add to `portalAppRouter`.
**Warning signs:** A `revealSsn` procedure in any `routers/portal/*` file.

## Code Examples

### EIN validator (mirror uk-validators.ts structure)
```typescript
// Source pattern: packages/validators/src/uk-validators.ts (isValidUtr)
// IRS valid prefixes [CITED: irs.gov/.../valid-ein-prefixes] — annotate legal-deferred.
const VALID_EIN_PREFIXES = new Set([
  '01','02','03','04','05','06','10','11','12','13','14','15','16','20','21','22','23','24','25','26','27',
  '30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','50','51',
  '52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','71','72','73','74',
  '75','76','77','80','81','82','83','84','85','86','87','88','90','91','92','93','94','95','98','99',
]); // [CITED] — see Assumptions A1; legal/tax-adviser verification deferred (LOCAL-ONLY).
export function isValidEin(raw: string): boolean {
  const m = raw.replace(/\s/g, '').match(/^(\d{2})-?(\d{7})$/);
  if (!m) return false;
  return VALID_EIN_PREFIXES.has(m[1]!);
}
```

### SSN validator (format + invalid ranges)
```typescript
// SSA invalid ranges [CITED: ssa.gov randomization FAQ]:
//   area 000, 666, 900-999 invalid; group 00 invalid; serial 0000 invalid.
export function isValidSsn(raw: string): boolean {
  const m = raw.replace(/[\s-]/g, '').match(/^(\d{3})(\d{2})(\d{4})$/);
  if (!m) return false;
  const [, area, group, serial] = m;
  const a = Number(area);
  if (a === 0 || a === 666 || a >= 900) return false; // 000 / 666 / 900-999
  if (group === '00') return false;
  if (serial === '0000') return false;
  return true;
}
```

### usCountryFieldsSchema (slot into countryFields.ts)
```typescript
// Source pattern: packages/validators/src/country-fields.ts (ukCountryFieldsSchema)
export const usEntityTypeEnum = z.enum([
  'SOLE_PROPRIETOR','LLC','C_CORP','S_CORP','PARTNERSHIP','INDIVIDUAL', // planner confirms enum w/ UI-SPEC
]);
export const usCountryFieldsSchema = z.object({
  entityType: usEntityTypeEnum,
  ein: z.string().refine(v => !v || isValidEin(v), 'Invalid EIN').optional(),
  // SSN is NOT in this JSONB schema — it has dedicated encrypted columns + its own input validator.
  addressLine1: z.string().optional(), city: z.string().optional(),
  state: z.string().length(2).optional(), zipCode: z.string().optional(),
  uspsVerified: z.boolean().optional(),
});
// add to countryFieldsSchemaMap: US: usCountryFieldsSchema
```

### SSN reveal procedure (staff router, audit-logged)
```typescript
// Source pattern: packages/api/src/routers/core/contractor.ts (writeAuditLog usage)
revealSsn: tenantProcedure
  .use(requirePermission({ contractorPii: ['read'] }))
  .input(z.object({ contractorId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const c = await ctx.db.contractor.findUnique({
      where: { id: input.contractorId, organizationId: ctx.organizationId },
      select: { id: true, ssnEncrypted: true },
    });
    if (!c?.ssnEncrypted) throw new TRPCError({ code: 'NOT_FOUND' });
    const ssn = decryptSsn(c.ssnEncrypted);
    await writeAuditLog({
      organizationId: ctx.organizationId, actorType: 'USER', actorId: ctx.session.user.id,
      action: 'contractor.ssn.revealed', resourceType: 'CONTRACTOR', resourceId: c.id,
      metadata: { field: 'ssn' }, // never put the SSN in the audit row
    });
    return { ssn };
  }),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| USPS Web Tools (XML, `Verify` action, 6000/min) | USPS v3 REST + OAuth2, **60 req/hr default** | 2026 (Web Tools deprecated; rate cap tightened) | MUST design for 60/hr + cache from day one `[CITED: usps.com onboarding 6.0 / smarty / revaddress]` |
| SSN area number geographic significance | Randomized assignment (no geo meaning) | 2011-06-25 SSA randomization | Validation is range-exclusion only (000/666/900-999, group 00, serial 0000); no geographic table `[CITED: ssa.gov]` |
| IRS FIRE e-file | IRIS XML A2A | FIRE decommissions 2026-12-31 | Not this phase (Phase 86), but confirms the v7.0 US-tax timeline is current |

**Deprecated/outdated:**
- USPS Web Tools XML API — replaced by v3 REST; do not target the old `secure.shippingapis.com` host. Use `apis.usps.com`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The IRS valid-EIN-prefix set above (from irs.gov campus list) | Code Examples / US-FIELD-01 | A retired prefix wrongly accepted, or a valid one rejected. **LOW risk, legal-deferred** — D-05 explicitly annotates IRS-prefix accuracy as tax-adviser-deferred; LOCAL-ONLY. Planner should store as a table with a `[needs legal/tax-adviser verification]` comment. `[ASSUMED]` exact completeness (CITED source lists by-campus but not a single canonical "invalid" set; cross-source lists vary slightly on a few prefixes e.g. 07/08/09/17-19/28/29/49/69/70/78/79/89/96/97 reported invalid by a secondary source). |
| A2 | USPS `GET /addresses/v3/address` query params (`streetAddress`, `secondaryAddress`, `city`, `state`, `ZIPCode`, `ZIPPlus4`) and response `additionalInfo` fields (`DPVConfirmation`, `business`, `vacant`, `centralDeliveryPoint`) | Pattern 3 / US-FIELD-03 | Field-name mismatch → adapter parse fails. Mitigated by Zod `safeParse` boundary (fails loud, not silent). Planner should fetch the official OpenAPI (`developers.usps.com/api/81`) at plan time to lock exact names. `[ASSUMED]` exact field spelling; `[CITED]` endpoint paths + host + OAuth path. |
| A3 | USPS OAuth token lifetime ~8h and scope string for addresses | Pattern 3 | Over-long cache TTL → 401s (handled by single-flight refresh-on-401). LOW risk. `[CITED: revaddress]` 8h; scope `[ASSUMED]` (`addresses` likely). |
| A4 | US entity-type enum values | Code Examples | Wrong enum → UI dropdown mismatch. Planner derives final set from UI-SPEC + W-9 entity types (Phase 85 W-9 wizard will need consistency). `[ASSUMED]` — confirm in plan. |
| A5 | `SSN_ENCRYPTION_KEY` as a NEW separate env key (vs reusing `BANK_ACCOUNT_ENCRYPTION_KEY`) | Standard Stack / Alternatives | Key-reuse couples blast radius; recommend separate. This is a design recommendation, not a discovered fact. `[ASSUMED]` best-practice. |

**If this table looks long:** A1/A2 are the load-bearing ones and both are explicitly legal/spec-deferred by the phase posture — they do NOT block planning, only require a plan-time confirmation step + legal annotation.

## Open Questions (RESOLVED)

1. **Exact USPS response field names + the normalized-address mapping back to our columns.**
   - **RESOLVED:** planner fetches the official OpenAPI at `developers.usps.com/api/81` (use the JSON spec link) and pins the Zod schema at implementation time; the adapter's `safeParse` makes any drift fail-loud in the adapter test, not production.

2. **Is `external_accountant` in-scope for `contractorPii:read`?**
   - **RESOLVED (D-09):** NO. Grant `contractorPii:read` to `owner + admin + finance_admin` only; `external_accountant` is DENIED (external-party full-SSN access is a liability + data-minimization concern; external accountants work from last-4 + the generated 1099). Can be revisited if Phase 86 surfaces a hard need.

3. **EIN entity-type conditional requirements.**
   - What we know: UK/DE schemas make IDs conditionally required by entity type via `superRefine`.
   - What's unclear: which US entity types require EIN vs SSN (e.g. sole proprietor may use SSN; LLC/Corp need EIN).
   - Recommendation: planner derives the matrix from the UI-SPEC field-order + W-9 logic; `superRefine` mirrors the uk pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@upstash/ratelimit` | USPS throttle | ✓ | `^2.0.8` (`packages/gov-api`, `packages/api`) | — |
| `@upstash/redis` | USPS throttle + address cache | ✓ | `^1.38.0` | In-memory fallback exists: `GovApiRateLimiter` fails-open when `UPSTASH_REDIS_REST_URL`/`_TOKEN` unset (allows all) |
| `vitest` | all unit tests | ✓ | `^4.1.5` | — |
| `node:crypto` | SSN AES-256-GCM | ✓ | stdlib | — |
| USPS API credentials | live CASS validation | ✗ (LOCAL-ONLY) | — | **Fail-open by design** — absent creds → `unverified` flag, no crash (D-03); USPS client gated by optional env |
| `UPSTASH_REDIS_REST_URL`/`_TOKEN` | live throttle enforcement | likely ✗ locally | — | Rate-limiter no-ops (allows all) locally — fine for dev; prod sets them |

**Missing dependencies with no fallback:** None block execution.
**Missing dependencies with fallback:** USPS creds (→ unverified), Upstash creds (→ limiter no-op). Both are LOCAL-ONLY-acceptable; the design is explicitly non-blocking.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.5` (uniform across `validators`, `api`, `gov-api`, `web-vite`) |
| Config file | Per-package (each `package.json` `"test": "vitest run"`) |
| Quick run command | `pnpm --filter <pkg> test <path>` (scoped — NEVER the unscoped web-vite suite per RAM constraint) |
| Full suite command | `pnpm --filter @contractor-ops/validators test` etc. (scoped per package) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| US-FIELD-01 | EIN format + IRS prefix accept/reject | unit | `pnpm --filter @contractor-ops/validators test src/__tests__/us-validators.test.ts` | ❌ Wave 0 |
| US-FIELD-01 | `usCountryFieldsSchema` parse (EIN conditional) | unit | `pnpm --filter @contractor-ops/validators test src/__tests__/country-fields.test.ts` | ⚠️ extend existing |
| US-FIELD-02 | SSN format + invalid-range (000/666/900-999/group00/serial0000) | unit | `pnpm --filter @contractor-ops/validators test src/__tests__/us-validators.test.ts` | ❌ Wave 0 |
| US-FIELD-02 | `encryptSsn`/`decryptSsn` round-trip + `ssnLast4` derivation | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/ssn-crypto.test.ts` | ❌ Wave 0 |
| US-FIELD-02 | `revealSsn` requires `contractorPii:read` → FORBIDDEN otherwise; writes audit row | unit (mocked ctx) | `pnpm --filter @contractor-ops/api test src/routers/core/__tests__/contractor-reveal-ssn.test.ts` | ❌ Wave 0 |
| US-FIELD-02 | role→`contractorPii:read` matrix (10 roles; only owner/admin/finance_admin (D-09: external_accountant DENIED) grant) | unit | `pnpm --filter @contractor-ops/auth test` (mirror existing access-control test) | ⚠️ extend existing access-control test |
| US-FIELD-02 | `*.ssn`/`*.ein` redacted by pino | unit | `pnpm --filter @contractor-ops/logger test` | ⚠️ extend pii-mask test |
| US-FIELD-03 | USPS adapter: token cache, 60/hr self-throttle → unverified, Redis-down → fail-open, address-cache hit, schema `safeParse` | unit (mocked fetch + Redis) | `pnpm --filter @contractor-ops/gov-api test src/clients/__tests__/usps-client.test.ts` | ❌ Wave 0 |
| US-FIELD-04 | `CountryFieldsDispatch` renders `UsComplianceFields` for `countryCode==='US'` | component (jsdom) | `pnpm --filter @contractor-ops/web-vite test src/components/contractors/__tests__/country-compliance-us.test.tsx` | ❌ Wave 0 — **scoped path only** |
| US-FIELD-04 | SSN masked-reveal states: reveal absent without perm; revealed after click; loading/error | component | `pnpm --filter @contractor-ops/web-vite test src/components/contractors/compliance/__tests__/ssn-masked-reveal.test.tsx` | ❌ Wave 0 — **scoped** |
| US-LOC-01 | en-US fallback-parity: divergent key in en-US OK; en-only key covered for en-US; missing peer key still fails | unit | `pnpm --filter @contractor-ops/lint-guards test src/i18n-parity/__tests__/run-guard.test.ts` | ⚠️ extend existing guard test |
| US-LOC-01 | `en-US` registered (`SUPPORTED_LOCALES`/`localeMeta`/loader); `Intl` en-US MM/DD/YYYY + `$` | unit | `pnpm --filter @contractor-ops/web-vite test src/i18n/__tests__/messages.test.ts` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** the single scoped file command for the task's package (e.g. `pnpm --filter @contractor-ops/validators test src/__tests__/us-validators.test.ts`).
- **Per wave merge:** scoped per-package suite for each touched package (`validators`, `api`, `gov-api`, `auth`, `logger`, `lint-guards`); for web-vite, **scoped paths only** — `pnpm --filter @contractor-ops/web-vite test src/components/contractors/` (NEVER unscoped — RAM constraint, MEMORY.md).
- **Phase gate:** the relevant scoped suites green + `pnpm i18n:parity` + `pnpm check:web-vite-data-layer` + `pnpm lint:audit-log` + `pnpm lint:logs` before `/gsd:verify-work`.

### Component-test feasibility vs manual-UAT
- **Feasible (jsdom component tests):** dispatch-renders-US, SSN masked/reveal/absent/loading/error states, USPS pill variant mapping, EIN/SSN inline FieldError. These are pure-render + interaction; mock the tRPC hook.
- **Manual-UAT (not automated):** real USPS round-trip against live creds (LOCAL-ONLY has none); the visual polish + WCAG contrast review (frontend-design checker); the locale-switcher visual + RTL-non-regression smoke; cross-pod Redis throttle behavior under real load.

### Wave 0 Gaps
- [ ] `packages/validators/src/__tests__/us-validators.test.ts` — covers US-FIELD-01/02 (EIN/SSN table-driven vectors)
- [ ] `packages/api/src/services/__tests__/ssn-crypto.test.ts` — covers US-FIELD-02 crypto round-trip
- [ ] `packages/api/src/routers/core/__tests__/contractor-reveal-ssn.test.ts` — covers US-FIELD-02 RBAC + audit
- [ ] `packages/gov-api/src/clients/__tests__/usps-client.test.ts` + `schemas/usps-address.schema.ts` — covers US-FIELD-03
- [ ] `apps/web-vite/src/components/contractors/__tests__/country-compliance-us.test.tsx` + `compliance/__tests__/ssn-masked-reveal.test.tsx` — covers US-FIELD-04
- [ ] Extend: `packages/auth` access-control test (10-role matrix), `packages/logger` pii-mask test, `packages/lint-guards` run-guard test (fallback mode), `packages/validators` country-fields test, web-vite i18n messages test
- [ ] Framework install: none — Vitest present in every target package

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth flow (uses existing Better Auth session) |
| V3 Session Management | no | Existing session; `requirePermission` re-reads role live |
| V4 Access Control | **yes** | New `contractorPii:read` permission; `requirePermission` middleware; deny-by-default (only 4 of 10 roles); reveal gated + audit-logged; SSN never in normal read path |
| V5 Input Validation | **yes** | Zod `usCountryFieldsSchema` + `isValidEin`/`isValidSsn` at tRPC boundary + USPS `safeParse`; `.length(2)` on state |
| V6 Cryptography | **yes** | AES-256-GCM (`node:crypto`) via mirror of `bank-account-crypto.ts`; dedicated `SSN_ENCRYPTION_KEY` hex-32; IV per-encrypt; authTag verified on decrypt — never hand-roll |
| V7 Error/Logging | **yes** | `PII_MASK_PATHS` += ssn/ein; audit row carries `field:'ssn'` metadata but NEVER the value; `@contractor-ops/logger` not console |
| V8 Data Protection | **yes** | SSN encrypt-at-rest; last-4-only default exposure; advisory non-blocking USPS (no PII to USPS beyond the address itself) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSN exfiltration via wide read path | Information Disclosure | Dedicated encrypted column, never `select`ed outside reveal; `ssnLast4` only in normal reads |
| Privilege escalation to reveal SSN | Elevation of Privilege | `requirePermission({contractorPii:['read']})`; deny-by-default 6/10 roles; live role re-read |
| SSN in logs | Information Disclosure | `PII_MASK_PATHS` wildcard redaction (D-08) |
| Tenant enumeration via reveal/USPS | Spoofing/IDOR | `organizationId: ctx.organizationId` scoping → cross-tenant = NOT_FOUND (existing pattern) |
| USPS quota DoS / cap blowout | Denial of Service | global (not per-org) sliding-window limiter + fail-open advisory |
| Unaudited PII access | Repudiation | `writeAuditLog` on every reveal (append-only AuditLog) |
| Encryption key reuse blast radius | Tampering/Info Disclosure | Separate `SSN_ENCRYPTION_KEY` (not shared with bank key) |

## Project Constraints (from CLAUDE.md)

- **Zod at all boundaries** — tRPC inputs, USPS response, env schema. No unsafe `as` on USPS payload (use `safeParse`).
- **`@contractor-ops/logger`, never `console.*`** — gov-api/api/auth all use `createLogger`.
- **`writeAuditLog` on sensitive mutations** — SSN reveal qualifies (D-01/D-02).
- **No hardcoded user-facing strings; i18n parity en/de/pl/ar + en-US** — all new copy via `useTranslations`; run `pnpm i18n:parity`.
- **`frontend-design` skill MANDATORY before web-vite UI edits** — Read `SKILL.md` + `semble search` before component work (UI-SPEC is the approved contract).
- **web-vite container/hooks data-layer** — page=thin, container=domain hooks, hook=only tRPC boundary, component=presentational; run `pnpm check:web-vite-data-layer`. (Verified: `country-compliance-section-container.tsx` → `use-country-compliance.ts` → view.)
- **Dialog body/footer convention** — UI-SPEC confirms **no dialogs** this phase (reveal needs no confirmation dialog); convention N/A.
- **Prisma enum `UPPER_SNAKE_CASE`** (`db:audit-enum-casing`) — if a US entity-type enum lands in Prisma; in `country-fields.ts` it's a Zod enum (string), so casing is the planner's call (uk/de use UPPER_SNAKE).
- **7-day dep release age** — N/A (no new deps).
- **Tenant from session** — `ctx.organizationId`, never client input.
- **`.planning/phases` symlink** — commit planning docs via real `.planning/milestones/v7.0-phases/` path.
- **Pre-existing Prisma drift** — additive nullable columns via `db push`/direct ALTER, NOT `prisma migrate dev`; per-region prod apply deferred (Phase 82/83 posture).
- **LOCAL-ONLY + legal-deferred** — IRS-prefix/SSN-range tables + US copy annotated "needs jurisdiction legal/tax adviser verification before production"; non-blocking.

## Sources

### Primary (HIGH confidence — read in-tree this session)
- `packages/api/src/services/bank-account-crypto.ts` — AES-256-GCM single-string column crypto (SSN mirror)
- `packages/integrations/src/services/credential-service.ts` — alt AES helper (JSON-blob; rejected for SSN)
- `packages/api/src/middleware/rbac.ts` — `requirePermission` (Better Auth `hasPermission` + apiKey scopes)
- `packages/auth/src/permissions.ts` — `accessControlStatement` (where `contractorPii:['read']` registers)
- `packages/auth/src/roles.ts` — the **10 roles** + `allPermissions` owner-duplication gotcha
- `packages/auth/src/config.ts` — role registration; live role re-read note (line 278)
- `packages/validators/src/country-fields.ts` + `uk-validators.ts` — validator + schema-map pattern
- `packages/logger/src/pii-mask.ts` — `PII_MASK_PATHS` (D-08 target)
- `packages/api/src/routers/core/contractor.ts` — `getCountryFieldsConfig`/`getCountryFields`/`updateCountryFields`; `encryptBankAccount`+`****last4`+`writeAuditLog` precedent (lines 270-271, 733, 849, 1037)
- `packages/api/src/services/audit-writer.ts` — `writeAuditLog` signature (`action`/`resourceType`/`resourceId`/`metadata`/`tx`)
- `packages/gov-api/src/rate-limiter.ts` — `GovApiRateLimiter` (Upstash sliding-window, fail-open)
- `packages/gov-api/src/clients/hmrc-vat-client.ts` — OAuth2 client-credentials + token cache + single-flight + Zod boundary (USPS template)
- `apps/web-vite/src/components/contractors/country-compliance-section.tsx` + `-container.tsx` + `compliance/uk-compliance-fields.tsx` + `entity-type-select.tsx` + `vat-validation-status-pill.tsx` + `hooks/use-country-compliance.ts`
- `apps/web-vite/src/i18n/index.ts` + `messages.ts` + `apps/web-vite/messages/en.json` (`Contractors.compliance.{uk,de}` @1571, `countryCompliance.countries` @1632)
- `scripts/i18n-parity.mjs` + `packages/lint-guards/src/i18n-parity/run-guard.ts` — parity mechanics
- `packages/db/prisma/schema/contractor.prisma` — `Contractor.countryFields` JSONB + `ContractorBillingProfile.{bankAccount,ukSortCode,ukAccountNumber}Encrypted/Masked` precedent
- `packages/validators/src/env.ts` (`hex32`, `BANK_ACCOUNT_ENCRYPTION_KEY` @184) + `minimal-server-env.ts` (HEX32 @55)
- `package.json` deps (`@upstash/ratelimit@^2.0.8`, `@upstash/redis@^1.38.0`, `vitest@^4.1.5`)

### Secondary (MEDIUM-HIGH — official/authoritative external)
- [IRS — How EINs are Assigned and Valid EIN Prefixes](https://www.irs.gov/businesses/small-businesses-self-employed/how-eins-are-assigned-and-valid-ein-prefixes) — valid prefix list by campus
- [SSA — SSN Randomization FAQ](https://www.ssa.gov/employer/randomizationfaqs.html) + [Randomization](https://www.ssa.gov/employer/randomization.html) — invalid ranges (000/666/900-999, group 00, serial 0000)
- [USPS Developer Portal — OAuth 2.0](https://developers.usps.com/Oauth) + [Addresses 3.0](https://developers.usps.com/addressesv3) — endpoint host/paths (JS-rendered; OpenAPI at `developers.usps.com/api/81`)
- [USPS APIs Onboarding Guide v6.0 (2026)](https://www.usps.com/business/web-tools-apis/onboarding-guide.pdf) — v3 migration + rate posture

### Tertiary (LOW-MEDIUM — community, cross-verified for endpoint/rate facts)
- [RevAddress — USPS Web Tools → v3 Endpoint Mapping](https://revaddress.com/blog/usps-web-tools-endpoint-mapping/) — `apis.usps.com`, `/oauth2/v3/token`, `/addresses/v3/address`
- [Smarty — USPS 60 req/hr cap](https://www.smarty.com/blog/usps-api-rate-limit) + [RevAddress rate-limits 2026](https://revaddress.com/blog/usps-api-rate-limits-2026-what-changed/) — 60/hr confirmation
- [usps-v3 PyPI](https://pypi.org/project/usps-v3/) — SDK method signature (param names)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified in `package.json`; no new installs
- Architecture / anchors: HIGH — all 4 unknowns resolved by reading the actual files; every CONTEXT anchor verified (one corrected: role names/count)
- Pitfalls: HIGH — derived from reading the exact code paths (owner `allPermissions` dup, JSONB leak, portal-reveal, global-vs-per-org limiter)
- External facts (IRS/SSN/USPS): MEDIUM — CITED to authoritative sources but legal/tax-adviser-deferred by phase posture; USPS exact field names flagged for plan-time OpenAPI fetch

**Anchor corrections flagged:**
- CONTEXT "8 roles" + names `manager/member/viewer` → **WRONG**: 10 roles; correct names listed above. D-02 grant = `owner/admin/finance_admin (D-09: external_accountant DENIED)`.
- D-01 hint "credential-store pattern" → **better mirror is `bank-account-crypto.ts`** (single string + single key + masked-column precedent), not `credential-service.ts` (JSON blob).
- "country-compliance config gating `hasCountryFields`/`countryCode`" → it is **server-side** (`contractor.getCountryFieldsConfig`, org-country gated via `countryFieldsSchemaMap`), not a client config. Registering `'US'` = adding `US` to `countryFieldsSchemaMap` (validators) AND the `fields` list in the server procedure AND the client `CountryFieldsDispatch` switch + `COUNTRY_LABELS`.
- The `i18n:parity` gate (`scripts/i18n-parity.mjs` → `run-guard.ts`) uses `base:'en', peers:['de','pl','ar']`; en-US fallback-parity = a new fallback-aware peer mode, NOT adding en-US to the strict peers array.

**Research date:** 2026-06-08
**Valid until:** ~2026-07-08 (stable in-tree patterns; USPS rate/endpoint facts are 2026-current — re-verify USPS OpenAPI field names at plan-time)

## RESEARCH COMPLETE
