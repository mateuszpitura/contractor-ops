# Phase 84: Theme A — US Contractor Profile Fields + en-US Locale - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

US contractor identity capture + American-English rendering, before any tax-form
intake (Phase 85+):

1. **EIN validator** (US-FIELD-01) — `XX-XXXXXXX` + IRS prefix table.
2. **SSN intake with PII-grade masking** (US-FIELD-02) — last-4 default; full only
   behind a new `CONTRACTOR_PII:READ` permission.
3. **USPS address validation** (US-FIELD-03) — CASS normalize via USPS Addresses 3.0
   (OAuth2, 60 req/hr, no-batch).
4. **US contractor profile section** (US-FIELD-04) — dispatched from the existing
   `CountryComplianceSection` pattern.
5. **en-US locale** (US-LOC-01) — full key parity vs `en`, American-English copy +
   US date/currency/measure formatting.

**UI phase** (frontend-design skill applies; UI-SPEC gate fires in plan-phase). The
tax-treaty table + W-8BEN auto-populate (US-LOC-02/03) are **Phase 85**, NOT here.
</domain>

<decisions>
## Implementation Decisions

### SSN Storage + PII Masking (US-FIELD-02)
- **D-01:** Full SSN is **encrypted-at-rest** (reuse the existing AES-256-GCM
  field-encryption util — the credential/integration-store pattern), with a plain
  `ssnLast4` column for default display. The server returns **last-4 only**; the full
  value is exposed solely through a dedicated, **audit-logged reveal procedure** gated
  by a NEW `CONTRACTOR_PII:READ` permission. EIN is stored plain (business ID, not an
  identity-theft vector) but added to the **log** PII-mask.
- **D-02:** `CONTRACTOR_PII:READ` is granted by default to **owner + admin +
  finance/accountant** roles (the finance/tax role needs full SSN for 1099 generation
  in Phase 86); NOT manager / member / viewer / it_admin. The reveal action calls
  `writeAuditLog`.
- **D-08 (log masking):** Add `*.ssn`, `*.ein`, `*.countryFields.ssn`,
  `*.countryFields.ein` (+ casing variants) to `packages/logger/src/pii-mask.ts`
  `PII_MASK_PATHS` — distinct from the display masking + RBAC above.

### USPS Address Validation (US-FIELD-03)
- **D-03:** **Advisory, non-blocking.** Server-side normalize-to-CASS on save; surface
  the normalized suggestion + a `verified`/`unverified` flag on the address; NEVER
  hard-block the save. On USPS being down OR the 60 req/hr throttle being hit → accept
  the address **unverified-with-flag** and allow later re-validation. Throttle/cache
  MECHANICS (OAuth2 token handling, 60/hr token bucket, no-batch, cache keyed by the
  raw address) are deferred to plan-phase per the ROADMAP research flag.

### en-US Locale (US-LOC-01)
- **D-04:** **Thin-override** `apps/web-vite/messages/en-US.json` containing ONLY
  divergent keys (American spelling, MM/DD/YYYY dates, `$` currency, US-specific copy);
  configure i18next `fallbackLng` as a map `en-US → en → pl`(default) so en-US inherits
  every unchanged key from `en` (effective full parity via fallback, minimal
  maintenance, new `en` keys auto-inherit). Add `'en-US'` to web-vite `SUPPORTED_LOCALES`
  + `localeMeta` + the on-demand bundle loader. **Teach the `i18n:parity` gate that
  en-US inherits en** (fallback-parity, not literal-key parity) — a key present in `en`
  counts as covered for `en-US`. US date/currency/measure formatting via `Intl` `en-US`.

### EIN / SSN Validation (US-FIELD-01 / US-FIELD-02)
- **D-05:** **Strict, table-backed** (matches v5.0 UTR mod-11 / Steuernummer rigor):
  EIN = `XX-XXXXXXX` format + an IRS-published valid-prefix table (reject retired/invalid
  2-digit prefixes); SSN = format + invalid-range rejection (area `000`/`666`/`900–999`,
  group `00`, serial `0000`). Both live in `packages/validators/src/us-validators.ts`
  (mirror `uk-validators.ts` / `de-validators.ts`) consumed by a new `usCountryFieldsSchema`
  in `country-fields.ts`. IRS-prefix-table accuracy → legal/tax-adviser-deferred per posture.

### US Profile Component (US-FIELD-04)
- **D-06:** The US section dispatches from `CountryComplianceSection` — add a
  `UsComplianceFields` component (mirror `UkComplianceFields` / `DeComplianceFields`) and
  register `'US'` in the country-compliance config (`hasCountryFields` / `countryCode`).
  Follow the web-vite page→container→hook→component architecture, the `frontend-design`
  skill, and mandatory loading/empty/error + WCAG states. The SSN field uses a
  masked-input + gated-reveal control.

### Scope
- **D-07:** US-LOC-02 (tax-treaty rate table) and US-LOC-03 (W-8BEN treaty-article
  auto-populate) are **Phase 85** — do NOT build treaty logic here.

### Claude's Discretion
- The exact field-encryption util + key management for the SSN column (reuse the
  existing per-field/credential AES-256-GCM helper) — planner.
- The initial divergent-key set in `en-US.json` (planner derives from `en`: spelling +
  date/currency/measure format keys + any US-specific labels added this phase).
- USPS throttle/cache implementation (token bucket / Redis) — plan-phase per research flag.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — US-FIELD-01/02/03/04 + US-LOC-01 verbatim.
- `.planning/ROADMAP.md` (Phase 84 entry) — goal + 4 SC + USPS research flag + UI hint.
- `.planning/milestones/v7.0-phases/82-...` & `83-...` CONTEXT.md — region + add-on primitives (do not duplicate).

### Field validators + profile UI
- `packages/validators/src/country-fields.ts` — per-country Zod schemas (UAE/Saudi/UK/DE); add `usCountryFieldsSchema`.
- `packages/validators/src/uk-validators.ts`, `de-validators.ts` — validator pattern to mirror in a new `us-validators.ts`.
- `apps/web-vite/src/components/contractors/country-compliance-section.tsx` + `-container.tsx` — per-`countryCode` dispatch; add `UsComplianceFields` + register `US`.
- `apps/web-vite/src/components/contractors/compliance/uk-compliance-fields.tsx`, `de-compliance-fields.tsx` — component analogs.
- `apps/web-vite/src/components/contractors/hooks/use-country-compliance.ts` — the data hook (config `hasCountryFields`/`countryCode`).

### PII / RBAC / encryption
- `packages/logger/src/pii-mask.ts` — `PII_MASK_PATHS` (add SSN/EIN entries).
- RBAC permission registry + `requirePermission` (research locates the `CONTRACTOR_PII:READ` home — likely `packages/api/src/middleware/rbac.ts` + the role→permission map / Better Auth access control).
- The AES-256-GCM field/credential-encryption util (research locates it — v2.0 integration credential store) for the SSN column.

### i18n
- `apps/web-vite/src/i18n/index.ts` — i18next init (`fallbackLng`, `supportedLngs`, on-demand bundles); make `fallbackLng` an `en-US → en` map.
- `apps/web-vite/src/i18n/messages.ts` — `SUPPORTED_LOCALES` + `localeMeta` (add `en-US`).
- `apps/web-vite/messages/en.json` — source of truth for the divergent-key derivation.
- The `i18n:parity` lint gate — teach it en-US fallback-parity.

### UI
- `frontend-design` skill `SKILL.md` — MANDATORY before web-vite UI edits.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `country-fields.ts` per-country Zod schema pattern + `uk/de-validators.ts` — US validators slot in 1:1.
- `CountryComplianceSection` per-countryCode dispatch + `Uk/DeComplianceFields` — `UsComplianceFields` mirrors them.
- `pii-mask.ts` `PII_MASK_PATHS` — log masking for SSN/EIN (additive list edit).
- i18next on-demand bundle loader + `fallbackLng` — en-US plugs in as a thin override + fallback-map.
- The existing AES-256-GCM credential-encryption util — reuse for the SSN column.
- `requirePermission` + the role→permission map — add `CONTRACTOR_PII:READ`.

### Established Patterns
- **Sensitive tax IDs (UTR/Steuernummer) are stored plain + log-masked + RBAC-read** — SSN goes FURTHER (encrypt-at-rest + last4 + reveal-gated) per its higher sensitivity (D-01).
- **External integrations are non-blocking / fire-and-forget** — USPS validation follows (D-03 advisory + unverified-flag).
- **`writeAuditLog` on sensitive actions** — the SSN reveal qualifies.
- **No hardcoded user-facing strings; i18n parity en/de/pl/ar (+ en-US here)** — every new label/state string is i18n'd.

### Integration Points
- US contractor fields persist via the existing `countryFields` bundle on `Contractor` (US a new variant); SSN column is the encrypted exception.
- The US profile section renders only when `contractor.countryCode === 'US'` (config-gated, like GB/DE).
- en-US selectable from the locale switcher; date/currency formatting via `Intl` `en-US`.
</code_context>

<specifics>
## Specific Ideas

- **SSN gets stronger handling than UTR/Steuernummer** — a deliberate divergence from the
  plain-countryFields pattern, justified by SSN's identity-theft sensitivity (encrypt-at-rest
  + last4 + audit-logged gated reveal).
- **en-US via fallback, not duplication** — inherit `en`; only override what truly diverges.
- Continue the "no product theater" posture — USPS validation is real (advisory) not faked;
  the prefix/range tables are real validators, annotated for legal-adviser verification.
</specifics>

<deferred>
## Deferred Ideas

- **US tax-treaty rate table + W-8BEN treaty-article auto-populate** (US-LOC-02/03) — Phase 85.
- **USPS batch validation** — the API is no-batch; single-address only this phase.
- **IRS-prefix-table / SSN-range legal verification** — annotate; legal/tax-adviser-deferred.
- **Full 50-state-specific address rules** — CASS normalize only; no per-state logic here.

Discussion stayed within phase scope.
</deferred>

---

*Phase: 84-theme-a-us-contractor-profile-fields-en-us-locale*
*Context gathered: 2026-06-08*
