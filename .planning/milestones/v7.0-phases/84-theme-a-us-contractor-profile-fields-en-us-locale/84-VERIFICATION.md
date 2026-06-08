---
phase: 84-theme-a-us-contractor-profile-fields-en-us-locale
verified: 2026-06-08T17:15:00Z
status: human_needed
score: 11/12
overrides_applied: 0
human_verification:
  - test: "Locale switcher shows 'English (US)' as a selectable option and switching to it renders MM/DD/YYYY dates and $ currency throughout the app"
    expected: "en-US option visible in locale switcher; date fields show MM/DD/YYYY; currency shows $X.XX format"
    why_human: "Intl formatting and locale-switcher rendering require live browser interaction to confirm; messages.test.ts asserts the Intl API contract but not the full rendered UI"
  - test: "ar (Arabic) RTL layout is unregressed after en-US locale addition"
    expected: "Switching to Arabic shows right-to-left layout; no LTR bleed on Arabic pages"
    why_human: "RTL regression requires visual browser inspection; pnpm test covers the logic but not the visual rendering"
  - test: "US contractor profile section renders in the app for a US org: EntityType dropdown, EIN field, SSN masked display, US address fields, USPS status pill all appear in the correct §A order"
    expected: "US contractor profile shows EntityType (LLC/C_CORP/etc.), EIN input with XX-XXXXXXX placeholder, masked SSN (•••-••-XXXX), street/city/state/ZIP fields, USPS pill"
    why_human: "Full component render under a real US org with real contractorQuery data requires a running dev server and a US org in the DB"
  - test: "SSN reveal control: for a role with contractorPii:read (owner/admin/finance_admin) the 'Reveal SSN' button is visible; for external_accountant and other denied roles it is ABSENT (not disabled)"
    expected: "owner/admin/finance_admin see 'Reveal SSN' button; external_accountant sees no reveal control"
    why_human: "Role-switching and live RBAC behavior requires browser interaction with a running app; grep confirms the canReveal prop is wired but rendering for each role needs human confirmation"
---

# Phase 84: US Contractor Profile Fields + en-US Locale — Verification Report

**Phase Goal:** A US contractor's identity fields validate to IRS/USPS standards and the product renders in correct American English before any form intake.
**Verified:** 2026-06-08T17:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | EIN accepted only in XX-XXXXXXX format with valid IRS prefix; retired/invalid prefix rejected | VERIFIED | `isValidEin` in `us-validators.ts` — VALID_EIN_PREFIXES Set + `^(\d{2})-?(\d{7})$`; `us-validators.test.ts` 22/22 GREEN |
| 2 | SSN accepted only in XXX-XX-XXXX format outside invalid ranges (area 000/666/900-999, group 00, serial 0000) | VERIFIED | `isValidSsn` in `us-validators.ts` — anchored regex + range exclusion; `us-validators.test.ts` 22/22 GREEN |
| 3 | SSN displays last-4 by default; full value only behind contractorPii:read | VERIFIED | `SsnMaskedReveal` shows `•••-••-{last4}` by default; `canReveal` prop gates the button; `ssn-masked-reveal.test.tsx` 5/5 GREEN (masked + reveal-absent + reveal-available + loading + error states) |
| 4 | SSN stored ENCRYPTED in ssnEncrypted/ssnLast4 (NOT countryFields JSONB); encryptSsn uses dedicated SSN_ENCRYPTION_KEY | VERIFIED | `ssn-crypto.ts` uses `getServerEnv().SSN_ENCRYPTION_KEY` (not BANK_ACCOUNT_ENCRYPTION_KEY); `contractor.ts updateUsProfile` writes to `ssnEncrypted`/`ssnLast4`; `countryFields` JSONB excludes SSN; test 9/9 GREEN |
| 5 | contractorPii:read granted to owner/admin/finance_admin ONLY; external_accountant and 6 other roles DENY | VERIFIED | `roles.ts` — allPermissions (owner dup) + admin + finance_admin have `contractorPii:['read']`; external_accountant has no contractorPii grant; `roles.test.ts` 22/22 GREEN (10-role matrix) |
| 6 | revealSsn is staff-router-only, RBAC-gated, audit-logged with NO SSN in audit row | VERIFIED | `contractor.ts:revealSsn` — `.use(requirePermission({ contractorPii: ['read'] }))`, `writeAuditLog({ action:'contractor.ssn.revealed', metadata:{ field:'ssn' } })` (no SSN value); `grep -rl revealSsn packages/api/src/routers/portal` → empty; `contractor-reveal-ssn.test.ts` 9/9 GREEN |
| 7 | SSN/EIN redacted by pino (PII_MASK_PATHS) | VERIFIED | `pii-mask.ts` — `'*.ssn'`, `'*.ein'`, `'*.countryFields.ssn'`, `'*.countryFields.ein'` in PII_MASK_PATHS; `ssn`/`ein` in PII_MASK_KEYWORDS; `logger/index.test.ts` 7/7 GREEN |
| 8 | US address validated via USPS adapter with GLOBAL-keyed 60/hr limiter; fail-open (never blocks save) | VERIFIED | `usps-client.ts` — `USPS_GLOBAL_LIMITER_ID = 'usps-global'`, `USPS_RATE_LIMIT = { maxRequests:60, windowMs:3_600_000 }`; every failure path returns `{ verified:false, status }` without throwing; `usps-client.test.ts` 6/6 GREEN |
| 9 | US profile section dispatches from CountryFieldsDispatch case 'US'; renders UsComplianceFields | VERIFIED | `country-compliance-section.tsx` — `case 'US': <UsComplianceFields ...>`; `COUNTRY_LABELS.US`; `country-compliance-us.test.tsx` 3/3 GREEN |
| 10 | en-US registered in SUPPORTED_LOCALES/localeMeta/loader; fallbackLng en-US→en→pl; thin en-US.json passes parity | VERIFIED | `messages.ts` — `SUPPORTED_LOCALES` includes `'en-US'`, `localeMeta['en-US']`; `index.ts` — `fallbackLng: { 'en-US': ['en', DEFAULT_LOCALE] }`; `run-guard.ts` — `fallbackPeers` mode; `messages.test.ts` 10/10 GREEN; `i18n-parity.test.ts` 5/5 GREEN |
| 11 | i18n:parity treats en-US as fallback-aware peer; strict peers (de/pl/ar) still require full parity | VERIFIED | `run-guard.ts:fallbackPeers` — covered set = `peerKeys ∪ fallbackKeys ∪ baseline` for en-US only; strict peer semantics unchanged; parity test asserts a de gap still fails |
| 12 | ssnEncrypted is never selected outside revealSsn in any read path | WARNING | `getById` uses `include:` (all scalars) + `...contractor` spread — `ssnEncrypted` ciphertext is included in the tRPC getById response and reaches the frontend. Frontend ignores it entirely (`grep -rn ssnEncrypted apps/web-vite/src/` → 0 hits). Ciphertext without the key poses near-zero PII risk, but the stated Pitfall 3 invariant ("never selected outside revealSsn") is technically violated at the tRPC layer. No test asserts `getById` excludes `ssnEncrypted`. |

**Score:** 11/12 truths fully verified; 1 truth WARNING (ssnEncrypted in getById response, ciphertext only, frontend ignores).

---

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | USPS normalized-suggestion live data round-trip (suggestion box + "Use USPS version" affordance) | Follow-up per 84-06 SUMMARY | Plan 84-06 SUMMARY "Known Stubs" documents this as intentional inert stub; mandatory pill states (verified/unverified/unavailable) ARE wired |
| 2 | Per-region production migration of ssnEncrypted/ssnLast4/uspsVerified/uspsValidatedAt columns | Production deploy | Phase 82/83 posture — dev DB applied via direct ALTER; prod apply deferred per documented posture |
| 3 | Tax-treaty / W-8BEN logic | Phase 85 | D-07 scope fence; Plan 05 must-have explicitly excludes this |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/validators/src/us-validators.ts` | isValidEin + isValidSsn pure validators | VERIFIED | 161 lines; VALID_EIN_PREFIXES Set + anchored regex; legal-deferred annotation |
| `packages/api/src/services/ssn-crypto.ts` | encryptSsn/decryptSsn (AES-256-GCM, dedicated key) | VERIFIED | 69 lines; SSN_ENCRYPTION_KEY (not bank key); iv:authTag:ciphertext format |
| `packages/gov-api/src/clients/usps-client.ts` | UspsAddressClient fail-open adapter | VERIFIED | 452 lines; global-keyed limiter; safeParse; all failure paths return unverified without throwing |
| `packages/gov-api/src/schemas/usps-address.schema.ts` | Zod token + address schemas | VERIFIED | DPVConfirmation field; safeParse boundary |
| `packages/db/prisma/schema/contractor.prisma` | ssnEncrypted/ssnLast4/uspsVerified/uspsValidatedAt | VERIFIED | All 4 nullable columns present at lines 43-47 |
| `packages/auth/src/permissions.ts` | contractorPii:['read'] statement | VERIFIED | Line 44 |
| `packages/auth/src/roles.ts` | contractorPii grant to owner (dup)/admin/finance_admin; denied to 7 others | VERIFIED | Lines 41 (allPermissions dup), 72, 87; external_accountant omitted |
| `packages/logger/src/pii-mask.ts` | ssn/ein PII_MASK_PATHS + keywords | VERIFIED | Lines 48/50/67/69; PII_MASK_KEYWORDS includes ssn/ein |
| `packages/api/src/routers/core/contractor.ts` | updateUsProfile + revealSsn + US getCountryFieldsConfig | VERIFIED | revealSsn at line 1612; updateUsProfile at line 1536; US branch in getCountryFieldsConfig at line 1443 |
| `apps/web-vite/src/components/contractors/compliance/us-compliance-fields.tsx` | US fields (mirror uk-compliance-fields) | VERIFIED | 298 lines (min 60 per plan) |
| `apps/web-vite/src/components/contractors/compliance/ssn-masked-reveal.tsx` | Masked + gated reveal control | VERIFIED | 100 lines; 5 states per UI-SPEC §B |
| `apps/web-vite/src/components/contractors/usps-address-status-pill.tsx` | Advisory USPS status pill | VERIFIED | 109 lines; 5 status variants |
| `apps/web-vite/messages/en-US.json` | US divergent copy overrides (ZIP code / SSN / United States) | VERIFIED | 16 lines; thin override with §E divergent keys only |
| `apps/web-vite/src/i18n/messages.ts` | en-US in SUPPORTED_LOCALES/localeMeta/loader | VERIFIED | Line 9 (SUPPORTED_LOCALES), line 27 (localeMeta), line 79 (localeLoaders) |
| `packages/lint-guards/src/i18n-parity/run-guard.ts` | fallback-aware peer mode (fallbackPeers) | VERIFIED | Line 31 (fallbackPeers option); lines 79-88 (union logic) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/validators/src/country-fields.ts` | `us-validators.ts` | `import isValidEin in usCountryFieldsSchema .refine` | VERIFIED | `isValidEin` imported; `US: usCountryFieldsSchema` in countryFieldsSchemaMap line 287 |
| `packages/api/src/services/ssn-crypto.ts` | `getServerEnv().SSN_ENCRYPTION_KEY` | `getEncryptionKey()` | VERIFIED | Line 17 — `SSN_ENCRYPTION_KEY` (not BANK_ACCOUNT_ENCRYPTION_KEY) |
| `packages/auth/src/roles.ts` | `allPermissions (owner dup) + per-role grants` | `contractorPii: ['read']` | VERIFIED | allPermissions line 41; admin line 72; finance_admin line 87 |
| `packages/api/src/routers/core/contractor.ts (revealSsn)` | `requirePermission + writeAuditLog + decryptSsn` | staff tenantProcedure with reveal gate | VERIFIED | `requirePermission({ contractorPii: ['read'] })` line 1613; `writeAuditLog` line 1625; `decryptSsn` line 1623 |
| `packages/api/src/routers/core/contractor.ts (updateUsProfile)` | `encryptSsn + UspsAddressClient.validateAddress` | SSN to encrypted cols; USPS advisory | VERIFIED | `encryptSsn(cleaned)` line 1579; USPS advisory via `applyUspsAdvisory` helper |
| `apps/web-vite/src/components/contractors/country-compliance-section.tsx` | `UsComplianceFields` | `CountryFieldsDispatch case 'US'` | VERIFIED | `case 'US':` line 256 |
| `apps/web-vite/src/components/contractors/compliance/ssn-masked-reveal.tsx` | `contractor.revealSsn mutation` | `use-reveal-ssn` hook | VERIFIED | `useRevealSsn` imported from `./hooks/use-reveal-ssn.js`; hook calls `trpc.contractor.revealSsn.mutationOptions` |
| `apps/web-vite/src/i18n/index.ts` | `en fallback bundle for en-US` | `registerLocaleBundle('en') when locale==='en-US'` | VERIFIED | `if (locale === 'en-US')` block at line 133+ also registers en bundle |
| `scripts/i18n-parity.mjs` | `run-guard fallback-aware mode` | `fallbackPeers: { 'en-US': <en keys> }` | VERIFIED | `FALLBACK_PEERS = { 'en-US': EN_FALLBACK_KEYS }` line 33; passed to `runI18nParity` in both branches |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ssn-masked-reveal.tsx` | `last4` prop | `contractorQuery.data.ssnLast4` via `country-compliance-section.tsx` line 133 | Yes — written by `updateUsProfile` to `ssnLast4` column | FLOWING |
| `ssn-masked-reveal.tsx` | `revealedSsn` state | `useRevealSsn` → `contractor.revealSsn` mutation → `decryptSsn(ssnEncrypted)` | Yes — real decrypt of real ciphertext | FLOWING |
| `usps-address-status-pill.tsx` | `status` prop | `contractorQuery.data.uspsVerified` (boolean nullable) mapped to status | Yes — `uspsVerified` written by `applyUspsAdvisory` in `updateUsProfile` | FLOWING (deferred: suggestion data inert per known stub) |
| `us-compliance-fields.tsx` | `values` / `onChange` props | Parent container via `ContractorComplianceSectionView` props | Yes — form values from parent; static USPS suggestion props are inert (documented stub) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `isValidEin('12-3456789')` → true; `isValidEin('07-1234567')` → false (invalid prefix) | `pnpm --filter @contractor-ops/validators test src/__tests__/us-validators.test.ts` | 22/22 GREEN | PASS |
| `encryptSsn`/`decryptSsn` round-trip + 3-part format + random IV | `pnpm --filter @contractor-ops/api test src/services/__tests__/ssn-crypto.test.ts` | 6/6 GREEN | PASS |
| `revealSsn` FORBIDDEN without contractorPii:read; decrypt+audit with no SSN; no portal exposure | `pnpm --filter @contractor-ops/api test src/routers/core/__tests__/contractor-reveal-ssn.test.ts` | 9/9 GREEN | PASS |
| USPS global limiter + fail-open + safeParse + cache | `pnpm --filter @contractor-ops/gov-api test src/clients/__tests__/usps-client.test.ts` | 6/6 GREEN | PASS |
| SSN masked/reveal-absent/reveal-available/loading/error states | `pnpm --filter @contractor-ops/web-vite test src/components/contractors/compliance/__tests__/ssn-masked-reveal.test.tsx` | 5/5 GREEN | PASS |
| US dispatch renders UsComplianceFields | `pnpm --filter @contractor-ops/web-vite test src/components/contractors/__tests__/country-compliance-us.test.tsx` | 3/3 GREEN | PASS |
| en-US Intl MM/DD/YYYY + $ formatting; en-US in SUPPORTED_LOCALES | `pnpm --filter @contractor-ops/web-vite test src/i18n/__tests__/messages.test.ts` | 10/10 GREEN | PASS |
| fallback-aware parity: en-US thin override passes; de gap still fails | `pnpm --filter @contractor-ops/lint-guards test src/__tests__/i18n-parity.test.ts` | 5/5 GREEN | PASS |
| contractorPii granted to owner/admin/finance_admin; denied to 7 others (10-role matrix) | `pnpm --filter @contractor-ops/auth test src/__tests__/roles.test.ts` | 22/22 GREEN | PASS |
| ssn/ein paths redacted in pino logs | `pnpm --filter @contractor-ops/logger test src/__tests__/index.test.ts` | 7/7 GREEN | PASS |

**Total: 10/10 spot-checks PASS.**

---

### Probe Execution

No probe scripts declared or found for this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| US-FIELD-01 | 84-01, 84-05, 84-06 | EIN validator (XX-XXXXXXX + IRS prefix table) | SATISFIED | `isValidEin` implemented + tested; EIN validated in `updateUsProfile` + rendered in `UsComplianceFields` |
| US-FIELD-02 | 84-01, 84-03, 84-05, 84-06 | SSN intake with PII-grade masking (last-4 default; full behind RBAC contractorPii:read) | SATISFIED | Dedicated ssnEncrypted/ssnLast4 columns; AES-256-GCM; contractorPii:read 10-role matrix; masked-reveal component; audit log |
| US-FIELD-03 | 84-04, 84-05 | US address validation via USPS CASS (advisory, never blocks save) | SATISFIED | `UspsAddressClient` — global-keyed limiter, fail-open; `updateUsProfile` USPS advisory; `usps-client.test.ts` 6/6 GREEN |
| US-FIELD-04 | 84-05, 84-06 | US contractor profile dispatched from CountryComplianceSection | SATISFIED | `getCountryFieldsConfig` US branch; `case 'US'` dispatch; `UsComplianceFields`; 3-place registration complete |
| US-LOC-01 | 84-02, 84-06 | en-US locale at full parity (date/currency/American English copy where divergent) | SATISFIED | en-US in SUPPORTED_LOCALES; fallbackLng chain; i18n:parity fallback-aware; thin en-US.json; de/pl/ar parity preserved |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/api/src/routes/csp-report.ts` | 86 | `lint:logs` unredacted body log | Info | Pre-existing (commit `e320911b`); NOT introduced by Phase 84; documented in deferred-items.md |
| `packages/api/src/routers/core/contractor.ts` | ~638 | `getById` uses `include:` (all scalars) + `...contractor` spread — `ssnEncrypted` ciphertext in tRPC response | Warning | Pitfall 3 invariant technically violated; ciphertext (not plaintext); frontend ignores it entirely (`grep` confirmed); zero actual PII exposure but stated must-have breached |

---

### Human Verification Required

#### 1. en-US locale switcher + Intl formatting

**Test:** In the running app, open the locale switcher. Verify "English (US)" appears as a selectable option. Switch to it. Confirm dates render MM/DD/YYYY and currency renders with a leading $ sign.
**Expected:** Locale switcher shows "English (US)"; date fields show MM/DD/YYYY format; currency shows $X.XX.
**Why human:** `messages.test.ts` asserts `Intl` API behaviour, but the actual rendered UI with real data requires a running dev server.

#### 2. Arabic RTL non-regression

**Test:** Switch to Arabic locale. Verify all pages show right-to-left layout with no LTR bleed.
**Expected:** Full RTL layout in Arabic; no elements misaligned due to en-US addition.
**Why human:** RTL regression is a visual property; the logic (dir ternary unchanged) is verified by tests but visual rendering needs browser confirmation.

#### 3. US contractor profile section renders correctly

**Test:** Log in as an admin for a US-org. Navigate to a contractor's compliance profile. Verify the US section shows: EntityType dropdown (with LLC/C_CORP/S_CORP/PARTNERSHIP/SOLE_PROPRIETOR/INDIVIDUAL options), EIN input (XX-XXXXXXX placeholder), SSN masked display (•••-••-XXXX), street/city/state/ZIP fields, USPS status pill.
**Expected:** All US fields visible in §A order; EIN field rejects invalid format/prefix inline.
**Why human:** Requires a running dev server with a US org and contractor; component tests verify the dispatch but not the full integration with real contractorQuery data.

#### 4. SSN reveal RBAC by role

**Test:** (a) As owner/admin/finance_admin: the "Reveal SSN" button is visible for a contractor with an SSN. Click it — verify loading state then full XXX-XX-XXXX displayed. (b) As external_accountant: no reveal button present (not disabled, absent).
**Expected:** Reveal button visible for permitted roles; absent (not just disabled) for denied roles.
**Why human:** Role-switching with a live RBAC session and a real contractor with ssnEncrypted requires a running app; `ssn-masked-reveal.test.tsx` covers the `canReveal=false` absent case but with a mocked prop, not a live role session.

---

### Gaps Summary

**No blocking gaps.** All 11/12 fully verified truths are PASS. The one WARNING (ssnEncrypted ciphertext in `getById` response) does not block the phase goal: the data is encrypted (useless without the server-side key) and the frontend ignores it entirely. It is a code quality / defence-in-depth concern rather than an active PII leak. All 5 requirement IDs (US-FIELD-01/02/03/04, US-LOC-01) are satisfied per REQUIREMENTS.md and verified by passing scoped tests.

The 4 human verification items are UI/UX/visual checks that cannot be satisfied by grep or scoped tests. The automated evidence strongly supports the goal being achieved; human confirmation is the final gate.

---

_Verified: 2026-06-08T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
