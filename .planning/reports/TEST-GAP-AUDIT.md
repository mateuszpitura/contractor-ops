# Test Coverage Gap Audit

**Date:** 2026-04-14
**Baseline:** 8,866 tests / 786 test files / Node 24 + libxmljs2 — all green
**Scope:** Full monorepo — packages/\*, apps/web

---

## Executive Summary

The test suite provides solid unit-test foundations (~80-96% line coverage per package) but has **critical blind spots** in:

1. E-invoice XML generation/parsing (ZATCA, Peppol-AE) — zero tests on code that feeds directly into government APIs
2. RBAC API-key authorization path — zero tests on the code gate for all external integrations
3. Billing webhook edge cases — silent downgrade to STARTER tier on unknown Stripe price IDs
4. GDPR R2 cleanup — Art. 17 erasure right partially untested
5. E2E user journeys — no coverage for classification questionnaire, e-invoice send, billing flows

---

## 1. Critical Gaps

### 1.1 ZATCA XML Generator & Parser — ZERO TESTS

| File | Lines | Risk |
|------|-------|------|
| `packages/einvoice/src/profiles/zatca/generator.ts` | ~298 | **Critical** |
| `packages/einvoice/src/profiles/zatca/parser.ts` | ~221 | **Critical** |

**What's untested:**

- `generateZatcaXml()` — produces UBL 2.1 XML with Saudi-specific FATOORA extensions. Every B2B invoice submission to GAZT depends on this output being structurally correct.
  - `resolveProfileId('simplified')` → `'reporting:1.0'` vs `'clearance:1.0'` branching
  - `extractIssueTime` with and without `T` separator in date string
  - `fromMinor(100)` → `'1.00'`, `fromMinor(0)` → `'0.00'` decimal formatting
  - Multi-line invoice XML structure and nesting
  - VAT amount calculation embedded in XML output
- `parseZatcaXml()` — parses inbound ZATCA clearance responses. A parser bug would fail inbound invoice processing silently.

**Why it matters:** Saudi Arabia mandates cryptographic signing on the generated XML. The signer (`signer.ts`) IS tested, but it operates on the output of `generator.ts` which is not. A generation bug = every B2B invoice rejected by GAZT.

**Recommended tests (~15):**

```
- generateZatcaXml with simplified profile → reporting:1.0 profileId
- generateZatcaXml with standard profile → clearance:1.0 profileId
- generateZatcaXml zero-VAT invoice → TaxAmount = 0.00
- generateZatcaXml multi-line invoice → correct LineExtensionAmount per line
- generateZatcaXml date with T separator → correct IssueDate + IssueTime
- generateZatcaXml date without T separator → correct fallback
- generateZatcaXml with discount → AllowanceCharge present
- generateZatcaXml output is valid XML (parse with libxmljs2)
- parseZatcaXml valid clearance response → correct fields extracted
- parseZatcaXml malformed XML → throws with descriptive error
- parseZatcaXml missing mandatory element → error with element name
- parseZatcaXml with warning-level diagnostics → warnings array populated
- Round-trip: generate → parse → compare fields
```

---

### 1.2 RBAC API-Key Authorization Path — ZERO TESTS

| File | Lines | Risk |
|------|-------|------|
| `packages/api/src/middleware/rbac.ts` | 22-41 | **Critical** |

**What's untested:**

The entire `authMode === 'apiKey'` branch in `enforcePermission()`:

1. Checks `ctx.apiKeyId && ctx.apiKeyScopes` — if missing → `FORBIDDEN`. **Untested.**
2. Maps permission to required scopes via `permissionToScopes(permission)`.
3. Checks all required scopes exist in `new Set(ctx.apiKeyScopes)`. **Untested.**
4. Returns `FORBIDDEN` with `PERMISSION_DENIED` when scopes insufficient. **Untested.**

The existing `rbac.test.ts` (152 lines) only exercises `authMode: 'session'`.

**Why it matters:** External integrations (Jira, Linear, custom webhooks) using API keys rely entirely on this code path. A bug here silently grants or denies access to contractors, invoices, and classification data through the public API.

**Recommended tests (~6):**

```
- apiKey mode with correct scopes → passes through
- apiKey mode with missing apiKeyId → FORBIDDEN
- apiKey mode with missing apiKeyScopes → FORBIDDEN
- apiKey mode with partial scopes (has contractor:read, needs contractor:update) → FORBIDDEN
- apiKey mode with exactly the required scopes → passes (boundary)
- apiKey mode with superset of required scopes → passes
```

---

### 1.3 Billing Webhook — Silent STARTER Downgrade

| File | Lines | Risk |
|------|-------|------|
| `packages/api/src/services/billing-webhook.ts` | 349-356 | **Critical** |

**What's untested:**

`handleSubscriptionUpdated` → `buildSubscriptionData` catch block: when `resolveTierFromPriceId` throws (unknown Stripe price ID), the code logs `BILLING ALERT` and **silently defaults to `'STARTER'`**.

The test always mocks `mockResolveTierFromPriceId.mockReturnValue('PRO')` — no test where it throws.

**Why it matters:** A new price ID added in Stripe (plan change, A/B test, migration) that isn't mapped in `resolveTierFromPriceId` would silently downgrade **every affected customer** to STARTER tier. No alert reaches the engineering team unless someone monitors logs.

**Additional untested branches in billing-webhook.ts:**

| Branch | Lines | Description |
|--------|-------|-------------|
| `notifyAdminsOfTierChange` | 337-341 | Called on tier upgrade/downgrade. Never invoked in any test — tests set previous sub to `null` |
| `handleChargeRefunded` object customer | ~700 | `typeof charge.customer === 'string'` vs object. Tests only pass string |
| `handleInvoicePaid` subscription_create skip | ~515 | `billing_reason === 'subscription_create'` filter not explicitly tested |

**Recommended tests (~6):**

```
- handleSubscriptionUpdated with unknown priceId → defaults to STARTER + logs BILLING ALERT
- handleSubscriptionUpdated with tier change → notifyAdminsOfTierChange called
- handleSubscriptionUpdated with same tier → notifyAdminsOfTierChange NOT called
- handleChargeRefunded with object customer → extracts customer.id
- handleInvoicePaid with billing_reason=subscription_create → skips ledger entry
- handleInvoicePaid with billing_reason=subscription_cycle → creates ledger entry
```

---

## 2. High-Priority Gaps

### 2.1 Peppol-AE Validator — ZERO TESTS (8 validation rules)

| File | Lines | Risk |
|------|-------|------|
| `packages/einvoice/src/profiles/peppol-ae/validator.ts` | ~190 | **High** |
| `packages/einvoice/src/profiles/peppol-ae/generator.ts` | ~208 | **High** |
| `packages/einvoice/src/profiles/peppol-ae/parser.ts` | ~155 | **High** |
| `packages/einvoice/src/profiles/peppol-ae/qr-code.ts` | ~73 | **High** |

`validator.ts` has 8 distinct validation error codes — none tested:

- `WRONG_CUSTOMIZATION_ID` — wrong UBL customization
- `MISSING_BUYER_REFERENCE` — no buyer reference
- `MISSING_CURRENCY_CODE` — no currency
- `MISSING_SUPPLIER_TRN` — missing TRN for UAE supplier
- `MISSING_CUSTOMER_TRN` — missing TRN for UAE customer (warning)
- `MISSING_TAX_SUBTOTAL` — no tax breakdown
- `MISSING_LINE_AMOUNT` — line item without amount
- `MISSING_ROOT` / `PARSE_ERROR` — structural XML issues

**Recommended tests (~20):**

```
- validator: valid PINT-AE invoice → valid: true, errors: []
- validator: each of 8 error codes individually triggered
- validator: malformed XML → PARSE_ERROR
- validator: missing Invoice root → MISSING_ROOT
- generator: minimal invoice → valid UBL 2.1 XML output
- generator: multi-line invoice → correct per-line amounts
- generator: AED currency → correct CurrencyCode element
- parser: valid XML → correct parsed fields
- parser: malformed XML → throws descriptive error
- qr-code: generate → returns PNG buffer with QR content
- round-trip: generate → validate → should pass
```

---

### 2.2 Peppol Adapter Factory — ZERO TESTS (SSRF safety)

| File | Lines | Risk |
|------|-------|------|
| `packages/api/src/services/peppol-adapter-factory.ts` | ~60 | **High** |

Single exported function `buildStorecoveAdapterForOrg`. The `env === 'production'` / `env === 'sandbox'` branch controls whether **real Storecove production API** is called vs sandbox.

**Recommended tests (~5):**

```
- No PEPPOL IntegrationConnection → returns null
- Missing credentialsRef → returns null
- Missing accessToken after decryption → returns null
- env=production → production Storecove URL used
- env=sandbox → sandbox Storecove URL used
```

---

### 2.3 GDPR Erasure — R2 Cleanup Untested

| File | Lines | Risk |
|------|-------|------|
| `packages/api/src/routers/gdpr.ts` | 381-397 | **High** |
| `apps/web/src/app/api/cron/data-purge/route.ts` | 107-121 | **High** |

**GDPR router `requestErasure`:**

After the DB transaction, documents are fetched and `deleteRegionalObject` is called per storage key. The test mocks R2 but only verifies the transaction and audit log — not:

- R2 cleanup being called at all
- R2 cleanup failing (should it roll back? Currently it doesn't)
- `r2ObjectsCleaned` count in the response

**Data purge cron — partial R2 failure:**

Code snapshots expired documents, attempts R2 deletion for each, accumulates `failedR2DocIds`, then skips DB deletion for those. Test only covers happy path (R2 succeeds).

**Why it matters:** GDPR Art. 17 — incomplete R2 cleanup leaves personal data in cloud storage after right-to-be-forgotten is processed. Orphaned R2 objects are unreachable and won't be retried.

**Recommended tests (~6):**

```
- requestErasure → r2.deleteRegionalObject called for each document
- requestErasure → R2 fails for one doc → error logged, doesn't block other deletions
- requestErasure → r2ObjectsCleaned count matches successful deletions
- data-purge → R2 deleteObject throws for 1 of 3 docs → only 2 get DB-deleted
- data-purge → failedR2DocIds excluded from safeDocIds
- data-purge → all R2 deletions fail → no DB deletions occur
```

---

### 2.4 E-Invoice Finalize — Oversized XML & R2 Failure

| File | Lines | Risk |
|------|-------|------|
| `packages/api/src/services/einvoice-finalize.ts` | 265, 287 | **High** |

- `FINALIZE_MAX_XML_BYTES` guard (line 265): A 5MB+ XRechnung that should be rejected — no test.
- `r2.putObject` failure (line 287): R2 outage → unhandled rejection. No test.
- `mapPrismaInvoiceToEInvoice` (line 470): Complex 60-line mapping function, only tested indirectly. No direct unit test for null vatId, empty lines, etc.

**Recommended tests (~6):**

```
- finalizeEInvoice with XML exceeding FINALIZE_MAX_XML_BYTES → throws with size error
- finalizeEInvoice with R2 upload failure → error logged, clean state
- mapPrismaInvoiceToEInvoice with null buyer.vatId → correct fallback
- mapPrismaInvoiceToEInvoice with empty lines array → valid output
- mapPrismaInvoiceToEInvoice with all optional fields populated → correct mapping
- mapPrismaInvoiceToEInvoice with multi-currency → correct currencyCode
```

---

## 3. Medium-Priority Gaps

### 3.1 KSeF Compliance Status — ZERO TESTS

| File | Lines | Risk |
|------|-------|------|
| `packages/einvoice/src/profiles/ksef/compliance.ts` | ~84 | **Medium** |

`computeKsefComplianceStatus()` has 7 distinct branches, none tested:

- `DISCONNECTED` → `'suspended'`
- `ERROR` → `'error'`
- `REAUTH_REQUIRED` → `'error'`
- `config.environment === 'test'` → `'sandbox'`
- `recentSyncStatuses` containing `'FAILED'` → `'degraded'`
- `healthScore` when `totalSyncs === 0` → `0`
- `healthScore` with mixed SUCCESS/FAILED entries

**Why it matters:** Drives the KSeF dashboard indicator. Wrong `'suspended'` vs `'error'` misleads users about integration state.

**Recommended tests (~8).**

---

### 3.2 Classification Edge Cases

**IR35 — `packages/classification/src/profiles/ir35/area-scoring.ts`:**

- `deriveVerdict` with exactly 1 `leaning-inside` + 0 `leaning-outside` → should return `'neutral'` (not `'leaning-inside'`, which requires >= 2). Untested boundary.
- `strong-inside` co-existing with `strong-outside` in same area — ordering determines result. Untested at unit level.

**Scheinselbständigkeit — `packages/classification/src/profiles/scheinselbstandigkeit/scoring.ts`:**

- `categoryVerdict` per-category `amber`/`red` thresholds — only total-score boundaries tested, not per-category proportional math.
- `MissingAnswerError` only tested for `DRV-PER-01`. No test verifying ALL required question IDs individually trigger the error.
- `billingRatioToScore` with non-integer input (e.g., `49.5`) — Zod enforces `.int()` upstream but function itself has no guard.

**Recommended tests (~10).**

---

### 3.3 Feature Flags Router — ZERO TESTS

| File | Lines | Risk |
|------|-------|------|
| `packages/api/src/routers/feature-flags.ts` | ~30 | **Medium** |

Single `list` endpoint returning `FLAG_KEYS.map(...)`. No test for response shape or flag evaluation. Feature flag mis-routing can gate KSeF, ZATCA, IR35 on/off incorrectly.

Also: `apiKeyTenantFlaggedProcedure` in `packages/api/src/middleware/feature-flag.ts` (line 69) is exported but has zero test coverage.

**Recommended tests (~4).**

---

### 3.4 E2E User Journey Gaps

| Flow | Current E2E Coverage | Impact |
|------|---------------------|--------|
| Classification questionnaire → result → SDS document | **None** | Core product feature, completely untested E2E |
| Invoice finalization → KSeF/ZATCA/XRechnung send | **None** | Revenue-critical, regulatory-critical |
| Billing plan upgrade → Stripe redirect → confirmation | **None** | Revenue-critical |
| Approval chain: submit → approve step → advance → complete | **Page render only** | Core workflow, only smoke-tested |
| Payment run: create → export SEPA/SWIFT XML | **Page render only** | Finance-critical |
| Portal: contractor submits invoice | **None** | Primary contractor touchpoint |
| Portal: contractor uploads document | **None** | Primary contractor touchpoint |
| Settings: connect integration (Jira/Linear/Slack) | **Skipped** | Integration setup flow |

**Recommended E2E specs (~8 new spec files).**

---

## 4. Low-Priority Gaps

| Gap | File | Notes |
|-----|------|-------|
| `exchange-rate.ts` schemas — 0 tests | `packages/validators/src/exchange-rate.ts` | 3 Zod schemas, low complexity |
| `handelsregister-courts.ts` — no duplicate-code check | `packages/validators/src/handelsregister-courts.ts` | Static data, unlikely to regress |
| XRechnung `parseXRechnungCii` stub throws — no test | `packages/einvoice/src/profiles/xrechnung-de/parser.ts` | Intentional stub (Phase 62) |
| `clockify-sync.ts` missing config BAD_REQUEST | `packages/api/src/services/clockify-sync.ts:166-171` | Config validation edge case |
| `approval-engine.ts` empty steps edge case | `packages/api/src/services/approval-engine.ts` | `advanceFlow` with 0 steps |
| IR35 `computedAt` time-dependent assertion | `packages/classification/src/profiles/ir35/scoring.ts` | Low risk, ISO format only |

---

## 5. Effort Estimates

| Priority | Gaps | Est. New Tests | Effort |
|----------|------|---------------|--------|
| **Critical** | ZATCA gen/parse, RBAC apiKey, billing downgrade | ~27 | ~4h |
| **High** | Peppol-AE (validator/gen/parse/qr), adapter factory, GDPR R2, einvoice finalize | ~37 | ~5h |
| **Medium** | KSeF compliance, classification edges, feature flags, E2E journeys | ~30 + 8 E2E | ~6h |
| **Low** | Exchange rate, handelsregister, XRechnung stub, clockify, approval | ~10 | ~2h |
| **Total** | | **~104 tests + 8 E2E specs** | **~17h** |

Bringing total from **~8,866 → ~8,970 unit/integration + 8 comprehensive E2E journeys**.

---

## 6. Recommended Execution Order

1. **ZATCA generator + parser** — highest regulatory risk, zero coverage
2. **RBAC API-key path** — security gate, zero coverage
3. **Billing webhook edge cases** — silent financial impact
4. **Peppol-AE validator** — 8 untested validation rules
5. **GDPR R2 cleanup** — compliance risk
6. **E-invoice finalize guards** — DoS + reliability
7. **KSeF compliance status** — UX correctness
8. **Classification edge cases** — verdict accuracy
9. **E2E journeys** — integration confidence
10. **Low-priority cleanup** — completeness
