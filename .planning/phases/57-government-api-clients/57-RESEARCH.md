# Phase 57: Government API Clients - Research

**Researched:** 2026-04-12
**Domain:** Government tax-ID validation (HMRC UK VAT + EU VIES) + multi-country VAT rate application with Kleinunternehmer + reverse-charge auto-detection
**Confidence:** HIGH (on stack + patterns), MEDIUM (on HMRC fraud-prevention header applicability), LOW (on VIES REST API production stability — STATE.md blocker)

## Summary

Phase 57 extends the Phase 54 `GovApiClient` abstract base with two new subclasses — `HmrcVatClient` (OAuth 2.0 client-credentials, bearer-token auth against `api.service.hmrc.gov.uk`) and `ViesClient` (unauthenticated REST GET against `ec.europa.eu/taxation_customs/vies/rest-api`) — persists every call into a new append-only `TaxIdValidation` Prisma model, denormalizes `latestVatValidatedAt` + `latestVatValidationStatus` onto `Contractor`, seeds GB/DE VAT rates into the existing `TaxRate` table, adds an `isKleinunternehmer` flag to `Organization`, extends the existing `reverse-charge.service.ts` with post-Brexit + §13b rule paths, and adds locked legal phrases (`TAX_KLEINUNTERNEHMER_NOTICE`, `TAX_UK_REVERSE_CHARGE_NOTICE`, `TAX_STEUERSCHULDNERSCHAFT`) that the Phase 61/62 invoice documents will render.

All 14 user decisions (D-01..D-14) are locked — research is prescriptive, not exploratory. The highest-risk area is HMRC fraud-prevention headers: the official OpenAPI spec for `vat-registered-companies-api` v2.0 does NOT list them as required, but the HMRC Fraud Prevention guide says headers are "required by law for the VAT (MTD) and Income Tax Self Assessment (MTD) APIs" — the Check-a-VAT-Number endpoint is explicitly NOT part of MTD. The planner should send best-effort `Gov-Client-*` headers anyway (defense in depth, free insurance) but not block the phase if headers validation is ambiguous.

**Primary recommendation:** Follow the ZATCA precedent verbatim — two subclasses of `GovApiClient`, each injecting a `GovApiAuditLogger` AND a new `TaxIdValidationLogger` via `emitAuditEntry` override; Zod-validated response schemas at client boundary; local Phase 56 format-checksum as pre-flight short-circuit before any network call; soft-fail/stale-return on API outage per D-08.

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Credentials & Environment Model
- **D-01:** HMRC VAT API uses **platform-wide OAuth 2.0 client credentials** stored in SecretStore (single Contractor Ops HMRC app). All tenants share the client app; per-request HMRC fraud-prevention headers carry tenant identifying info. Matches existing ZATCA/Peppol pattern.
- **D-02:** VIES USt-IdNr validation uses the **REST API** (unauthenticated, `ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{number}`). Supports both simple and qualified confirmations via `requesterMemberStateCode` + `requesterNumber` query params. No SOAP fallback in this phase.
- **D-03:** Environment switching via `HMRC_ENV` + `VIES_ENV` env variables driving base URL selection (`sandbox` | `production`). Matches existing `GovApiClient.environment` field from Phase 54.

#### Validation Storage & Freshness
- **D-04:** New `TaxIdValidation` Prisma model — append-only audit table. Columns: `id`, `organizationId`, `contractorId`, `taxIdType` (`'GB_VAT'|'DE_USTIDNR'`), `taxIdValue`, `apiProvider`, `requestedAt`, `validFrom`, `validTo`, `confirmationRef`, `responseStatus` (`'valid'|'invalid'|'stale'|'unavailable'`), `responseBody` (JSONB).
- **D-05:** Contractor row carries denormalized `latestVatValidatedAt` + `latestVatValidationStatus`. Source of truth remains `TaxIdValidation`; the cache is updated on every new validation row.
- **D-06:** **90-day freshness window.** Validation is "fresh" if `responseStatus='valid'` AND `validatedAt > now - 90d`.
- **D-07:** **Three re-validation triggers:** (1) contractor profile save with a new/changed VAT number; (2) invoice line creation if stale; (3) explicit 'Revalidate' button. Periodic background refresh is deferred.
- **D-08:** **Graceful degradation via soft-fail with stale flag.** Never hard-block invoices on API outage.

#### UK/DE VAT Rate Seeding & Default Application
- **D-09:** Single seed extension in `packages/db/prisma/seed/tax-rates.ts`:
  - GB: `'20'` (20%, default), `'5'` (5%), `'0'` (0%), `'RC'` (reverse-charge 0%)
  - DE: `'19'` (19%, default), `'7'` (7%), `'RC'` (reverse-charge 0%), `'KU'` (Kleinunternehmer 0% exempt)
- **D-10:** Invoice line creation pre-selects `isDefault: true` TaxRate for org's country. User overrides via per-line dropdown.
- **D-11:** `isKleinunternehmer: boolean` on `Organization` (default `false`). When `true` AND `countryCode='DE'`: all invoice lines use `'KU'` (0%) and footer renders locked phrase `TAX_KLEINUNTERNEHMER_NOTICE` = "Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen".

#### Reverse-Charge Auto-Detection Rules
- **D-12:** Three auto-detect paths: (1) Post-Brexit UK↔EU B2B; (2) Intra-EU B2B different member states; (3) DE §13b UStG domestic (construction, cleaning, scrap metals, gold, mobile phones).
- **D-13:** Auto-flag displays toggle; if user disables, a free-text "Why not?" reason is logged to audit trail.
- **D-14:** **Reverse-charge label placement: line + footer.** DE: `TAX_STEUERSCHULDNERSCHAFT`; UK: `TAX_UK_REVERSE_CHARGE_NOTICE` = "Reverse charge: Customer to pay the VAT to HMRC".

### Claude's Discretion
- HMRC OAuth 2.0 client registration (one-time setup; dev/ops owns)
- Exact HMRC fraud-prevention headers (`Gov-Client-*`) composition
- VIES `requesterNumber` source (platform default VAT ID vs per-org) — **recommendation in this research**
- Rate limiting tuning per endpoint — **recommendation in this research**
- `TaxIdValidation` index strategy — **recommendation in this research**
- Stale result TTL for the profile summary cache — **recommendation in this research**
- §13b serviceType enum encoding — **recommendation in this research**
- UI copy for the override reason prompt
- Background retry strategy for failed validations

### Deferred Ideas (OUT OF SCOPE)
- Periodic background revalidation (nightly cron)
- HMRC Making Tax Digital (MTD) submission
- VIES SOAP fallback
- Automatic Kleinunternehmer detection from turnover
- Per-org HMRC credentials override
- Direct HMRC MTD / BMF e-invoice sending
- §13b rule-list expansion beyond initial 5 service types
- Storage of HMRC-registered company name for display

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-02 | Apply UK VAT rates (20% / 5% / 0%) to invoices for UK-based organizations | D-09 seed extension + D-10 default selection + Standard Stack TaxRate pattern (already used for PL/AE/SA) |
| PAY-03 | Validate UK VAT registration numbers via HMRC API | HmrcVatClient subclass of GovApiClient + OAuth 2.0 client-credentials + bearer token + `/organisations/vat/check-vat-number/lookup/{targetVrn}/{requesterVrn}` |
| PAY-04 | Apply German VAT rates (19% / 7%) + Kleinunternehmer + reverse-charge labeling | D-09 seed (DE) + D-11 Kleinunternehmer flag + D-12/D-14 reverse-charge rule engine + locked legal phrases |
| PAY-05 | Validate German USt-IdNr via VIES with qualified confirmation | ViesClient subclass + GET `/rest-api/ms/DE/vat/{vatNumber}?requesterMemberStateCode=DE&requesterNumber=...` + D-08 graceful degradation |

## Project Constraints (from CLAUDE.md)

- **UI/design:** `frontend-design` plugin for any UI surfaces (Phase 57 has minimal UI — a status pill + Revalidate button + Kleinunternehmer toggle); WCAG AA, keyboard nav, semantic HTML, contrast.
- **Architecture:** Turborepo monorepo; clean boundaries between `packages/gov-api`, `packages/db`, `packages/validators`, `packages/api`; SOLID + DRY; extend `GovApiClient` (inheritance), not copy-paste.
- **Libraries:** Use `ctx7` CLI for documentation gathering — done for Prisma/Zod/MSW patterns; current stable library versions only.
- **Code quality:** Strong typing (no `any`), explicit over magic, Zod schema validation at every external-API boundary and every tRPC input.
- **Validation & Data Safety:** Schema-validate HMRC + VIES response bodies with Zod at the client boundary. Never trust the API shape. Validate env vars (`HMRC_ENV`, `VIES_ENV`, SecretStore paths) at boot.
- **Security:** No secrets in source; HMRC client credentials live in SecretStore; rate-limit per org; structured logs never include raw VAT numbers in error messages (PII masking from Phase 56 Task 4); audit all external calls via `GovApiAuditLogger` + new `TaxIdValidation` table; defensive programming on HMRC/VIES outages.
- **Performance:** Cache HMRC OAuth token (TTL ~4h per HMRC spec); short-circuit invalid inputs with Phase 56 checksum before network call; 90-day freshness cache on `latestVatValidatedAt`; no overfetching — only query `TaxIdValidation` when profile card or invoice line needs it.
- **Accessibility:** Status pill needs non-color signal (icon + text); Revalidate button keyboard-focusable; stale warning tooltip has `aria-label`.
- **Environment / DX:** Update `.env.example` with `HMRC_ENV`, `VIES_ENV`, `HMRC_CLIENT_ID_SECRET_PATH`, `HMRC_CLIENT_SECRET_SECRET_PATH`, `HMRC_PLATFORM_VRN` (used as `requesterVrn` for verified lookups — satisfies D-02 "VIES requesterNumber source" discretion).
- **Observability:** Pino structured logging for HMRC/VIES; log `{apiName, endpoint, responseStatus, responseTimeMs, organizationId}`, never raw VAT numbers or Authorization headers; surface API unavailability as a typed error code (`HMRC_UNAVAILABLE`, `VIES_UNAVAILABLE`) so the UI can render the soft-fail state.
- **API & Contracts:** Zod response schemas; tRPC routers on `contractor` (validate + revalidate) + any new `taxIdValidation` query router for profile reads; no breaking changes to existing invoice router — additive fields only.
- **Database:** `TaxIdValidation` migration must be reversible; add indexes `(contractorId, taxIdType, requestedAt DESC)` for staleness lookup; prefer DB-level unique constraint on `(contractorId, confirmationRef)` to prevent duplicate rows for the same qualified confirmation.
- **Product thinking:** Handle the empty state (no validation yet — profile shows "Not validated"), the stale state (yellow pill), the unavailable state (yellow with "Last validated {rel} ago; live check unavailable"), and the invalid state (red pill with "Invalid — please review the VAT number").

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@contractor-ops/gov-api` | workspace:* | Abstract `GovApiClient` base + retry + rate limit + audit | Already proven by ZATCA + Peppol in v4.0 — inheritance is the locked pattern [VERIFIED: packages/gov-api/src/client.ts + Phase 54 D-04] |
| `@contractor-ops/secrets` | workspace:* | SecretStore for HMRC OAuth client_id/client_secret | Phase 52 infrastructure; same pattern as ZATCA certs [VERIFIED: packages/secrets/src/secret-store.ts] |
| `@contractor-ops/db` (Prisma 7.7.0) | 7.7.0 | `TaxIdValidation` model + `Contractor` + `Organization` field additions | Existing ORM [VERIFIED: packages/db/package.json] |
| `zod` | 3.25.76 | Response-body validation for HMRC + VIES | Used across einvoice profiles [VERIFIED: packages/einvoice/package.json] |
| `@upstash/ratelimit` + `@upstash/redis` | 2.0.8 / 1.37.0 | Rate-limit HMRC calls (~3 req/sec default HMRC limit) | Already used in `GovApiRateLimiter` [VERIFIED: packages/gov-api/package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `msw` | 2.13.2 | Mock HMRC + VIES HTTP in tests | Existing `packages/test-utils/msw/handlers/` pattern — add `hmrc.ts` + `vies.ts` handlers [VERIFIED: packages/test-utils/package.json] |
| `vitest` | 4.1.4 | Unit + integration tests | Monorepo standard [VERIFIED: packages/gov-api/package.json] |

### No new runtime libraries required
All HTTP is native `fetch` through the existing `GovApiClient.fetch` with retry/timeout — no `axios`, `ky`, `got`, or `node-fetch` needed. OAuth 2.0 client-credentials can be implemented in ~20 lines inside `HmrcVatClient` (POST form-encoded to `/oauth/token`, cache the access token for ~4h until expiry).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` in HmrcVatClient | `openid-client` | Adds a 200KB dependency for one flow (client-credentials grant) that is ~15 lines of code; rejected as overengineering per CLAUDE.md |
| MSW for tests | `nock` | MSW is already the project-wide standard; introducing nock would fragment test infrastructure |
| REST for VIES | SOAP WSDL | D-02 locks REST; SOAP deferred per deferred-ideas list — revisit only if REST unstable |
| Separate Prisma model per gov API | Single `TaxIdValidation` with `taxIdType` discriminator | Discriminator keeps the freshness / staleness logic unified; adding future countries = new enum value only |

**Installation:** No new package installs required. All dependencies are in-tree or already in `packages/gov-api`, `packages/db`, `packages/test-utils`.

**Version verification:** [VERIFIED via workspace package.json inspection 2026-04-12]
- `@prisma/client`: 7.7.0
- `zod`: 3.25.76
- `msw`: 2.13.2
- `@upstash/ratelimit`: 2.0.8
- `vitest`: 4.1.4

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── gov-api/src/
│   ├── client.ts                    # EXISTING — GovApiClient base
│   ├── clients/                     # NEW folder — gov-api-specific subclasses live here
│   │   ├── hmrc-vat-client.ts       # NEW — extends GovApiClient
│   │   ├── hmrc-vat-client.test.ts  # NEW — MSW-mocked tests
│   │   ├── vies-client.ts           # NEW — extends GovApiClient
│   │   └── vies-client.test.ts      # NEW — MSW-mocked tests
│   ├── schemas/                     # NEW — Zod schemas for HMRC + VIES responses
│   │   ├── hmrc-vat.schema.ts
│   │   └── vies.schema.ts
│   ├── tax-id-validation-logger.ts  # NEW — emitAuditEntry override target
│   └── index.ts                     # EXTEND — export new clients
├── db/prisma/schema/
│   ├── tax.prisma                   # EXTEND — add TaxIdValidation model
│   ├── organization.prisma          # EXTEND — add isKleinunternehmer
│   └── contractor.prisma            # EXTEND — add latestVatValidatedAt + latestVatValidationStatus
├── db/prisma/seed/tax-rates.ts      # EXTEND — append GB + DE entries
├── validators/src/
│   ├── legal/de.ts                  # EXTEND — add TAX_KLEINUNTERNEHMER_NOTICE + TAX_STEUERSCHULDNERSCHAFT
│   ├── legal/en.ts                  # NEW — mirror pattern; add TAX_UK_REVERSE_CHARGE_NOTICE
│   └── uk-validators.ts / de-validators.ts  # EXISTING — used as pre-flight short-circuit
├── api/src/
│   ├── routers/
│   │   ├── contractor.ts            # EXTEND — validateVat / revalidateVat mutations
│   │   └── invoice.ts               # EXTEND — staleness check on line creation
│   └── services/
│       ├── reverse-charge.service.ts   # EXTEND — add postBrexit + §13b rule paths
│       ├── tax-id-validation.service.ts # NEW — orchestrates HmrcVat + Vies clients
│       └── kleinunternehmer.service.ts  # NEW — per-invoice-line rate override logic
└── test-utils/src/msw/handlers/
    ├── hmrc.ts                      # NEW
    └── vies.ts                      # NEW
```

### Pattern 1: GovApiClient Subclass

**What:** Inherit retry + timeout + audit + sandbox/prod URL switching from `GovApiClient`; override `getApiName()` + add API-specific methods; inject `SecretStore` via `setSecretStore()`; override `emitAuditEntry()` to write to `TaxIdValidation` + GovApiAuditLog.

**When to use:** Any government API integration. Both HmrcVatClient and ViesClient follow this.

**Example (sketch — verified against packages/einvoice/src/profiles/zatca/api-client.ts):**

```typescript
// Source: packages/gov-api/src/client.ts (existing) + Phase 54 D-04 ZATCA pattern
import { GovApiClient, type GovApiConfig, type GovApiEnvironment } from '@contractor-ops/gov-api';
import { hmrcVatLookupResponseSchema } from '../schemas/hmrc-vat.schema.js';

export class HmrcVatClient extends GovApiClient {
  private accessToken: { value: string; expiresAt: number } | null = null;

  getApiName(): string { return 'hmrc-vat'; }

  async checkVatNumber(
    targetVrn: string,
    opts: { organizationId: string; requesterVrn?: string },
  ): Promise<HmrcVatLookupResult> {
    await this.ensureAccessToken();
    const path = opts.requesterVrn
      ? `/organisations/vat/check-vat-number/lookup/${targetVrn}/${opts.requesterVrn}`
      : `/organisations/vat/check-vat-number/lookup/${targetVrn}`;

    const response = await this.fetch(path, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.hmrc.2.0+json',
        'Authorization': `Bearer ${this.accessToken!.value}`,
        ...buildFraudPreventionHeaders(opts.organizationId),
      },
    }, { organizationId: opts.organizationId });

    if (response.status === 404) return { status: 'invalid', raw: null };
    if (!response.ok) throw new HmrcApiError(`HMRC returned ${response.status}`);

    const json = await response.json();
    return hmrcVatLookupResponseSchema.parse(json); // Zod at boundary
  }

  private async ensureAccessToken(): Promise<void> { /* client-credentials flow; 4h cache */ }
}
```

**ViesClient (unauthenticated, simpler):**

```typescript
// Source: Official VIES REST endpoint path confirmed via WebSearch 2026-04-12
// https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{MS}/vat/{VAT}
export class ViesClient extends GovApiClient {
  getApiName(): string { return 'vies'; }

  async checkVatNumber(
    countryCode: string,
    vatNumber: string,
    opts: {
      organizationId: string;
      requesterMemberStateCode?: string;  // for qualified confirmation
      requesterNumber?: string;
    },
  ): Promise<ViesLookupResult> {
    const qs = new URLSearchParams();
    if (opts.requesterMemberStateCode && opts.requesterNumber) {
      qs.set('requesterMemberStateCode', opts.requesterMemberStateCode);
      qs.set('requesterNumber', opts.requesterNumber);
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const response = await this.fetch(
      `/rest-api/ms/${countryCode}/vat/${vatNumber}${suffix}`,
      { method: 'GET' },
      { organizationId: opts.organizationId },
    );
    if (!response.ok) throw new ViesApiError(`VIES returned ${response.status}`);
    const json = await response.json();
    return viesLookupResponseSchema.parse(json);
  }
}
```

### Pattern 2: Append-Only Audit Table + Denormalized Summary

**What:** `TaxIdValidation` stores every validation (never updated, never deleted). `Contractor.latestVatValidatedAt` + `.latestVatValidationStatus` are a maintained cache for fast profile reads.

**When to use:** Compliance-sensitive data where the regulator may request history (HMRC + German BZSt both can).

**Example:**

```prisma
// Source: packages/db/prisma/schema/tax.prisma (extend) + D-04 spec
model TaxIdValidation {
  id               String              @id @default(cuid())
  organizationId   String
  contractorId     String
  taxIdType        TaxIdType           // enum: GB_VAT | DE_USTIDNR
  taxIdValue       String              @db.VarChar(20)  // normalized, e.g. "GB123456789"
  apiProvider      String              @db.VarChar(20)  // "hmrc" | "vies"
  requestedAt      DateTime            @default(now())
  validFrom        DateTime?           // when API says validity begins (HMRC-specific: not present — leave null)
  validTo          DateTime?           // when API says validity ends (not typically returned)
  confirmationRef  String?             @db.VarChar(50)  // VIES qualified consultationNumber OR HMRC consultationNumber
  responseStatus   ValidationStatus    // enum: valid | invalid | stale | unavailable
  responseBody     Json                // full normalized API response for audit evidence
  errorMessage     String?

  organization Organization @relation(fields: [organizationId], references: [id])
  contractor   Contractor   @relation(fields: [contractorId], references: [id])

  @@index([contractorId, taxIdType, requestedAt(sort: Desc)])  // freshness lookup
  @@index([organizationId, requestedAt])
  @@index([organizationId, responseStatus])                      // compliance reporting
}

enum TaxIdType { GB_VAT DE_USTIDNR }
enum ValidationStatus { valid invalid stale unavailable }
```

### Pattern 3: Local Pre-Flight Short-Circuit

**What:** Call Phase 56 checksum (`isValidGbVat` / `isValidUstIdNr`) BEFORE any network call. If format/checksum fails, return `invalid` immediately without touching HMRC/VIES. Saves latency, avoids rate-limit consumption, and catches typos offline.

**When to use:** Every tax-ID validation entry point.

**Example:**

```typescript
// Source: packages/validators/src/uk-validators.ts + de-validators.ts (Phase 56)
export async function validateTaxId(input: {
  contractorId: string;
  taxIdType: 'GB_VAT' | 'DE_USTIDNR';
  taxIdValue: string;
  organizationId: string;
}): Promise<TaxIdValidationResult> {
  // 1. Pre-flight: local checksum (Phase 56 pure function, zero I/O)
  const formatValid = input.taxIdType === 'GB_VAT'
    ? isValidGbVat(input.taxIdValue)
    : isValidUstIdNr(input.taxIdValue);
  if (!formatValid) {
    return persistAndReturn({ ...input, responseStatus: 'invalid', source: 'local-checksum' });
  }

  // 2. Network call with soft-fail on outage (D-08)
  try {
    const result = input.taxIdType === 'GB_VAT'
      ? await hmrcClient.checkVatNumber(...)
      : await viesClient.checkVatNumber(...);
    return persistAndReturn({ ...input, ...result, source: 'api' });
  } catch (err) {
    const lastValid = await findLastValidValidation(input.contractorId, input.taxIdType);
    return persistAndReturn({
      ...input,
      responseStatus: lastValid ? 'stale' : 'unavailable',
      source: 'stale-cache',
    });
  }
}
```

### Pattern 4: Reverse-Charge Rule Engine (extend existing)

**What:** Extend `packages/api/src/services/reverse-charge.service.ts` `detectReverseCharge()` with three new rule paths (D-12). Pure function — no DB access. Called from invoice line creation.

**When to use:** Every invoice line when the org country is GB or a member of EU_MEMBER_STATES.

**Example:**

```typescript
// Source: EXTEND packages/api/src/services/reverse-charge.service.ts
type RcRule =
  | 'eu_cross_border_b2b'
  | 'gb_eu_post_brexit_b2b'       // NEW — D-12.1
  | 'de_domestic_13b_ustg'         // NEW — D-12.3
  | 'not_applicable';

export function detectReverseCharge(params: {
  sellerCountry: string;
  buyerCountry: string;
  buyerHasVatId: boolean;
  isB2B: boolean;
  serviceType?: string;  // NEW — needed for §13b
}): ReverseChargeResult {
  const { sellerCountry, buyerCountry, buyerHasVatId, isB2B, serviceType } = params;
  if (!isB2B || !buyerHasVatId) return { shouldApply: false, ... };

  // D-12.1 — Post-Brexit UK↔EU B2B (both directions)
  const isUkEu = (sellerCountry === 'GB' && EU_MEMBER_STATES.has(buyerCountry))
              || (EU_MEMBER_STATES.has(sellerCountry) && buyerCountry === 'GB');
  if (isUkEu) {
    return { shouldApply: true, rule: 'gb_eu_post_brexit_b2b', reason: 'UK↔EU post-Brexit B2B reverse charge' };
  }

  // D-12.2 — Intra-EU B2B different member states (existing rule, keep)
  if (sellerCountry !== buyerCountry
      && EU_MEMBER_STATES.has(sellerCountry)
      && EU_MEMBER_STATES.has(buyerCountry)) {
    return { shouldApply: true, rule: 'eu_cross_border_b2b', ... };
  }

  // D-12.3 — DE §13b UStG domestic
  if (sellerCountry === 'DE' && buyerCountry === 'DE' && serviceType) {
    if (DE_13B_SERVICE_TYPES.has(serviceType)) {
      return { shouldApply: true, rule: 'de_domestic_13b_ustg',
               reason: `§13b UStG: ${serviceType}` };
    }
  }

  return { shouldApply: false, rule: 'not_applicable', ... };
}

// D-12.3 — initial list (expandable per deferred list)
// [CITED: vatupdate.com + stripe.com/resources reverse-charge-vat-germany]
export const DE_13B_SERVICE_TYPES = new Set([
  'CONSTRUCTION',       // § 13b Abs. 2 Nr. 4 UStG
  'CLEANING_BUILDING',  // § 13b Abs. 2 Nr. 8 UStG
  'SCRAP_METALS',       // § 13b Abs. 2 Nr. 7 UStG (Annex 3)
  'GOLD',               // § 13b Abs. 2 Nr. 9 UStG
  'MOBILE_PHONES',      // § 13b Abs. 2 Nr. 10 UStG (electronic goods)
]);
```

**Recommendation (discretion from CONTEXT.md):** Use `string enum` (TypeScript-level `DE_13B_SERVICE_TYPES` set + invoice-line `serviceType` column) rather than a foreign key to a `ServiceType` table. Phase 57 needs only 5 values; a lookup table adds schema complexity without migration benefit.

### Anti-Patterns to Avoid

- **Hand-rolling OAuth 2.0 token caching per request:** Cache at client-instance level; refresh 5 min before expiry.
- **Updating `TaxIdValidation` rows in place:** The table is append-only; D-04 is explicit. Add a new row for every validation.
- **Skipping Zod parsing on VIES response:** The EU REST endpoint has had undocumented shape changes — validate with Zod or you'll get cryptic TypeError at runtime.
- **Hard-blocking invoices on HMRC/VIES outage:** D-08 — soft-fail with stale flag. Invoices must still ship.
- **Logging raw VAT numbers in error messages:** PII masking (Phase 56 Task 4) applies — use `mask(taxId)` utility.
- **Calling HMRC/VIES from the happy path in a tRPC mutation without a circuit breaker:** A VIES outage would time out every contractor save. Use the 30s timeout already in `GovApiClient.fetch`, plus the soft-fail branch.
- **Forgetting to update `Contractor.latestVatValidatedAt` after a new `TaxIdValidation` row:** Do both writes in a single `$transaction` — the denormalized cache (D-05) must not drift from the audit table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 client-credentials with token expiry | Custom JWT decoder | HMRC returns `{access_token, expires_in}` — just `expiresAt = Date.now() + (expires_in*1000) - 300_000` (5-min buffer) | HMRC spec lists 4h tokens; no need for a full OAuth library |
| Retry with exponential backoff | Hand-coded `for` loop | Inherit `GovApiClient.fetch` retry | Already implemented + tested in gov-api package |
| Rate limiting | In-memory counter | `GovApiRateLimiter` (Upstash) | Multi-instance-safe; Redis-backed; fail-open |
| HTTP mock in tests | `vi.stubGlobal('fetch', ...)` | MSW handlers per test-utils pattern | MSW is the workspace standard; consistent with all 16 existing integrations |
| UK VAT checksum | New mod-97 implementation | `isValidGbVat` from Phase 56 | Already handles mod-97 + mod-9755 + GBGD + GBHA variants [VERIFIED: packages/validators/src/uk-validators.ts] |
| DE VAT checksum | New ISO-7064 implementation | `isValidUstIdNr` from Phase 56 | Correct MOD-11-10 algorithm, tested against canonical vectors [VERIFIED: packages/validators/src/de-validators.ts] |
| Reverse-charge detection | New service module | Extend `reverse-charge.service.ts` | Existing intra-EU rule works; just add 2 new rule paths [VERIFIED: packages/api/src/services/reverse-charge.service.ts] |
| VAT rate lookup | New DB table | Extend `TaxRate` seed with GB + DE entries | Same pattern used by PL/AE/SA; service `getTaxRatesForCountry()` already country-parameterized [VERIFIED: packages/api/src/services/tax-rate.service.ts] |
| Audit logging | New audit module | `GovApiAuditLogger` + new `TaxIdValidation` row in `emitAuditEntry()` override | Dual-persist pattern: generic audit in GovApiAuditLog + structured evidence in TaxIdValidation |
| EU member states list | New array | `EU_MEMBER_STATES` Set already in `reverse-charge.service.ts` | [VERIFIED: lines 4-32 of that file — 27 member states, correct post-Brexit (GB not present)] |

**Key insight:** Phase 57 is 90% integration work, 10% new code. The abstract base class, rate limiter, audit logger, TaxRate seed, checksum validators, and reverse-charge core already exist. The planner's job is to wire them together with two new subclasses, a schema migration, seed data, 2 legal-phrase constants, and ~5 rule additions.

## Runtime State Inventory

Phase 57 is additive — no renames, no refactors, no migrations of existing string identifiers. However, two state transitions deserve explicit tracking:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing `TaxIdValidation` rows (new table); existing `Contractor.vatId` values remain untouched. Any existing GB or DE contractors in prod with `vatId` set will have `latestVatValidatedAt=null` until first-touch validation fires on next profile open. | None — "never validated" is a legitimate state; profile UI shows gray "Not validated" pill |
| Live service config | HMRC developer hub app registration (one-time; ops/dev owns) → produces `client_id` + `client_secret` stored in SecretStore under `hmrc/client_id` + `hmrc/client_secret` paths. **STATE.md BLOCKER — registration takes weeks.** | Ops must complete HMRC registration BEFORE production rollout; sandbox can proceed with test credentials |
| OS-registered state | None — no cron jobs, no systemd units, no pm2 processes added by this phase (periodic revalidation is deferred) | None |
| Secrets / env vars | NEW env vars: `HMRC_ENV`, `VIES_ENV`, `HMRC_CLIENT_ID_SECRET_PATH`, `HMRC_CLIENT_SECRET_SECRET_PATH`, `HMRC_PLATFORM_VRN`. NEW SecretStore paths: `hmrc/client_id`, `hmrc/client_secret` | Update `.env.example`; SOPS-encrypted `.env` for each environment; document rotation playbook (90-day HMRC credential rotation recommended) |
| Build artifacts | Prisma client regeneration needed after schema changes (auto via `db:generate`); TypeScript compile of new files in `packages/gov-api/dist/` | Planner must include `pnpm --filter @contractor-ops/db db:generate` after the migration step |

**Migration safety:** The `TaxIdValidation` table is purely additive (no data backfill needed). `Contractor.latestVatValidatedAt` and `.latestVatValidationStatus` are nullable — existing rows work with `null` until the user opens the profile. `Organization.isKleinunternehmer` defaults to `false` — safe for all existing DE orgs.

## Common Pitfalls

### Pitfall 1: HMRC v1 was removed on 2025-02-17
**What goes wrong:** Following blog posts or Stack Overflow answers that reference the pre-2025 unauthenticated `v1` endpoint.
**Why it happens:** v1 was public and unauthenticated; v2 moved behind OAuth with a 2-week registration wait.
**How to avoid:** Only target v2.0 — `Accept: application/vnd.hmrc.2.0+json`, Bearer token required. [VERIFIED: HMRC developer hub]
**Warning signs:** 404 on `/organisations/vat/lookup/{vrn}` (old path); 401 without Authorization header.

### Pitfall 2: HMRC sandbox test VAT numbers are non-obvious
**What goes wrong:** Using real VAT numbers against sandbox returns 404 (sandbox has a small test-data fixture set).
**Why it happens:** HMRC sandbox isolates from production registry.
**How to avoid:** Use the HMRC-documented sandbox test VRNs (published in the "Use the Test API" section of their fraud-prevention/testing guide). Planner should record the exact test VRN(s) chosen for CI.
**Warning signs:** All sandbox calls return 404 even with known-valid checksum.

### Pitfall 3: VIES REST response structure is not stable
**What goes wrong:** VIES REST has undergone undocumented shape changes; production can return `userError: "MS_UNAVAILABLE"` when a member state's backend is down.
**Why it happens:** VIES is a thin proxy over 27 member-state databases — any one being offline breaks consultation for that country.
**How to avoid:** Zod `.safeParse()` at the client boundary + branch on `userError` field; map `MS_UNAVAILABLE` / `SERVICE_UNAVAILABLE` to `responseStatus='unavailable'` and trigger D-08 soft-fail.
**Warning signs:** Unexpected `{ userError: "..." }` shape without `isValid` field; intermittent 500s during peak hours.

### Pitfall 4: VIES "qualified confirmation" requires BOTH requester params
**What goes wrong:** Passing only `requesterMemberStateCode` without `requesterNumber` (or vice versa) silently returns the simple-confirmation shape without `consultationNumber`.
**Why it happens:** The two params form a pair — the qualified response is only generated when VIES can attribute the request to a specific VAT-registered business.
**How to avoid:** Require both at the TypeScript type level (discriminated union: `QualifiedRequest` vs `SimpleRequest`); validate at the tRPC input boundary.
**Warning signs:** `confirmationRef` is `null` when you expected a consultation number; German tax office audit evidence is incomplete.

### Pitfall 5: HMRC fraud-prevention headers may or may not apply to this endpoint
**What goes wrong:** The Check-a-VAT-Number v2 OpenAPI spec does NOT list fraud-prevention headers as required. HMRC's Fraud Prevention guide says headers are "required by law for VAT (MTD) and ITSA (MTD) APIs" — this endpoint is application-restricted but NOT MTD.
**Why it happens:** HMRC's documentation is fragmented; different guides give different answers.
**How to avoid:** Send best-effort `Gov-Client-Connection-Method: WEB_APP_VIA_SERVER`, `Gov-Client-User-IDs: os=...`, `Gov-Vendor-Product-Name: contractor-ops`, `Gov-Vendor-Version: <pkg.version>`. They're free to include; if HMRC changes policy later, compliance is already in place.
**Warning signs:** 400 errors with `code: "MISSING_HEADER"` at a future date; never blocks current calls.
**Confidence:** MEDIUM — official spec is silent; sending the headers is the defensive default.

### Pitfall 6: HMRC OAuth token expiry mid-request
**What goes wrong:** Client caches the token for 4h but clock skew or preemptive request in the 5-minute margin returns 401.
**Why it happens:** HMRC `expires_in` is wall-clock; server-side validation is strict.
**How to avoid:** Cache with 5-minute buffer (`expiresAt = now + expires_in - 300_000`). On 401, refresh once and retry.
**Warning signs:** Sporadic 401s at the 4h mark.

### Pitfall 7: Kleinunternehmer invoices must not include any VAT breakdown
**What goes wrong:** Applying rate code `'KU'` (0%) but still showing a `subtotalMinor + vatAmountMinor = totalMinor` breakdown is legally problematic — the invoice must be visibly VAT-free.
**Why it happens:** Developers treat `'KU'` as just another 0% rate (like `'0'` zero-rated).
**How to avoid:** Render the locked phrase `TAX_KLEINUNTERNEHMER_NOTICE` in the footer AND suppress the VAT row in the totals breakdown when `org.isKleinunternehmer=true`. Invoice-generation logic in Phase 61/62 must respect this — flag it in Phase 61 context.
**Warning signs:** A Kleinunternehmer invoice shows "VAT: €0.00" line — should be absent entirely.

### Pitfall 8: Post-Brexit reverse charge applies in BOTH directions
**What goes wrong:** Treating GB→EU as reverse-charge but missing EU→GB.
**Why it happens:** D-12.1 is symmetric but the existing `detectReverseCharge()` function historically assumed EU-only.
**How to avoid:** Check `(seller=GB, buyer∈EU) OR (seller∈EU, buyer=GB)` — both legs.
**Warning signs:** Invoices FROM a German contractor TO a UK org don't get the reverse-charge footer.

### Pitfall 9: Denormalized summary drift
**What goes wrong:** Writing `TaxIdValidation` row but forgetting to update `Contractor.latestVatValidatedAt` — the profile pill shows stale data forever.
**Why it happens:** Two writes, one transaction required.
**How to avoid:** `ctx.db.$transaction([taxIdValidation.create(...), contractor.update(...)])` — atomic.
**Warning signs:** Fresh validation rows exist but profile still shows old state.

## Code Examples

### HMRC OAuth client-credentials flow

```typescript
// Source: https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation/application-restricted-endpoints
private async fetchAccessToken(): Promise<void> {
  const response = await globalThis.fetch(
    `${this.getBaseUrl()}/oauth/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: await this.secretStore.get('hmrc/client_id')!,
        client_secret: await this.secretStore.get('hmrc/client_secret')!,
        scope: 'read:vat',
      }),
    },
  );
  if (!response.ok) throw new Error(`HMRC OAuth failed: ${response.status}`);
  const { access_token, expires_in } = hmrcOauthTokenSchema.parse(await response.json());
  this.accessToken = {
    value: access_token,
    expiresAt: Date.now() + (expires_in * 1000) - 300_000,  // 5min buffer
  };
}
```

### VIES qualified confirmation request (TypeScript discriminated union)

```typescript
// Source: https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{MS}/vat/{VAT}?requesterMemberStateCode=&requesterNumber=
type ViesRequest =
  | { type: 'simple'; countryCode: string; vatNumber: string }
  | { type: 'qualified'; countryCode: string; vatNumber: string;
      requesterMemberStateCode: string; requesterNumber: string };

const viesLookupResponseSchema = z.object({
  countryCode: z.string().length(2),
  vatNumber: z.string(),
  requestDate: z.string().optional(),
  isValid: z.boolean(),
  name: z.string().optional(),
  address: z.string().optional(),
  traderName: z.string().optional(),
  traderCompanyType: z.string().optional(),
  traderAddress: z.string().optional(),
  requestIdentifier: z.string().optional(),  // "consultationNumber" for qualified
  userError: z.string().optional(),          // "MS_UNAVAILABLE" etc.
  // match codes (1-3) for qualified confirmation
  traderNameMatch: z.enum(['1', '2', '3']).optional(),
  traderStreetMatch: z.enum(['1', '2', '3']).optional(),
  traderPostcodeMatch: z.enum(['1', '2', '3']).optional(),
  traderCityMatch: z.enum(['1', '2', '3']).optional(),
});
```

### HMRC Zod response schema

```typescript
// Source: HMRC OpenAPI spec (WebFetch 2026-04-12)
// GET /organisations/vat/check-vat-number/lookup/{targetVrn}
// GET /organisations/vat/check-vat-number/lookup/{targetVrn}/{requesterVrn}
export const hmrcVatLookupResponseSchema = z.object({
  processingDate: z.string(),
  target: z.object({
    name: z.string(),
    vatNumber: z.string(),
    address: z.object({
      line1: z.string(),
      postcode: z.string(),
      countryCode: z.string().length(2),
    }),
  }),
  // Present ONLY on verified (requesterVrn) lookup
  requester: z.string().optional(),
  consultationNumber: z.string().optional(),
});
```

### MSW handler skeleton (new: packages/test-utils/src/msw/handlers/hmrc.ts)

```typescript
// Source: existing packages/test-utils/src/msw/handlers/*.ts pattern
import { http, HttpResponse } from 'msw';
export const hmrcHandlers = [
  http.post('https://test-api.service.hmrc.gov.uk/oauth/token', () => {
    return HttpResponse.json({
      access_token: 'test-token',
      token_type: 'bearer',
      expires_in: 14400,
      scope: 'read:vat',
    });
  }),
  http.get(
    'https://test-api.service.hmrc.gov.uk/organisations/vat/check-vat-number/lookup/:targetVrn/:requesterVrn?',
    ({ params }) => {
      if (params.targetVrn === '555555555') return new HttpResponse(null, { status: 404 });
      return HttpResponse.json({
        processingDate: '2026-04-12T10:00:00Z',
        target: {
          name: 'TEST COMPANY LTD',
          vatNumber: params.targetVrn,
          address: { line1: '1 Test St', postcode: 'SW1A 1AA', countryCode: 'GB' },
        },
        requester: params.requesterVrn,
        consultationNumber: 'C-2026-0001',
      });
    },
  ),
];
```

### Seed extension

```typescript
// Source: EXTEND packages/db/prisma/seed/tax-rates.ts — append entries
// GB (post-Brexit, HMRC standard rates)
{ countryCode: 'GB', code: '20', description: 'Standard rate', ratePercent: 20, isDefault: true, isReverseCharge: false, isExempt: false, effectiveFrom: new Date('2011-01-04') },
{ countryCode: 'GB', code: '5',  description: 'Reduced rate',  ratePercent: 5,  isDefault: false, isReverseCharge: false, isExempt: false, effectiveFrom: new Date('1997-09-01') },
{ countryCode: 'GB', code: '0',  description: 'Zero-rated',    ratePercent: 0,  isDefault: false, isReverseCharge: false, isExempt: false, effectiveFrom: new Date('1973-04-01') },
{ countryCode: 'GB', code: 'RC', description: 'Reverse charge', ratePercent: 0, isDefault: false, isReverseCharge: true,  isExempt: false, effectiveFrom: new Date('2021-01-01') },
// DE
{ countryCode: 'DE', code: '19', description: 'Standard rate (Regelsteuersatz)', ratePercent: 19, isDefault: true, isReverseCharge: false, isExempt: false, effectiveFrom: new Date('2007-01-01') },
{ countryCode: 'DE', code: '7',  description: 'Reduced rate (Ermäßigter Steuersatz)', ratePercent: 7, isDefault: false, isReverseCharge: false, isExempt: false, effectiveFrom: new Date('1983-07-01') },
{ countryCode: 'DE', code: 'RC', description: 'Reverse charge (§13b UStG / intra-EU)', ratePercent: 0, isDefault: false, isReverseCharge: true,  isExempt: false, effectiveFrom: new Date('2010-01-01') },
{ countryCode: 'DE', code: 'KU', description: 'Kleinunternehmer (§19 UStG)',          ratePercent: 0, isDefault: false, isReverseCharge: false, isExempt: true,  effectiveFrom: new Date('2020-01-01') },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VIES SOAP `checkVat` / `checkVatApprox` | VIES REST `/rest-api/ms/{MS}/vat/{VAT}` | ~2022-2024 rollout; REST now primary | D-02 locks REST; SOAP deferred only as fallback if REST unstable |
| HMRC v1 unauthenticated | HMRC v2 OAuth client-credentials | 2025-02-17 v1 removed | Must OAuth-register (2-week HMRC process) — STATE.md blocker |
| Hand-rolled per-country VAT enums (old `invoice.ts`) | DB-driven `TaxRate` with country + code + effectiveFrom | Phase 47 (v4.0) | Already in place; GB/DE seed rows extend the pattern |

**Deprecated/outdated:**
- VIES SOAP endpoint `https://ec.europa.eu/taxation_customs/vies/services/checkVatService` — still up but officially superseded by REST [CITED: ec.europa.eu/taxation_customs/vies/technicalInformation.html]
- HMRC v1 `vat-registered-companies-api` — removed 2025-02-17 [CITED: HMRC developer hub]
- Hardcoded `vatRate` enum (PL only) — replaced in Phase 47 D-02

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] HMRC's fraud-prevention headers are NOT legally required for the Check-a-VAT-Number v2 endpoint (only MTD endpoints are). | Pitfall 5 | Low — sending them anyway is free insurance; policy change would block future calls |
| A2 | [ASSUMED] HMRC rate limit for application-restricted endpoints is 3 req/sec (180 req/min) per application, not per org. | Standard Stack / discretion | Medium — if per-org, we don't need `GovApiRateLimiter` scoping; if per-app, we must throttle across all tenants. CONTEXT.md says "~200 req/min prod" which aligns with 3 req/sec general. |
| A3 | [ASSUMED] VIES qualified confirmation `consultationNumber` maps to the German BZSt's "Bestätigungsanfrage-Nachweis" — i.e., persisting it satisfies the Steuerpflicht documentation requirement. | D-04, Specific ideas | Medium — if BZSt requires the verbatim BZStOnline XML form (not VIES), DE customers may need a separate integration in a future phase. Steuerberater review should confirm. |
| A4 | [ASSUMED] VIES REST is stable enough for production in 2026. | Summary | Medium — STATE.md flags "VIES REST API production stability unconfirmed". Mitigation: robust D-08 degradation + monitoring alerts on `responseStatus='unavailable'` spike. |
| A5 | [ASSUMED] HMRC OAuth token TTL is ~4 hours (`expires_in=14400`). | Code examples | Low — 4h buffer + refresh on 401 covers any TTL from 1h to 8h without change |
| A6 | [ASSUMED] The initial §13b UStG service-type list of 5 (construction, cleaning, scrap, gold, mobile phones) covers the most common scenarios for Contractor Ops' customer base (tech companies with freelance devs). | D-12.3 | Low — deferred-list item explicitly flags expansion as a future phase |
| A7 | [ASSUMED] Using the platform's VRN (`HMRC_PLATFORM_VRN` env) as `requesterVrn` for every HMRC verified lookup is legally acceptable (and for VIES, as `requesterNumber`). | Discretion recommendation | Medium — may need per-org VRN when enterprise customers want tenant isolation; currently locked out by D-01 platform-wide credentials |
| A8 | [ASSUMED] HMRC sandbox and VIES have no strict rate limit (HMRC sandbox is 3 req/sec like prod; VIES is "soft"). | Rate-limit tuning | Low — we implement fail-open rate limiting anyway |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

(Table is NOT empty — planner and/or discuss-phase should surface A2, A3, A4, A7 for explicit user or Steuerberater confirmation before production.)

## Open Questions

1. **HMRC sandbox test VRN selection**
   - What we know: Sandbox has a fixed fixture dataset; only specific VRNs return 200.
   - What's unclear: The exact test VRNs are in HMRC's "Use the Test API" section, which was not readable via WebFetch.
   - Recommendation: Planner captures specific test VRNs during Wave 0 sandbox setup task; hard-codes in MSW handlers and CI fixtures.

2. **`TaxIdValidation.validFrom` / `validTo` semantics**
   - What we know: D-04 lists these columns; VIES does not return validity dates, HMRC returns only `processingDate`.
   - What's unclear: Whether these columns should be null-by-default and reserved for future providers, or populated with `validFrom=requestedAt` and `validTo=requestedAt + 90 days` (matching D-06 freshness).
   - Recommendation: Leave null; compute freshness in code from `requestedAt + 90d`. Simpler, less state drift.

3. **Index strategy for `TaxIdValidation`**
   - What we know: CONTEXT.md lists `(contractorId, taxIdType, requestedAt)` primary.
   - What's unclear: Whether a partial index on `responseStatus='valid'` helps the staleness lookup.
   - Recommendation: Start with the composite descending index `(contractorId, taxIdType, requestedAt DESC)` — Postgres uses it for "latest valid" via `WHERE responseStatus='valid' ORDER BY requestedAt DESC LIMIT 1`. Partial index only if query plans show >100ms on `EXPLAIN ANALYZE`.

4. **Stale-result TTL for the profile summary cache**
   - What we know: 90-day freshness from D-06.
   - What's unclear: Whether the profile card should re-query the `TaxIdValidation` table on every render or cache the summary for N minutes.
   - Recommendation: Use the existing `Contractor.latestVatValidatedAt` + `latestVatValidationStatus` fields (D-05 denormalization). TanStack Query at the frontend gives natural stale-while-revalidate. No extra cache layer needed.

5. **Whether to pre-warm HMRC token on server cold start**
   - What we know: First HMRC call per process pays a token-fetch latency (~300ms).
   - What's unclear: Whether ops wants pre-warming in the health check.
   - Recommendation: Skip — lazy acquisition is simpler; 300ms on first call is acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js native `fetch` | HmrcVatClient + ViesClient | ✓ | ≥18 | — |
| `@upstash/redis` configured | `GovApiRateLimiter` (optional) | — | — | Fail-open in dev (rate-limit disabled locally — existing behavior) |
| PostgreSQL (Neon) | `TaxIdValidation` migration | ✓ | — | — |
| SecretStore | HMRC credentials | ✓ | Phase 52 | Memory store for dev; Infisical for prod |
| HMRC OAuth app registration | Production HMRC calls | ✗ | — | **BLOCKING for production; sandbox test creds work for dev.** STATE.md flagged; ops must initiate registration. |
| MSW | HMRC + VIES test fixtures | ✓ | 2.13.2 | — |
| Vitest | Unit + integration tests | ✓ | 4.1.4 | — |
| Prisma CLI | Schema migration | ✓ | 7.7.0 | — |

**Missing dependencies with no fallback:**
- HMRC production OAuth client credentials (blocks prod launch, not dev/sandbox work) — STATE.md open blocker tracked

**Missing dependencies with fallback:**
- Upstash Redis (optional — `GovApiRateLimiter` falls open in dev)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | Per-package `vitest.config.ts` / `package.json` scripts (workspace standard) |
| Quick run command | `pnpm --filter @contractor-ops/gov-api test -- --run hmrc-vat-client` |
| Full suite command | `pnpm turbo run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-02 | Seed loads GB rates (20/5/0/RC) with isDefault on 20 | unit | `pnpm --filter @contractor-ops/db test -- tax-rates.seed` | ❌ Wave 0 |
| PAY-02 | `getTaxRatesForCountry('GB')` returns rates sorted with 20 first | unit | `pnpm --filter @contractor-ops/api test -- tax-rate.service` | ❌ Wave 0 extend |
| PAY-02 | Invoice line creation with `org.countryCode='GB'` preselects code '20' | integration | `pnpm --filter @contractor-ops/api test -- invoice.router --run preselect-gb` | ❌ Wave 0 |
| PAY-03 | `HmrcVatClient.checkVatNumber` issues GET to `/organisations/vat/check-vat-number/lookup/:vrn/:requesterVrn` with Bearer token | unit | `pnpm --filter @contractor-ops/gov-api test -- hmrc-vat-client` | ❌ Wave 0 |
| PAY-03 | `HmrcVatClient` refreshes token after 401 once then retries | unit | same | ❌ Wave 0 |
| PAY-03 | Local `isValidGbVat` short-circuits invalid-format before network call | unit | same (checks no fetch call) | ❌ Wave 0 |
| PAY-03 | tRPC `contractor.validateVat` writes `TaxIdValidation` row and updates `Contractor.latestVatValidatedAt` atomically | integration | `pnpm --filter @contractor-ops/api test -- contractor.router --run validate-vat` | ❌ Wave 0 |
| PAY-03 | D-08: HMRC 503 returns `responseStatus='stale'` using last valid row | integration | same | ❌ Wave 0 |
| PAY-04 | Seed loads DE rates (19/7/RC/KU) | unit | `pnpm --filter @contractor-ops/db test -- tax-rates.seed` | ❌ Wave 0 |
| PAY-04 | `org.isKleinunternehmer=true` + DE → invoice lines forced to 'KU' | integration | `pnpm --filter @contractor-ops/api test -- invoice.router --run kleinunternehmer` | ❌ Wave 0 |
| PAY-04 | `detectReverseCharge` rule 'gb_eu_post_brexit_b2b' triggers both directions | unit | `pnpm --filter @contractor-ops/api test -- reverse-charge.service --run post-brexit` | ❌ Wave 0 extend |
| PAY-04 | `detectReverseCharge` rule 'de_domestic_13b_ustg' triggers for DE→DE + serviceType='CONSTRUCTION' | unit | `pnpm --filter @contractor-ops/api test -- reverse-charge.service --run de-13b` | ❌ Wave 0 extend |
| PAY-04 | Locked phrase CI guard rejects `TAX_KLEINUNTERNEHMER_NOTICE` key in any messages/*.json | unit | `pnpm --filter @contractor-ops/validators test -- locked-phrases-guard` | ✅ extend existing |
| PAY-04 | Locked phrase CI guard rejects `TAX_UK_REVERSE_CHARGE_NOTICE` key in any messages/*.json | unit | same | ✅ extend existing |
| PAY-05 | `ViesClient.checkVatNumber` issues GET to `/rest-api/ms/DE/vat/:vrn?requesterMemberStateCode=&requesterNumber=` | unit | `pnpm --filter @contractor-ops/gov-api test -- vies-client` | ❌ Wave 0 |
| PAY-05 | `ViesClient` parses qualified response and returns `consultationNumber` in `confirmationRef` | unit | same | ❌ Wave 0 |
| PAY-05 | `userError='MS_UNAVAILABLE'` maps to `responseStatus='unavailable'` + triggers stale-fallback | unit + integration | same + `contractor.router` | ❌ Wave 0 |
| PAY-05 | Zod schema rejects unexpected VIES shape (malformed body) | unit | `pnpm --filter @contractor-ops/gov-api test -- vies-client --run schema-reject` | ❌ Wave 0 |
| PAY-05 | Local `isValidUstIdNr` short-circuits format-invalid DE VAT | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter <changed-package> test --run` (single-package quick check, < 30s target)
- **Per wave merge:** `pnpm turbo run test --filter=...[HEAD^1]` — all packages touched by the wave
- **Phase gate:** `pnpm turbo run test` — full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/gov-api/src/clients/hmrc-vat-client.test.ts` — covers PAY-03 HMRC client behavior
- [ ] `packages/gov-api/src/clients/vies-client.test.ts` — covers PAY-05 VIES client behavior
- [ ] `packages/gov-api/src/schemas/hmrc-vat.schema.ts` + `vies.schema.ts` — Zod response schemas (+ colocated schema tests)
- [ ] `packages/test-utils/src/msw/handlers/hmrc.ts` — HMRC OAuth token + lookup endpoints
- [ ] `packages/test-utils/src/msw/handlers/vies.ts` — VIES simple + qualified + userError scenarios
- [ ] `packages/test-utils/src/msw/fixtures/hmrc.ts` + `vies.ts` — canonical 200/404/500 bodies
- [ ] `packages/db/prisma/schema/tax.prisma` — TaxIdValidation model (Wave 1)
- [ ] `packages/db/__tests__/tax-rates.seed.test.ts` — asserts GB + DE seed entries + isDefault flags
- [ ] `packages/api/src/services/__tests__/reverse-charge.service.test.ts` — extend existing with post-Brexit + §13b tests
- [ ] `packages/api/src/services/__tests__/tax-id-validation.service.test.ts` — new orchestrator (pre-flight + network + soft-fail)
- [ ] `packages/api/src/routers/__tests__/contractor.router.test.ts` — extend with validateVat/revalidateVat
- [ ] `packages/api/src/routers/__tests__/invoice.router.test.ts` — extend with Kleinunternehmer + default-rate-selection + staleness-triggers-revalidate
- [ ] `packages/validators/src/legal/en.ts` — new file (mirror de.ts pattern)
- [ ] `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — extend with TAX_KLEINUNTERNEHMER_NOTICE, TAX_UK_REVERSE_CHARGE_NOTICE, TAX_STEUERSCHULDNERSCHAFT
- [ ] Framework install: none — vitest + MSW already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (machine-to-machine) | OAuth 2.0 client-credentials per HMRC spec; tokens never logged; 4h cached |
| V3 Session Management | no | No user session; platform-wide service credentials |
| V4 Access Control | yes | tRPC `tenantProcedure` + `requirePermission({ contractor: ['update'] })` on validateVat; `organizationId` scoping on every `TaxIdValidation` read/write (multi-tenant isolation) |
| V5 Input Validation | yes | Zod schemas at every tRPC input + at HMRC/VIES response boundary; Phase 56 format validators as pre-flight |
| V6 Cryptography | yes | HMRC client_secret stored in SecretStore (encrypted at rest); never hand-roll signing — HMRC uses symmetric bearer |
| V7 Error Handling & Logging | yes | Pino structured logs; never log raw VAT numbers (apply PII mask from Phase 56 Task 4); never log Authorization header or client_secret |
| V8 Data Protection | yes | `taxIdValue` column is PII (tax ID); apply existing masking utility on display; at-rest encryption via Neon |
| V9 Communications | yes | TLS-only (HMRC + VIES are HTTPS); reject mixed content |
| V10 Malicious Code | yes | Dependency audit — no new runtime deps; reuse existing gov-api + zod |
| V12 Files and Resources | n/a | No file I/O |
| V12 Audit / Retention | yes | Append-only `TaxIdValidation`; retention policy: retain indefinitely for HMRC/BZSt compliance (both require 6+ years); never `DELETE` — soft-delete only if added later |
| V13 API & Web Services | yes | tRPC with `tenantProcedure` scoping; rate-limit per org to prevent tenant-level DoS of HMRC/VIES quota |

### Known Threat Patterns for {HMRC + VIES + Prisma + tRPC}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant enumeration via HMRC error messages | Information Disclosure | Sanitize HMRC 404 responses; return `{status: 'invalid'}` without upstream error text |
| Rate-limit exhaustion by one tenant consuming platform HMRC quota | Denial of Service (cross-tenant) | Per-org rate-limit bucket via `GovApiRateLimiter` with orgId as identifier — already supported |
| Leaking HMRC client_secret in logs or error responses | Information Disclosure | Structured logger redacts `Authorization`, `client_secret`, and Gov-Client-* headers by default; test guards |
| Injecting arbitrary requesterVrn to exfiltrate consultation numbers | Elevation of Privilege | Hard-code `HMRC_PLATFORM_VRN` from env — never accept user-supplied requesterVrn in tRPC inputs |
| Storing raw VAT numbers in audit logs visible in admin UI | Information Disclosure | Apply Phase 56 PII mask utility when rendering `TaxIdValidation.taxIdValue` in admin views |
| Cross-org VAT validation history leak | Information Disclosure | `organizationId` filter on every `TaxIdValidation` query — enforced by `tenantProcedure` middleware |
| Replay of stale validation results as "valid" past freshness window | Tampering | Code-side freshness check (`requestedAt > now - 90d`) before trusting `responseStatus='valid'`; never trust DB row alone |
| HMRC 429 rate-limit response triggering retry storm | Denial of Service (self-inflicted) | Existing `GovApiClient` retry includes 429 in retryable statuses with exponential backoff capped at 30s |
| MITM during VIES HTTP (no auth) leaking VAT numbers | Information Disclosure | TLS-enforce (VIES REST is HTTPS-only); reject any attempt to downgrade |
| Test handlers leaking into production bundle | Information Disclosure | MSW handlers only imported in `*.test.ts` files — verify via bundle analyzer; test-utils package excluded from runtime builds |

## Sources

### Primary (HIGH confidence)
- `packages/gov-api/src/client.ts` — GovApiClient abstract base (inheritance pattern locked)
- `packages/gov-api/src/types.ts` — GovApiConfig, GovApiEnvironment, GovApiAuditEntry
- `packages/gov-api/src/rate-limiter.ts` — Upstash sliding-window rate limiter (fail-open)
- `packages/gov-api/src/audit-logger.ts` — Fire-and-forget audit writer
- `packages/einvoice/src/profiles/zatca/api-client.ts` — Canonical subclass example
- `packages/db/prisma/schema/tax.prisma` + `seed/tax-rates.ts` — TaxRate extension target
- `packages/db/prisma/schema/contractor.prisma` + `organization.prisma` — Field-add targets
- `packages/validators/src/uk-validators.ts` + `de-validators.ts` + `legal/de.ts` — Phase 56 pre-flight checksum + locked-phrase pattern
- `packages/api/src/services/reverse-charge.service.ts` — Existing rule engine to extend
- `packages/api/src/services/tax-rate.service.ts` — `getTaxRatesForCountry()` already country-parameterized
- `packages/test-utils/src/msw/handlers/` — MSW handler pattern (16 existing)
- `.planning/phases/57-government-api-clients/57-CONTEXT.md` — 14 locked decisions
- `.planning/milestones/v4.0-phases/47-vat-engine-wht-calculator-country-fields/47-CONTEXT.md` — Phase 47 TaxRate + reverse-charge precedent
- `.planning/milestones/v4.0-phases/54-regional-routing-adoption-gov-api-wiring/54-CONTEXT.md` — Phase 54 GovApiClient + SecretStore precedent
- HMRC OpenAPI spec (Check a UK VAT Number API v2.0) — endpoint paths, response schema, OAuth scopes [WebFetch verified 2026-04-12]

### Secondary (MEDIUM confidence — verified with multiple sources)
- HMRC Developer Hub — fraud-prevention headers guidance + application-restricted endpoint model [WebSearch + WebFetch 2026-04-12]
- HMRC standard rate limit: 3 req/sec per application [WebSearch verified — HMRC Reference Guide]
- VIES REST endpoint path `/rest-api/ms/{MS}/vat/{VAT}` with optional requester params [WebSearch — multiple independent implementations confirm]
- VIES JSON response fields: `countryCode`, `vatNumber`, `isValid`, `requestDate`, `name`, `address`, `traderName`, `requestIdentifier`, `userError` [WebSearch — multiple SDK implementations corroborate]
- German BZSt qualified confirmation (Bestätigungsanfrage) legal status for audit evidence [WebSearch — Handelskammer Hamburg + BZSt official guidance]
- §13b UStG service-type list (construction, cleaning, scrap metals, gold, mobile phones) [WebSearch — stripe.com/resources + vatupdate.com + subauftrag.com agree]

### Tertiary (LOW confidence — flagged for validation)
- Exact HMRC sandbox test VRNs — planner must capture during Wave 0 ops setup
- VIES production stability in 2026 — STATE.md flags this; Phase 57 mitigates via D-08 soft-fail
- Whether fraud-prevention headers are legally required for Check-a-VAT vs only MTD — official docs ambiguous, send best-effort
- HMRC OAuth `expires_in` exact value — assumed 4h (14400s) per HMRC guidance; planner verifies on first live sandbox call

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are in-tree or confirmed via package.json inspection
- Architecture patterns: HIGH — direct extension of Phase 54 ZATCA pattern with verified code paths
- Reverse-charge rules (D-12): MEDIUM — §13b list locked but may need expansion; post-Brexit rule well-documented
- HMRC API specifics: MEDIUM — OpenAPI spec available; fraud-prevention header applicability ambiguous (A1)
- VIES API specifics: MEDIUM — endpoint path verified across 3+ sources; response schema may drift (Pitfall 3)
- Pitfalls: HIGH — drawn from current (2026) HMRC + VIES operational documentation

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (30 days for HMRC/VIES surfaces — both APIs have been stable but HMRC continues small changes; revalidate if phase slips)
