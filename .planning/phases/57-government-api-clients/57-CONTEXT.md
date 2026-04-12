# Phase 57: Government API Clients - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Add HMRC VAT validation (UK) and VIES USt-IdNr validation (EU) government API clients, plus seed and apply UK/DE VAT rates to invoices with Kleinunternehmerregelung exemption and post-Brexit-aware reverse-charge auto-detection. Scope anchor: Gov API + VAT rate seeding + invoice-line rate application + reverse-charge labeling only — XRechnung/ZUGFeRD invoice document generation is Phase 61/62; contractor classification is Phase 58+.

</domain>

<decisions>
## Implementation Decisions

### Credentials & Environment Model
- **D-01:** HMRC VAT API uses **platform-wide OAuth 2.0 client credentials** stored in SecretStore (single Contractor Ops HMRC app). All tenants share the client app; per-request HMRC fraud-prevention headers carry tenant identifying info. Matches existing ZATCA/Peppol pattern. Avoids forcing every UK customer through HMRC developer onboarding.
- **D-02:** VIES USt-IdNr validation uses the **REST API** (unauthenticated, `ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{number}`). Supports both simple and qualified confirmations via `requesterMemberStateCode` + `requesterNumber` query params. No SOAP fallback in this phase — REST meets both needs in 2026.
- **D-03:** Environment switching via `HMRC_ENV` + `VIES_ENV` env variables driving base URL selection (`sandbox` | `production`). Matches existing `GovApiClient.environment` field from Phase 54. Dev/staging deployments pin to sandbox; production flips to live via infra env.

### Validation Storage & Freshness
- **D-04:** New `TaxIdValidation` Prisma model — append-only audit table. Columns: `id`, `organizationId`, `contractorId`, `taxIdType` (`'GB_VAT'|'DE_USTIDNR'`), `taxIdValue`, `apiProvider`, `requestedAt`, `validFrom`, `validTo`, `confirmationRef` (VIES qualified-confirmation ref when present), `responseStatus` (`'valid'|'invalid'|'stale'|'unavailable'`), `responseBody` (JSONB). Satisfies HMRC/BfDI retention requirements + supports compliance evidence.
- **D-05:** Contractor row carries denormalized `latestVatValidatedAt` + `latestVatValidationStatus` summary fields for fast profile reads. Source of truth remains `TaxIdValidation`; the cache is updated on every new validation row.
- **D-06:** **90-day freshness window**. Validation is "fresh" if `responseStatus='valid'` AND `validatedAt > now - 90d`. Stale results display with yellow warning on profile; auto-revalidate fires on invoice generation if stale.
- **D-07:** **Three re-validation triggers:** (1) contractor profile save with a new/changed VAT number → immediate validation; (2) invoice line creation if contractor's latest validation is stale → inline revalidation; (3) explicit 'Revalidate' button on profile → on-demand refresh. Periodic background refresh is deferred to a future phase.
- **D-08:** **Graceful degradation via soft-fail with stale flag.** If HMRC or VIES is unreachable: return the latest successful validation (if any) with `responseStatus='stale'` and `apiUnavailableAt` timestamp. Profile shows yellow warning: "Last validated {date}; live check unavailable". Invoice generation proceeds. User can retry via 'Revalidate'. Never hard-block invoices on API outage.

### UK/DE VAT Rate Seeding & Default Application
- **D-09:** **Single Prisma seed migration** extends `packages/db/prisma/seed/tax-rates.ts` with:
  - GB: `'20'` (standard 20%, `isDefault: true`), `'5'` (reduced 5%), `'0'` (zero-rated 0%), `'RC'` (reverse-charge 0%)
  - DE: `'19'` (standard 19%, `isDefault: true`), `'7'` (reduced 7%), `'RC'` (reverse-charge 0%), `'KU'` (Kleinunternehmerregelung 0% exempt)
  - Single seed run populates all rates. Follows Phase 47 D-01 pattern.
- **D-10:** Invoice line creation pre-selects the `isDefault: true` TaxRate for the org's `countryCode` (GB → 20%, DE → 19%). User overrides via per-line dropdown listing all rate codes for that country. Matches existing PL behavior (23% default, overridable).
- **D-11:** **Kleinunternehmerregelung exemption** — new `isKleinunternehmer: boolean` field on Organization (default `false`). When `true` AND org.countryCode='DE': all invoice lines use rate code `'KU'` (0%) and the invoice footer renders the locked phrase "Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen". Add this phrase to `packages/validators/src/legal/de.ts` as `TAX_KLEINUNTERNEHMER_NOTICE` (extends Phase 56 D-05 locked-phrase set; CI guard asserts presence).

### Reverse-Charge Auto-Detection Rules
- **D-12:** Three auto-detect rule paths (all user-overridable per line):
  1. **Post-Brexit UK + EU B2B:** GB org → EU contractor OR EU org → GB contractor, both VAT-registered → RC applies (both directions post-Brexit).
  2. **Intra-EU B2B:** EU org → EU contractor in different member state, both VAT-registered (valid VIES or HMRC) → RC applies.
  3. **DE domestic §13b UStG:** DE org → DE contractor with qualifying `serviceType` (construction, cleaning, scrap metals, gold, mobile phones — initial rule list; expandable) → domestic RC applies.
- **D-13:** Auto-flag triggers display of 'Reverse charge applies' toggle on the invoice line. If user disables, a reason prompt appears ('Why not reverse charge?' free-text) and the reason is logged to the invoice audit trail. Captures override intent for future compliance review.
- **D-14:** **Reverse-charge label placement: both line + footer.** Line VAT column shows short 'RC' marker. Footer renders full locked phrase — DE: `TAX_STEUERSCHULDNERSCHAFT` ('Steuerschuldnerschaft des Leistungsempfängers', Phase 56 D-05); UK: "Reverse charge: Customer to pay the VAT to HMRC" (added as new locked phrase `TAX_UK_REVERSE_CHARGE_NOTICE` in `packages/validators/src/legal/en.ts` — mirrors the DE locked-phrase pattern to the UK side).

### Claude's Discretion
- HMRC OAuth 2.0 client registration (one-time setup; dev/ops owns)
- Exact HMRC fraud-prevention headers (`Gov-Client-*`) composition — document per HMRC spec
- VIES requesterNumber source (use platform default VAT ID vs per-org)
- Rate limiting tuning per endpoint (HMRC: ~200 req/min prod, ~100 sandbox; VIES: soft)
- `TaxIdValidation` index strategy (primary on contractorId + taxIdType + requestedAt)
- Stale result TTL for the profile summary cache
- §13b serviceType enum encoding (string enum vs foreign key)
- UI copy for the override reason prompt (short vs long form)
- Background retry strategy for failed validations (sidecar queue or none)

### Folded Todos
No todos folded — no pending backlog items matched Phase 57 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — PAY-02 (UK VAT rates), PAY-03 (HMRC validation), PAY-04 (DE VAT rates + Kleinunternehmer + reverse-charge labeling), PAY-05 (VIES validation)
- `.planning/ROADMAP.md` §Phase 57 — Goal, 4 success criteria, Phase 56 dependency
- `.planning/STATE.md` — Blocker: "HMRC developer hub registration takes weeks — initiate during Phase 56" + "VIES REST API production stability unconfirmed"

### Prior phase context (foundations this phase extends)
- `.planning/milestones/v4.0-phases/47-vat-engine-wht-calculator-country-fields/47-CONTEXT.md` — D-01 TaxRate DB-driven schema, D-03 reverse-charge auto-detection rule, countryFields JSONB pattern
- `.planning/milestones/v4.0-phases/54-regional-routing-adoption-gov-api-wiring/` — GovApiClient abstract base, SecretStore integration pattern
- `.planning/phases/56-country-foundations-german-i18n/56-CONTEXT.md` — D-02 UK validators (mod-97/9755 + GBGD/GBHA), D-03 DE validators (USt-IdNr ISO-7064 MOD-11-10), D-05 locked phrases module, D-06 CI guard pattern

### Existing infrastructure (must read to integrate correctly)
- `packages/gov-api/src/client.ts` — `GovApiClient` abstract base (extend for HmrcVatClient + ViesClient)
- `packages/gov-api/src/types.ts` — `GovApiConfig`, `GovApiEnvironment`, retry/rate-limit types
- `packages/gov-api/src/audit-logger.ts` — audit hook to override for HMRC/VIES-specific retention
- `packages/gov-api/src/rate-limiter.ts` — bucket strategy (tune for HMRC 200/min prod)
- `packages/db/prisma/seed/tax-rates.ts` — extend with GB + DE entries (lines 1-N pattern from PL/AE/SA)
- `packages/db/prisma/schema/tax.prisma` — TaxRate model + add TaxIdValidation model
- `packages/db/prisma/schema/organization.prisma` — add `isKleinunternehmer: boolean` field
- `packages/db/prisma/schema/contractor.prisma` — add `latestVatValidatedAt`, `latestVatValidationStatus` summary fields
- `packages/validators/src/legal/de.ts` — extend with `TAX_KLEINUNTERNEHMER_NOTICE` constant
- `packages/validators/src/legal/en.ts` (new) — `TAX_UK_REVERSE_CHARGE_NOTICE` constant + mirror the locked-phrase pattern
- `packages/validators/src/uk-validators.ts` + `de-validators.ts` — format+checksum from Phase 56 (local prefix check before API call)
- `packages/api/src/routers/invoice.ts` — invoice router; line creation pre-selects default rate + reverse-charge auto-detect hook
- `packages/api/src/routers/contractor.ts` — contractor router; validation trigger on save
- `packages/secrets/` — HMRC client credentials storage
- `.env.example` — add `HMRC_ENV`, `VIES_ENV`, `HMRC_CLIENT_ID_SECRET_PATH`, `HMRC_CLIENT_SECRET_SECRET_PATH`

### External API specs
- HMRC VAT Registration API — https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-registered-companies-api
- HMRC Fraud Prevention Headers spec — https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
- VIES REST API — https://ec.europa.eu/taxation_customs/vies/rest-api/
- VIES qualified confirmation spec (MwSt-Fragebogen pattern) — https://ec.europa.eu/taxation_customs/vies/help.html
- UK Post-Brexit reverse-charge guidance — HMRC VAT Notice 741A
- German §13b UStG reverse-charge — Umsatzsteuergesetz §13b (BMF guidance)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/gov-api/GovApiClient` abstract base (Phase 54) — extend with `HmrcVatClient` and `ViesClient` subclasses; inherits retry/cert-auth/audit/rate-limiting
- `packages/gov-api/audit-logger.ts` — override `emitAuditEntry` to persist HMRC/VIES calls to the `TaxIdValidation` table
- `packages/db/prisma/seed/tax-rates.ts` — TaxRate seed pattern (PL/AE/SA) — append GB + DE entries using the same shape
- `packages/validators/src/uk-validators.ts` — Phase 56 local UK VAT format+checksum (call before HMRC API to short-circuit invalid inputs)
- `packages/validators/src/de-validators.ts` — Phase 56 local USt-IdNr ISO-7064 validation (call before VIES to short-circuit)
- `packages/validators/src/legal/de.ts` — extend with `TAX_KLEINUNTERNEHMER_NOTICE`; CI guard asserts the new constant is present in invoice footer templates
- Existing einvoice profile pattern (ksef/zatca/peppol-ae) — mirrors the country-client-per-jurisdiction pattern for HMRC + VIES
- Existing `SecretStore` (Phase 52) — store HMRC OAuth client credentials; reuse for secret rotation
- Better Auth Organization model — `countryCode` field drives HMRC vs VIES dispatch

### Established Patterns
- `GovApiClient` subclass per government API (ksef, zatca, peppol → now HmrcVat + Vies)
- Append-only audit tables for compliance-sensitive data (Phase 51 ConsentRecord precedent)
- Denormalized summary fields on row for fast reads + source-of-truth audit table
- Environment-switched base URLs via `GovApiConfig.baseUrls[environment]`
- Rate-limited fetch with exponential backoff (`GovApiRetryConfig`)
- Zod-validated API response schemas at client boundary (defense against external API shape changes)

### Integration Points
- Contractor profile save — hook into the profile router mutation; trigger validation on vatRegistrationNumber or ustIdNr change
- Invoice line creation — pre-select default rate; fire reverse-charge auto-detection; optionally trigger staleness check + revalidate
- Invoice footer rendering — add conditional `TAX_STEUERSCHULDNERSCHAFT` / `TAX_UK_REVERSE_CHARGE_NOTICE` / `TAX_KLEINUNTERNEHMER_NOTICE` based on flags
- Organization settings — add Kleinunternehmer toggle (DE orgs only); drives invoice generation behavior
- Contractor profile display (Phase 56 CountryComplianceSection) — show latest validation status pill + 'Revalidate' button
- SecretStore — HMRC credentials; document rotation playbook
- Phase 61 (XRechnung) — will consume reverse-charge flags and VAT rate lookup this phase provides

</code_context>

<specifics>
## Specific Ideas

- HMRC fraud-prevention headers must carry tenant-identifying info (`Gov-Client-User-IDs` with organizationId) so HMRC can attribute requests despite shared platform credentials
- VIES qualified confirmation stores `confirmationRef` — required for German tax office audits (the "Bestätigungsanfrage" proof)
- Stale warning pill: yellow on profile (between green "valid" and red "invalid"); Warning Triangle icon + '{relative-time} ago' tooltip
- Locked phrase `TAX_STEUERSCHULDNERSCHAFT` (Phase 56) renders verbatim on DE invoice footer — CI guard already enforces presence via existing locked-phrases-guard test suite
- Reverse-charge reason prompt stores a free-text justification in invoice audit trail; free-text is sufficient (no enum) because override scenarios are diverse

</specifics>

<deferred>
## Deferred Ideas

- Periodic background revalidation (nightly cron on all active contractors) — deferred to a future phase; manual + invoice-time triggers suffice for v5.0
- HMRC Making Tax Digital (MTD) submission — out of scope (separate HMRC API, post-v5.0)
- VIES SOAP fallback — skip unless REST API proves unstable in production
- Automatic Kleinunternehmer detection from turnover — manual org toggle only; automation would need revenue tracking beyond Phase 57 scope
- Per-org HMRC credentials override — platform-wide only in v5.0; revisit if enterprise customers request tenant isolation
- Invoice email sending to HMRC MTD / BMF directly — separate phase (Peppol/XRechnung routing covers the B2G case in 61/62)
- Reverse-charge rule list for §13b expansion (beyond initial 5 service types) — add in a follow-up when customer scenarios demand it
- Storage of HMRC "registered company name" on successful validation for display-only use — consider in Phase 61 XRechnung (where seller name must match registered name)

### Reviewed Todos (not folded)
None — no pending todos matched Phase 57 scope.

</deferred>

---

*Phase: 57-government-api-clients*
*Context gathered: 2026-04-12*
