# Phase 86: Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing - Research

**Researched:** 2026-06-16
**Domain:** US year-end information-return loop — IRS TIN-Matching, 1099-NEC generation, IRIS XML e-file, Combined Federal/State Filing
**Confidence:** HIGH (in-tree patterns + IRS effective dates) / MEDIUM (exact IRIS XSD element names & SOAP operation signatures — re-verify against the downloaded TY2025/TY2026 schema package at execution time)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Manual-upload is the DEFAULT, TCC-independent transmit path. `buildIrisXml()` → `xsdValidate()` (against IRS XSDs, validated in CI mirroring XRechnung KoSIT) → admin downloads the validated `.xml` and uploads it to the IRS IRIS portal by hand. Ships with NO TCC; never blocks GA on the ~45-day enrollment clock.
- **D-02:** Live A2A is built but dark. The SOAP/MTOM A2A transmit + ack-poll is implemented behind a flag, exercised only once IRS TCC is approved. FIRE is documentation-only (legacy fallback note), no code.
- **D-03:** Transmitter-adapter seam mirroring the payment-export factory: a `TaxFilingTransmitter` interface with `ManualDownload` (default), `IrisA2A` (flag-gated), and `Vendor` (stub — Sovos / 1099Pro). One generation pipeline, swappable transmit tail.
- **D-04:** One ack parser, both paths. For manual filing, the admin uploads the acknowledgement file IRS returns; the SAME ack-parser used by the A2A path consumes it and updates submission status (Accepted / Rejected / Partial) + `writeAuditLog`.
- **D-05:** Trigger = on-demand admin batch + notify-only year-end cron. Admin runs "Generate 1099 batch" for a tax year, reviews, then files. A January cron only notifies the batch is due — never auto-generates or auto-transmits.
- **D-06:** Threshold aggregation basis = payments settled in the tax year, USD at payment date. Sum box-1 nonemployee comp by payment (settlement) date within the calendar tax year, converting any non-USD payout at the payment-date FX rate, aggregated per recipient per payer-org. Threshold from a tax-year-keyed config table (`$2,000` TY2026), not a constant.
- **D-07:** Box 4 (federal backup withholding) populated when the recipient's W-9 backup-withholding flag is set or a TIN C-notice/mismatch exists. The amount withheld is a Phase 88 concern; Phase 86 reports what is recorded.
- **D-08:** CORRECTED form = supersede, not mutate. A correction inserts a new immutable `Form1099Nec` row superseding the prior one (reuses P85 `TaxFormSubmission` immutable+supersede idiom). The original filed record is never edited.
- **D-09:** Recipient Copy-B PDF rendered with the existing `@react-pdf/renderer` infra. Delivery is portal-download gated on affirmative IRS electronic-delivery consent — no consent → flagged for paper/manual. The immutable PDF is archived either way.
- **D-10:** Run TIN-Match at W-9 intake AND revalidate the whole batch at year-end before 1099 generation. The 24h cache keeps re-checks cheap.
- **D-11:** Mock `TinMatchClient` behind an adapter seam; logic shipped; live client flag-gated. The 24h-cache + retry + admin-escalation logic is built fully against a `TinMatchClient` interface with a deterministic mock; the real IRS e-Services client sits behind a flag (PENDING), dark until PAF enrollment clears.
- **D-12:** Mismatch → auto-set backup-withholding flag + escalate; 1099 still generates. A TIN mismatch creates an admin escalation AND sets the recipient's backup-withholding flag. Never a hard block.
- **D-13:** CFSF auto-forward indicator + per-state config table + downloadable file for non-CFSF states. Set the CFSF state code in the IRIS B-records; maintain a per-state config table (CFSF participation + filing threshold + state-withholding-box rules). For the non-CFSF / direct-file states, produce a downloadable state output.
- **D-14:** Non-CFSF output = per-state data file (CSV/summary) + documented manual-portal guidance — no bespoke per-state e-file integrations or credentials.
- **D-15:** Whole surface gated on `module.us-expansion` via `require-us-expansion-flag.ts` + conditional `root.ts` spread. New flag(s) register PENDING in the signoff registry per FOUND7-02.
- **D-16:** Immutable + supersede archive for `Form1099Nec` (and IRIS submission records) — append-only, mirrors P85 `TaxFormSubmission` + `WhtCertificate`.
- **D-17:** Retention registration: register `Form1099Nec` → `'1099-NEC'` (4yr) in `MODEL_RETENTION_TYPE` (`packages/db/src/retention-policy.ts`). 7yr for backup-withholding records.
- **D-18:** Adviser-verify posture — 1099-NEC, IRIS output, threshold config, treaty/withholding figures ship with "needs jurisdiction-specific legal/tax-adviser verification before production deploy" annotations.
- **D-19:** Audit + idempotency — sign/transmit/correct/reveal/escalate go through `writeAuditLog`; batch-generation + transmit use `packages/api/src/lib/idempotency.ts` (reserve/complete/clear).
- **D-20:** i18n — admin/portal-facing strings at parity across en / en-US / de / pl / ar (RTL).

### Claude's Discretion
- Exact new Prisma models/columns: `Form1099Nec` (+ CORRECTED supersede chain), the IRIS submission/ack record, the tax-year threshold config table, the per-state CFSF config table — planner decides shapes (never add to `globalModels`; cross-org leak test per new model).
- The `TaxFilingTransmitter` / `TinMatchClient` interface signatures and where the seams live (`packages/integrations` base-adapter vs a finance-local factory like `peppol-adapter-factory`).
- IRIS XML builder mechanics (fast-xml-parser `XMLBuilder` vs hand-roll) and which IRS XSDs to bundle + how the CI XSD-validation job is wired (mirror `packages/einvoice` validator-bundle).
- FX-rate source for non-USD → USD payment-date conversion (reuse an existing rate source if present).
- 1099-NEC Copy-B PDF template layout (react-pdf), and the e-delivery-consent storage shape.
- Which specific states populate the non-CFSF direct-file set + the CFSF participation seed data.
- Whether TIN-match interactive (≤25) vs bulk (≤100k) mode is modeled now or left to the live-client phase.

### Deferred Ideas (OUT OF SCOPE)
- Live IRIS A2A transmit (SOAP/MTOM) — built but dark behind the A2A flag; activated when TCC approved.
- Live IRS e-Services TIN-Matching client — mock now; live behind a flag once PAF enrollment clears.
- Vendor transmitter (Sovos / 1099Pro) — stub seam only.
- Actual 24% backup-withholding payout reduction — flag recorded here; enforcement is Phase 88.
- Official W-9 / W-8BEN / W-8BEN-E intake-form PDFs — deferred to Phase 87. P86 renders only the 1099-NEC Copy-B.
- Bespoke per-state direct e-file integrations.
- FIRE system code — documentation-only legacy fallback; no implementation.
- 1042-S, US classification (federal/AB5/§530), Determination Letter, 1099-K tracker — Phase 87.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| US-FORM-03 | IRS TIN-Matching (e-Services) with 24h cache, retry, admin escalation on mismatch | TIN Matching Program (Pub 2108A): interactive ≤25 (immediate, 999/24h) vs bulk ≤100k (~24h); PAF enrollment + e-Services registration prerequisite; numerical response indicator per request → maps to `TinMatchClient` interface + mock + 24h cache. B-notice/CP2100 mechanics (Pub 1281) drive the mismatch → backup-withholding-flag + escalation logic. [VERIFIED: irs.gov] |
| US-FORM-04 | 1099-NEC per recipient at year-end, tax-year-keyed threshold ($2,000 TY2026 OBBBA), CORRECTED support, recipient PDF, audit-immutable archive | OBBBA $2,000 threshold effective payments after 2025-12-31; TY2025 stays $600; inflation-indexed from 2027 → tax-year-keyed config table. `supersedeAndInsert` idiom (`tax-form.service.ts`) = CORRECTED chain. Pub 1179 §4.6 permits black-ink substitute Copy B via react-pdf + mandates e-delivery consent. [VERIFIED: irs.gov] |
| US-FORM-05 | E-file via IRS IRIS (XML A2A, primary/mandatory) with TCC workflow doc, file build, transmit, ack parsing; FIRE legacy fallback only | FIRE decommissions 2026-12-31; TY2026 returns (filed early 2027) MUST use IRIS. IRIS A2A = SOAP-only + MTOM. Ack statuses: Accepted / Rejected / Processing / Partially Accepted / Accepted with Errors / Not Found + Error Information Group. Schema package from SOR; XSD-validate in CI (mirror `packages/einvoice`). [VERIFIED: irs.gov] |
| US-FORM-07 | Per-state 1099 filing for states requiring separate filing (CFSF where eligible) | CFSF state code in IRIS B-record (payee record) → IRS auto-forwards to participating states. ~18 direct-file/special-requirement states + MD (no longer accepts CFSF). Per-state config table + downloadable CSV for non-CFSF. [VERIFIED: irs.gov / MEDIUM on exact per-state list — re-verify TY2025 CF/SF participant list at execution] |
</phase_requirements>

## Summary

Phase 86 closes the US year-end information-return loop on the data captured in Phase 85. The architecture is dictated by a hard regulatory deadline and two independent IRS enrollment gates, both of which the locked posture (D-01/D-02/D-11) deliberately decouples from GA:

1. **FIRE is dead for this milestone.** The IRS decommissions FIRE on **2026-12-31**; TY2025 is the last FIRE filing year, and all **TY2026 returns (filed in early 2027 — exactly when v7.0 ships its year-end loop) MUST go through IRIS** [VERIFIED: irs.gov]. This definitively resolves backlog OPEN item #5 (which had FIRE/IRIS inverted): **IRIS is primary/mandatory; FIRE is documentation-only.** The 10-or-more-aggregate-returns e-file mandate already applies and continues under IRIS.

2. **The deterministic core ships; the credentialed tail is dark.** The XML generator, XSD validation (CI-bundled, mirroring `packages/einvoice` KoSIT), the single ack parser, TIN-match logic + 24h cache, batch aggregation, and the Copy-B PDF all ship and are fully testable with **no live IRS credentials**. Only two things are flag-gated dark: live IRIS A2A SOAP/MTOM transmit (needs an IRIS-A2A-specific TCC, ~45-day lead, separate from the portal TCC) and the live e-Services TIN-Matching client (needs PAF enrollment + e-Services registration). The manual-upload default (D-01) means a human downloads the XSD-validated XML and uploads via the IRIS portal — shipping a working product on day one.

3. **Every primitive already exists in-tree.** The XRechnung CII builder (`fast-xml-parser` `XMLBuilder` + `libxmljs2` XSD validation + CI-pinned schema bundle) is the exact template for IRIS XML; `tax-form.service.ts` `supersedeAndInsert` is the CORRECTED-form chain; `@react-pdf/renderer@4.5.1` + the `pdf-templates/*.tsx` + lazy `renderToBuffer` pattern is the Copy-B renderer; the payment-export format factory is the `TaxFilingTransmitter` seam; `peppol-adapter-factory` is the SSRF-safe pinned-URL client pattern; `ExchangeRate` model + `exchange-rate.ts` service is the payment-date FX source; `idempotency.ts`, `audit-writer.ts`, the cron registry, `retention-policy.ts`, and `require-us-expansion-flag.ts` are all wired and waiting.

**Primary recommendation:** Build a deterministic, fully-tested generation pipeline (`buildIrisXml → xsdValidate → ManualDownload`) behind `module.us-expansion`, mirroring `packages/einvoice` for XML+XSD and `tax-form.service.ts` for the immutable supersede chain. Register `Form1099Nec` in `MODEL_RETENTION_TYPE`. Keep live A2A (SOAP/MTOM) and live TIN-Match e-Services behind a second flag (`module.iris-efile` already exists PENDING — reuse it; do NOT mint a redundant `iris-a2a-transmit`). Treat the exact IRIS XSD element names and SOAP operation signatures as MEDIUM-confidence and re-verify against the downloaded TY2025/TY2026 schema package during execution.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TIN-Matching call + 24h cache + retry | API / Backend (`packages/api` service + adapter in `packages/integrations`) | DB (cache table or Redis TTL) | External IRS e-Services call; credential decrypt + SSRF-safe URL pinning is server-only. |
| TIN-mismatch escalation + backup-withholding flag | API / Backend | DB (flag column + escalation record) | Compliance state mutation; `writeAuditLog`. |
| 1099-NEC batch aggregation (box-1 by payment date, FX-converted) | API / Backend | DB (read settled payments + `ExchangeRate`) | Money aggregation + FX is domain logic; never client. |
| Tax-year threshold lookup | DB (config table) | API | Tax-year-keyed table, not a constant (D-06). |
| IRIS XML build + XSD validation | API / Backend | CI (XSD bundle + checksum guard) | Hand-built XML against IRS XSDs; validation also runs in CI. |
| IRIS A2A transmit (SOAP/MTOM) | API / Backend (flag-gated) | — | SOAP + cert auth; dark until TCC. |
| Manual-upload XML download | API / Backend → Browser (download) | R2 (archive) | Default path; admin downloads validated XML. |
| Ack file parse + status update | API / Backend | DB (submission status) | One parser, both paths (D-04). |
| Recipient Copy-B PDF render | API / Backend (`renderToBuffer`) | R2 (US tax-archive bucket) + Portal (gated download) | react-pdf is server-side; consent-gated portal download. |
| E-delivery consent capture | Portal (contractor self-service) | API → DB | Beneficial-recipient consents; mirrors P85 portal posture. |
| Per-state CFSF code in B-record / non-CFSF CSV | API / Backend | DB (per-state config table) | State filing logic; downloadable file is a server-generated artifact. |
| Year-end "batch due" reminder | Cron worker (notify-only) | — | Notify-only; never auto-files (D-05). |
| Admin batch UI / escalation surface | Frontend (`apps/web-vite`) | API (tRPC) | Staff dashboard; container→hook→component; i18n + WCAG states. |

## Standard Stack

### Core (all already in the monorepo — verified versions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | ^5.7.3 [VERIFIED: packages/einvoice/package.json] | Build IRIS XML via `XMLBuilder` | Already the repo's XML builder for XRechnung CII; "never string templates — concat XML produces entity-escape bugs" (generator.ts comment). |
| `libxmljs2` | ^0.37.0 [VERIFIED: packages/einvoice/package.json] | XSD-validate the IRIS XML against bundled IRS XSDs | Already the repo's XSD validator (KoSIT layer 1); uses `{ nonet: true, baseUrl }` + `noent:false` for SSRF/XXE safety. |
| `@react-pdf/renderer` | ^4.5.1 [VERIFIED: packages/api/package.json + installed node_modules] | Render recipient Copy-B PDF via `renderToBuffer` | Already renders IR35 SDS, DRV bundle, late-payment claim, GDPR notice. **NOTE: CONTEXT.md says 3.4.5 — STALE. Actual is 4.5.1.** |
| `@contractor-ops/logger` (Pino) | in-repo | Structured logging (no `console.*`) | Project mandate. `createCronLogger` for the reminder job. |
| Prisma 7 (`prisma-client`) | in-repo | `Form1099Nec`, IRIS submission/ack, threshold + per-state config models | Tenant-owning model convention; never `globalModels`. |
| tRPC v11 | in-repo | Staff batch procedures + portal consent/download procedures | `appRouter` (staff) conditional spread + `portalAppRouter` for consent. |

### Supporting (for the dark A2A SOAP path — flag-gated, lower priority)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SOAP/MTOM client | TBD — see Open Question #2 | IRIS A2A is SOAP-only + MTOM attachments | ONLY when building the dark live-transmit path. Evaluate `strong-soap`/`soap` vs hand-built SOAP envelope + multipart MTOM. **The repo has no SOAP client today** — and the manual-upload default means this is not on the GA critical path. Prefer a hand-built SOAP envelope (consistent with the "hand-build XML against XSDs" posture) over a heavy SOAP dependency unless MTOM multipart proves painful. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fast-xml-parser` XMLBuilder for IRIS | `xmlbuilder2` | No reason to add a new XML lib; the repo's convention + CI XSD pattern is `fast-xml-parser`. |
| Hand-built IRIS XML | Vendor SDK (Sovos / 1099Pro / Track1099) | D-03 keeps Vendor as a stub seam only — a fallback if TCC is never approved. Not the primary path; would add a credentialed external dependency. |
| New `iris-a2a-transmit` flag | Existing `module.iris-efile` (PENDING) | **`module.iris-efile` already exists in the registry + signoff (PENDING) and was registered in FOUND7-02 specifically for "IRIS A2A e-file."** Reuse it; do not mint a redundant flag. (See Assumptions Log A1.) |

**Installation:** No new runtime dependencies required for the GA (manual-upload) path — all libraries are already in the workspace. The only potential new dependency is a SOAP/MTOM helper for the dark A2A path; defer that decision to the A2A-build task and verify under the 7-day-release-age rule + slopcheck before adding.

**Version verification:** `@react-pdf/renderer` confirmed `4.5.1` from installed `node_modules` (npm registry query is blocked from repo root by the `.npmrc` min-release-age unit bug — use pnpm or `/tmp` if a fresh registry check is needed). `fast-xml-parser` and `libxmljs2` confirmed from `packages/einvoice/package.json`.

## Package Legitimacy Audit

> All GA-path packages are **already in the monorepo** (installed, version-pinned, 7-day-release-age enforced). No new external package is installed for the manual-upload default path. slopcheck was not run because no new package is being introduced for GA; the only candidate (a SOAP/MTOM helper) is deferred to the dark A2A-build task and MUST pass slopcheck + 7-day-release-age + typosquat check before adoption.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `fast-xml-parser` | npm | mature | very high | github.com/NaturalIntelligence/fast-xml-parser | n/a (already in-repo) | Approved (in workspace) |
| `libxmljs2` | npm | mature | high | github.com/marudor/libxmljs2 | n/a (already in-repo) | Approved (in workspace) |
| `@react-pdf/renderer` | npm | mature | very high | github.com/diegomura/react-pdf | n/a (already in-repo) | Approved (in workspace) |
| SOAP/MTOM helper (A2A only) | npm | TBD | TBD | TBD | DEFERRED | Flagged — planner adds `checkpoint:human-verify` before install on the dark A2A task; must pass slopcheck + 7-day-release-age + typosquat |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (SOAP/MTOM helper deferred, not yet selected)

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────────┐
   W-9 intake (P85 portal) │  TIN-MATCH (US-FORM-03)                          │
        │                  │  TinMatchClient (adapter seam)                   │
        ▼                  │   ├─ MockTinMatchClient  (default, deterministic) │
  validate name/TIN ──────►│   └─ EServicesTinMatchClient (flag-gated, dark)   │
                           │  24h cache → retry → numerical response indicator│
                           └───────────────┬─────────────────────────────────┘
                                           │ mismatch
                                           ▼
                         set backup-withholding flag + admin escalation
                         (NEVER hard-block; B-notice/CP2100 logic)  [D-12]
                                           │
   ════════════ YEAR-END BATCH (admin-triggered) ════════════ + notify-only cron [D-05]
                                           │
                                           ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │  1099-NEC GENERATION (US-FORM-04)                                  │
        │  read settled payments → aggregate box-1 by PAYMENT DATE           │
        │  per recipient per payer-org → FX-convert non-USD at payment-date  │
        │  rate (ExchangeRate svc) → compare to tax-year threshold table     │
        │  ($2,000 TY2026 / $600 TY2025) → revalidate TIN-match (D-10)       │
        └───────┬──────────────────────────────────────────────┬───────────┘
                │ above threshold                                │
                ▼                                                ▼
   immutable Form1099Nec row                          Recipient Copy-B PDF
   (CORRECTED = supersedeAndInsert) [D-08]            (@react-pdf renderToBuffer, Pub 1179) [D-09]
                │                                                │
                │                                  ┌─────────────┴──────────────┐
                │                                  │ e-delivery consent? (Pub    │
                │                                  │ 1179 §4.6)                  │
                │                                  ├─ yes → portal download      │
                │                                  └─ no  → flag paper/manual    │
                │                                  (PDF archived to R2 either way)│
                ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │  buildIrisXml()  (fast-xml-parser XMLBuilder)                       │
        │   - Transmission Manifest (VersionNum/VersionDt in payload TY2025+) │
        │   - Form data file: payee (B-record) incl. CFSF state code [D-13]   │
        │  xsdValidate()  (libxmljs2 ↔ bundled IRS XSDs, CI-pinned checksum)  │
        └───────┬────────────────────────────────────────────────────────────┘
                │  TaxFilingTransmitter seam  [D-03]
       ┌────────┼─────────────────────────┬────────────────────────┐
       ▼        ▼                          ▼                        ▼
 ManualDownload  IrisA2A (DARK)        Vendor (STUB)        (per-state non-CFSF)
 (DEFAULT)       SOAP+MTOM, flag-gated  Sovos/1099Pro       CSV/summary download [D-14]
 download .xml   needs TCC (~45d)       fallback if no TCC  + manual-portal guidance
       │              │
       │              ▼
       │        IRS IRIS A2A web service (SendSubmissions → poll → GetAck)
       ▼              │
 admin uploads        │
 to IRIS portal       │
       │              ▼
       └──────►  ACK FILE  ──────►  ONE ack parser  [D-04]
                (Accepted / Rejected / Processing / Partially Accepted /
                 Accepted with Errors / Not Found  +  Error Information Group)
                          │
                          ▼
              update submission status + writeAuditLog
              (CFSF state codes auto-forwarded by IRS for participating states)
```

### Recommended Project Structure
```
packages/api/src/
├── services/
│   ├── tin-match.service.ts            # 24h cache + retry + escalation; uses TinMatchClient seam
│   ├── form-1099-nec.service.ts        # batch aggregation + supersede chain (mirror tax-form.service.ts)
│   ├── iris-ack-parser.ts              # ONE parser, both paths (D-04)
│   └── tax-filing-transmitter.ts       # factory: ManualDownload | IrisA2A | Vendor (mirror payment-export factory)
├── pdf-templates/
│   └── form-1099-nec-copy-b.tsx        # react-pdf substitute Copy B (Pub 1179)
└── routers/finance/                    # staff batch procedures (conditional us-expansion spread)

packages/integrations/src/adapters/
├── tin-match/
│   ├── tin-match-client.ts             # interface
│   ├── mock-tin-match-client.ts        # deterministic mock (default)
│   └── eservices-tin-match-client.ts   # flag-gated live (extends base-adapter; pinned URL)

packages/iris/  (NEW package — OR a profile under an existing package; planner decides)
├── src/
│   ├── generator.ts                    # buildIrisXml (fast-xml-parser XMLBuilder)
│   ├── validator.ts                    # xsdValidate (libxmljs2, nonet+baseUrl, XXE-safe)
│   └── schema-bundle/                  # IRS IRIS XSDs (TY2025/TY2026) + checksums.txt + source.txt
└── scripts/
    └── verify-iris-schema-checksums.ts # CI guard pinning XSD SHA-256 (mirror recompile-kosit-schematron.ts)

packages/db/prisma/schema/
└── tax.prisma  (extend)                # Form1099Nec, IrisSubmission, IrisAck, Tax1099Threshold, StateFilingConfig

apps/cron-worker/src/jobs/
├── handlers/year-end-1099-reminder.ts  # notify-only (createCronLogger)
└── registry.ts (extend getJobDefinitions + new CRON_*_SCHEDULE env)
```

### Pattern 1: Hand-built XML → XSD-validate-in-CI (mirror `packages/einvoice/xrechnung-de`)
**What:** Build IRIS XML with `fast-xml-parser` `XMLBuilder`, validate against bundled IRS XSDs with `libxmljs2`, pin XSD SHA-256 in a CI guard, exercise via vitest.
**When to use:** The entire IRIS XML generation + validation path (US-FORM-05).
**Key safety invariants from the in-tree validator (carry them over verbatim):**
```typescript
// Source: packages/einvoice/src/profiles/xrechnung-de/validator.ts
//   * libxmljs2.parseXml uses { nonet: true, baseUrl: <bundle dir> } so
//     external <xs:import schemaLocation="http://..."> is impossible (SSRF).
//   * default noent:false means entities are NOT expanded (XXE mitigation).
// Bundle artefacts loaded once via a cached promise; the
// recompile-kosit-schematron.ts CI guard pins their SHA-256.
// Lazy getBundleDir() — turbopack/tsx strips import.meta.dirname at module load,
// so resolve schema paths inside a function, not at top level.
```

### Pattern 2: Immutable supersede chain for CORRECTED forms (mirror `tax-form.service.ts`)
**What:** A CORRECTED 1099 flips prior ACTIVE rows to SUPERSEDED in a transaction, then inserts the new ACTIVE row. Never mutate a filed record.
**When to use:** US-FORM-04 CORRECTED-form support (D-08).
```typescript
// Source: packages/api/src/services/tax-form.service.ts:181 (supersedeAndInsert)
// (1) flips every prior ACTIVE row for this contractor+formType to SUPERSEDED,
// then (2) inserts the new row as ACTIVE. Supersede MUST run before the insert,
// inside the same $transaction. snapshotJson holds the captured fields.
```

### Pattern 3: Format-factory transmitter seam (mirror `payment-export.ts`)
**What:** A `TaxFilingTransmitter` factory selects `ManualDownload | IrisA2A | Vendor` exactly as `payment-export.ts` selects `generateElixir | generateSepaXml | generateSwiftXml | generateBacsStandard18`. One generation pipeline, swappable tail.
**When to use:** US-FORM-05 transmit (D-03).

### Pattern 4: SSRF-safe credentialed adapter (mirror `peppol-adapter-factory.ts`)
**What:** Decrypt credentials from `integrationConnection.credentialsRef`, select a **pinned literal base URL** by environment (never user-influenced), instantiate the client. Use for the live e-Services TIN-Match client + IRIS A2A endpoint.
```typescript
// Source: packages/api/src/services/peppol-adapter-factory.ts
// SSRF-safety: the base URL is one of two pinned literal strings, selected by
// the credential blob's `environment` field (validated via Zod upstream).
// No user input can influence the URL path. decryptCredentials(ref, 'peppol').
```

### Pattern 5: Adapter + mock + flag-gated live client (mirror integration adapters)
**What:** Ship the full logic against an interface with a deterministic mock as the default; the live client sits behind a PENDING flag, dark until enrollment clears.
**When to use:** Both `TinMatchClient` (D-11) and the IRIS A2A transmit (D-02).

### Anti-Patterns to Avoid
- **String-concatenating IRIS XML.** The in-tree generator comment is explicit: concat XML produces entity-escape bugs that surface as confusing XSD layer-1 failures. Always use `XMLBuilder`.
- **Hard-blocking on a TIN mismatch.** D-12: mismatch sets the backup-withholding flag + escalates; the 1099 still generates with the TIN as captured.
- **Auto-filing from the cron.** D-05: the year-end cron is notify-only; a human reviews before any immutable archive + IRS file.
- **Embedding the threshold as a constant.** D-06: tax-year-keyed config table. The backlog "$600" is stale for TY2026 (OBBBA = $2,000); TY2025 is still $600.
- **Rendering IRS Copy A as a PDF.** Copy A goes via IRIS e-file (XML), never our PDF. We render only the recipient **Copy B** (substitute, black ink, Pub 1179). Copy A red-ink scannable forms are irrelevant when e-filing.
- **Fetching external XSDs at validation time.** Bundle the XSDs, pin checksums, `nonet:true` (SSRF), `noent:false` (XXE).
- **Minting a redundant `iris-a2a-transmit` flag.** `module.iris-efile` already exists PENDING for exactly this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML serialization | String templates / manual escaping | `fast-xml-parser` `XMLBuilder` | Entity-escaping bugs surface as opaque XSD failures (in-tree comment). |
| XSD validation | Custom schema walker | `libxmljs2` + bundled XSDs | Already proven for KoSIT; SSRF/XXE-safe config exists. |
| PDF generation | Headless-Chrome / pdfkit | `@react-pdf/renderer` `renderToBuffer` | Already the repo's PDF stack; byte-reproducible templates exist. |
| FX conversion | New rate fetcher | `ExchangeRate` model + `exchange-rate.ts` service + `exchange-rates` cron | Payment-date rate already sourced + cached in-repo. |
| Idempotent batch | Custom dedupe | `idempotency.ts` reserve/complete/clear | Retried batch never double-files. |
| Audit trail | Ad-hoc logging | `writeAuditLog` (+ `tx` in transactions) | Mandated for sensitive mutations; transactional. |
| Retention enforcement | New purge logic | `MODEL_RETENTION_TYPE` + `data-purge` chokepoint | `1099-NEC`(4yr)/`backup-withholding`(7yr) already in `RETENTION_YEARS`. |
| US TIN/EIN/SSN validation | New validators | `packages/validators/src/us-validators.ts` (`isValidEin`, `isValidSsn`) | Added in P84; extend, don't duplicate. |
| Per-state e-file integrations | Bespoke state APIs | CFSF auto-forward + per-state CSV/summary | D-14: no per-state credentials; CFSF does the heavy lifting. |
| IRIS A2A protocol | A reverse-engineered transport | Manual-upload default (D-01) | The XSD-validated XML + human portal upload ships with no TCC. |

**Key insight:** This phase is almost entirely a recomposition of existing in-tree patterns. The genuinely novel work is (a) obtaining + bundling the correct IRS IRIS XSDs and learning their element structure, and (b) the dark SOAP/MTOM A2A transport — and the locked posture deliberately keeps (b) off the GA critical path.

## Runtime State Inventory

> This is a greenfield feature surface (new models, new services), NOT a rename/refactor/migration. No existing runtime state is renamed. The closest "state" concern is the retention-map registration, covered below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New tables only (`Form1099Nec`, IRIS submission/ack, threshold + per-state config). No existing data renamed. | None — additive migration. |
| Live service config | `module.iris-efile` flag already PENDING in `signoff-registry-flags.json` + `flags-core.ts`. No Unleash-UI-only state created this phase (flags ship dark). | Confirm `module.iris-efile` covers A2A; do NOT add a duplicate flag (Assumptions Log A1). |
| OS-registered state | New cron job (`year-end-1099-reminder`) registered in `getJobDefinitions` + a new `CRON_*_SCHEDULE` env. No OS scheduler. | Add env to `.env.example` + cron-worker env schema; register handler. |
| Secrets/env vars | Live e-Services TIN-Match + IRIS A2A credentials stored encrypted via `integrationConnection.credentialsRef` (existing pattern). New `CRON_YEAR_END_1099_*_SCHEDULE` env. | New cron env → `.env.example` + package env schema; credentials use existing encrypted store. |
| Build artifacts | New IRS XSD schema bundle committed under the IRIS package (mirrors `validator-bundle/`), with a `checksums.txt` + CI guard. | Commit XSDs + checksum guard; verify SHA-256 in CI. |

## Common Pitfalls

### Pitfall 1: Treating TY2025 and TY2026 thresholds as the same
**What goes wrong:** Seeding the threshold table with $2,000 for all years, or leaving the stale $600 constant.
**Why it happens:** OBBBA raised the threshold from $600 to $2,000 **only for payments made after 2025-12-31**. TY2025 (filed early 2026) is still $600; TY2026 (filed early 2027) is $2,000; from 2027 it's inflation-indexed.
**How to avoid:** Seed the tax-year-keyed table with `TY2025: $600, TY2026: $2,000`. Same threshold value also governs backup-withholding triggering under OBBBA. [VERIFIED: irs.gov / multiple tax-advisory sources]
**Warning signs:** A 1099 generated (or suppressed) at the wrong dollar cut-off for a given tax year.

### Pitfall 2: FIRE/IRIS inversion (the backlog's original error)
**What goes wrong:** Building FIRE as primary or assuming FIRE survives.
**Why it happens:** Older guidance (and the v7.0 backlog OPEN item #5) had FIRE as primary with IRIS "ready." That is now wrong.
**How to avoid:** IRIS is primary/mandatory for TY2026 (FIRE decommissions 2026-12-31; TY2025 is FIRE's last year). FIRE = documentation-only legacy note. [VERIFIED: irs.gov, Thomson Reuters, Ice Miller, Sovos]
**Warning signs:** Any FIRE code in the plan.

### Pitfall 3: Two separate IRS enrollment gates conflated
**What goes wrong:** Assuming one credential unlocks both TIN-Matching and IRIS transmit.
**Why it happens:** Both are "IRS e-Services," but they are distinct enrollments.
**How to avoid:** **TIN-Matching needs PAF (Payer Account File) listing + e-Services registration of the Principal/Responsible Official.** **IRIS A2A transmit needs an IRIS-A2A-specific TCC** (via the IR Application for TCC), separate from the IRIS portal TCC, ~45-day lead, plus passing the IRIS Assurance Testing System (ATS) communication test. Both are plan-phase operational checklist items; both keep their live client dark until cleared. [VERIFIED: irs.gov Pub 2108A + IRIS guidance]
**Warning signs:** A single "IRS credentials" task in the plan instead of two.

### Pitfall 4: Validating against the wrong-year schema
**What goes wrong:** XSD-validating TY2026 returns against a TY2024 schema package.
**Why it happens:** The IRS revs the schema per tax year (TY2025 = v2.0; VersionNum/VersionDt moved into the payload manifest as of TY2025). Schema packages are released late in the year (TY2025 schema posted 2025-11-06 to the SOR).
**How to avoid:** Bundle the schema package matching the tax year being filed; the IRIS submission record should record the schema VersionNum/VersionDt it was built against. **Re-verify the exact TY2026 schema (likely posted ~Nov 2026) at execution time.** [VERIFIED: irs.gov IRIS working-group materials]
**Warning signs:** Validation passing against an old schema that the IRS portal then rejects.

### Pitfall 5: CFSF state-list drift + MD special case
**What goes wrong:** Hard-coding a CFSF participant list that's gone stale, or auto-forwarding to a state that no longer accepts CFSF.
**Why it happens:** The CF/SF participant list changes year to year (RI joined for TY2025; **Maryland participates in name but no longer processes CFSF files and requires direct filing**). Many CFSF states ALSO have their own direct-filing requirements when state tax is withheld.
**How to avoid:** Drive CFSF participation + per-state direct-filing requirement from the **per-state config table** (D-13), annotated adviser-verify, and re-verify against the current-year IRS CF/SF coordinator FAQ + Pub 1220/IRIS state-record guidance at execution. [VERIFIED: irs.gov / MEDIUM on exact per-state list]
**Warning signs:** A recipient's state filing silently dropped because the code assumed CFSF coverage.

### Pitfall 6: Furnishing Copy B electronically without affirmative consent
**What goes wrong:** Emailing/portal-delivering the 1099 PDF without recorded consent.
**Why it happens:** Pub 1179 §4.6 requires affirmative recipient consent (made electronically, demonstrating the recipient can access the format) before electronic furnishing.
**How to avoid:** D-09 already gates portal download on stored consent; no consent → flag paper/manual. Capture consent in a structured shape with timestamp (mirror the P85 ESIGN attestation idiom). [VERIFIED: irs.gov Pub 1179]
**Warning signs:** A consent boolean with no audit/timestamp, or a download path that doesn't check it.

### Pitfall 7: SSRF/XXE in XML/XSD handling
**What goes wrong:** External entity expansion or schema fetch over the network.
**How to avoid:** Reuse the in-tree validator config verbatim: `libxmljs2.parseXml({ nonet: true, baseUrl })`, default `noent:false`. Bundle XSDs locally; never fetch `<xs:import schemaLocation="http://...">`. [VERIFIED: packages/einvoice/.../validator.ts]
**Warning signs:** Any `schemaLocation` pointing at a URL; `noent:true`.

## Code Examples

### react-pdf recipient PDF (lazy renderToBuffer)
```typescript
// Source: packages/api/src/services/late-payment-claim-pdf.ts:86 + classification-document-render.ts:117
const { renderToBuffer } = await import('@react-pdf/renderer');
const pdfBuffer = await renderToBuffer(Form1099NecCopyBDocument({ /* ...props */ }));
// Lazy dynamic import keeps react-pdf out of cold paths; templates live in pdf-templates/*.tsx
```

### Immutable supersede insert (CORRECTED chain)
```typescript
// Source: packages/api/src/services/tax-form.service.ts (supersedeAndInsert, status flip in a tx)
await prisma.$transaction(async (tx) => {
  await tx.taxFormSubmission.updateMany({
    where: { organizationId, contractorId, /* discriminator */, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  });
  await tx.taxFormSubmission.create({ data: { /* ... */ status: 'ACTIVE', snapshotJson } });
});
// The Form1099Nec CORRECTED flow mirrors this exactly.
```

### Retention registration (closes the P83 wiring point)
```typescript
// Source: packages/db/src/retention-policy.ts
// RETENTION_YEARS already has '1099-NEC': 4 and 'backup-withholding': 7.
// MODEL_RETENTION_TYPE ships EMPTY. Register the new model:
export const MODEL_RETENTION_TYPE: Partial<Record<string, RetainedRecordType>> = {
  Form1099Nec: '1099-NEC',
  // backup-withholding-bearing records (7yr) register here too
};
// Form1099Nec must ALSO join softDeleteModels for the chokepoint to see it.
```

### Format-factory transmitter selection (shape)
```typescript
// Mirror: packages/api/src/services/payment-export.ts (generateElixir | generateSepaXml | ...)
interface TaxFilingTransmitter { transmit(xml: Buffer, ctx): Promise<TransmitResult>; }
// factory: 'manual' -> ManualDownload (default) | 'iris-a2a' -> IrisA2A (flag-gated) | 'vendor' -> stub
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FIRE system e-file (primary) | IRIS XML A2A (primary/mandatory) | FIRE decommissions 2026-12-31; IRIS mandatory for TY2026 | This phase builds IRIS only; FIRE = doc-only. Resolves backlog OPEN #5. |
| $600 1099-NEC/MISC threshold | $2,000 (OBBBA), inflation-indexed from 2027 | Payments after 2025-12-31 (TY2026) | Tax-year-keyed table; TY2025 stays $600. |
| 250-return paper-vs-electronic line | 10-return aggregate e-file mandate | TY2023+ | E-file mandate already in force; continues under IRIS. |
| IRIS schema VersionNum/VersionDt in message metadata | Moved into payload manifest | TY2025 (schema v2.0) | Builder must emit VersionNum/VersionDt in the payload manifest. |

**Deprecated/outdated:**
- **FIRE**: decommissioned 2026-12-31; no code.
- **Backlog "$600" threshold** (US-FORM-04 wording): stale — corrected to $2,000 TY2026 in REQUIREMENTS.md line 19.
- **CONTEXT.md "@react-pdf/renderer@3.4.5"**: stale — actual installed version is 4.5.1.
- **Backlog "irs-fire-efile" flag**: the FIRE flag is moot; `iris-efile` is the live flag.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reuse the existing `module.iris-efile` flag (PENDING) for the dark A2A transmit instead of minting `iris-a2a-transmit`. | Standard Stack / User Constraints | LOW — if the planner/user prefers a dedicated transmit sub-flag for granularity, add `iris-a2a-transmit` as a second flag; either way `module.iris-efile` is the namespace gate already registered in FOUND7-02. Needs a one-line confirmation in plan-phase. |
| A2 | The dark A2A SOAP/MTOM path should use a hand-built SOAP envelope + multipart MTOM rather than a heavy SOAP npm dependency. | Supporting stack | MEDIUM — depends on how painful MTOM multipart proves. Off the GA critical path; decide at the A2A-build task. |
| A3 | Per-state non-CFSF direct-file set is ~18 special-requirement states + MD; the exact list must be seeded from the current-year IRS CF/SF FAQ. | Per-state filing | MEDIUM — the list drifts annually; the per-state config table + adviser-verify annotation contains the risk. |
| A4 | TIN-match interactive (≤25) vs bulk (≤100k) mode can be modeled as a single `TinMatchClient` interface now, with the live client deferred. | TIN-Match | LOW — both modes share the same name/TIN → response-indicator contract; the mock encodes the indicators. |
| A5 | The exact IRIS XSD element names (manifest, B-record, CFSF state-code field) follow the TY2025 v2.0 schema; planner must re-derive from the downloaded schema package, not from this doc. | Architecture / Pitfall 4 | MEDIUM — IRS schema is authoritative; this doc gives structure not exact element names. Re-verify at execution. |

## Open Questions

1. **Exact IRIS XSD element/structure for the 1099-NEC payload (manifest + B-record + CFSF state code).**
   - What we know: A2A is XML; each form has its own XSD in the schema package; TY2025 = v2.0; VersionNum/VersionDt in payload manifest; `OriginalReceiptId` in the manifest for replacements; B-record (payee) carries the CFSF state code.
   - What's unclear: exact element names + the CFSF state-code field path.
   - Recommendation: Download the TY2025/TY2026 IRIS Schema & Business Rules package from the IRS Secure Object Repository (SOR) / the IRIS Schemas and Business Rules page on irs.gov as a plan-phase task; bundle + checksum-pin it; derive element names from the XSDs + the TY2025 ATS examples (public FOIA PDF). Treat this doc's structure as MEDIUM-confidence scaffolding.

2. **A2A SOAP/MTOM transport mechanics (dark path).**
   - What we know: IRIS A2A is SOAP-only + MTOM attachments; submit-then-poll (SendSubmissions → GetAcknowledgement-style flow); needs an IRIS-A2A TCC + ATS communication test; cert-based auth.
   - What's unclear: exact WSDL/operation signatures, endpoint URLs, MTOM packaging specifics — Publication 5718 is the authoritative spec (binary PDF; fetch + read at execution).
   - Recommendation: This is off the GA critical path (manual-upload default). Build the dark path against Pub 5718 + the WSDL when the TCC clears; prefer a hand-built SOAP envelope consistent with the hand-built-XML posture; only add a SOAP npm dep if MTOM multipart proves painful (slopcheck + 7-day-age gate).

3. **Current-year CF/SF participant list + per-state direct-file requirements.**
   - What we know: ~32 CF/SF participants for TY2025 (incl. RI new); MD participates in name but requires direct filing; ~18 CFSF states have additional state-specific direct requirements.
   - What's unclear: the authoritative, current per-state matrix (changes annually).
   - Recommendation: Seed the per-state config table from the IRS CF/SF coordinator FAQ + Pub 1220/IRIS state guidance at plan time; annotate adviser-verify; re-verify per tax year.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `fast-xml-parser` | IRIS XML build | ✓ (workspace) | 5.7.3 | — |
| `libxmljs2` | XSD validation | ✓ (workspace) | 0.37.0 | — |
| `@react-pdf/renderer` | Copy-B PDF | ✓ (installed) | 4.5.1 | — |
| `ExchangeRate` model + `exchange-rate.ts` | FX conversion to USD at payment date | ✓ (in-tree) | — | — |
| Prisma 7 / Postgres 17 | new models | ✓ | — | — |
| IRS IRIS XSD schema package (TY2025/26) | XSD validation | ✗ (must download from SOR) | TY2025 v2.0 | None — required artifact; plan-phase download task |
| IRS IRIS-A2A TCC | live A2A transmit (dark) | ✗ | — | Manual-upload default (D-01) — GA does not block |
| IRS PAF / e-Services registration | live TIN-Match (dark) | ✗ | — | Mock client default (D-11) — GA does not block |
| SOAP/MTOM helper | live A2A transmit (dark) | ✗ (TBD) | — | Hand-built SOAP envelope |

**Missing dependencies with no fallback:**
- IRS IRIS XSD schema package — must be downloaded + bundled (plan-phase task). Everything downstream (XML build, XSD validation, CI guard) depends on it.

**Missing dependencies with fallback:**
- IRIS-A2A TCC → manual-upload default (ships with no TCC).
- PAF / e-Services registration → deterministic mock TIN-Match client.
- SOAP/MTOM helper → hand-built SOAP envelope (dark path only).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.5 (turbo-orchestrated: `pnpm test` → `turbo test`) |
| Config file | `packages/api/vitest.config.ts`; new IRIS package would add its own (mirror `packages/einvoice/vitest.config.ts`) |
| Quick run command | `pnpm --filter @contractor-ops/api test <path>` (scope by path; NEVER unscoped web-vite) |
| Full suite command | `pnpm test` (turbo → vitest across packages) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| US-FORM-03 | Mock TinMatchClient returns indicator; mismatch sets backup-withholding flag + escalates, never blocks | unit | `pnpm --filter @contractor-ops/api test tin-match.service` | ❌ Wave 0 |
| US-FORM-03 | 24h cache hit avoids re-call; retry on transient failure | unit | `pnpm --filter @contractor-ops/api test tin-match.service` | ❌ Wave 0 |
| US-FORM-04 | Box-1 aggregated by payment date, FX-converted, per recipient per payer-org | unit | `pnpm --filter @contractor-ops/api test form-1099-nec.service` | ❌ Wave 0 |
| US-FORM-04 | Threshold table: $600 TY2025 vs $2,000 TY2026 gates generation correctly | unit | `pnpm --filter @contractor-ops/api test form-1099-nec.service` | ❌ Wave 0 |
| US-FORM-04 | CORRECTED = supersede chain (prior ACTIVE → SUPERSEDED, new ACTIVE inserted) | unit | `pnpm --filter @contractor-ops/api test form-1099-nec.service` | ❌ Wave 0 |
| US-FORM-04 | Copy-B PDF renders to a buffer (smoke) | unit | `pnpm --filter @contractor-ops/api test form-1099-nec-copy-b` | ❌ Wave 0 |
| US-FORM-04 | Portal download gated on e-delivery consent | unit | `pnpm --filter @contractor-ops/api test` (portal procedure) | ❌ Wave 0 |
| US-FORM-05 | `buildIrisXml` output passes XSD validation against bundled IRS XSDs | unit | `pnpm --filter <iris-pkg> test validator` | ❌ Wave 0 |
| US-FORM-05 | XSD bundle checksum guard (SHA-256 pinned) | unit/CI | `pnpm --filter <iris-pkg> test` + CI guard | ❌ Wave 0 |
| US-FORM-05 | ONE ack parser maps all 6 statuses (Accepted/Rejected/Processing/Partially Accepted/Accepted with Errors/Not Found) + Error Information Group | unit | `pnpm --filter @contractor-ops/api test iris-ack-parser` | ❌ Wave 0 |
| US-FORM-05 | TaxFilingTransmitter factory selects ManualDownload by default; IrisA2A only when flag-gated | unit | `pnpm --filter @contractor-ops/api test tax-filing-transmitter` | ❌ Wave 0 |
| US-FORM-05 | Idempotent transmit — retried batch does not double-file | unit | `pnpm --filter @contractor-ops/api test` (idempotency) | ❌ Wave 0 |
| US-FORM-07 | CFSF state code emitted in B-record for participating states | unit | `pnpm --filter <iris-pkg> test generator` | ❌ Wave 0 |
| US-FORM-07 | Non-CFSF states produce a downloadable CSV/summary | unit | `pnpm --filter @contractor-ops/api test` (state-filing) | ❌ Wave 0 |
| US-INFRA-03 | `Form1099Nec` retention registration → 4yr purge cutoff; 7yr for backup-withholding | unit | `pnpm --filter @contractor-ops/db test retention-policy` | partial (engine tested w/ fixture; new model entry ❌ Wave 0) |
| D-15 (cross) | Surface FORBIDDEN when `module.us-expansion` disabled; conditional spread | security/unit | `pnpm --filter @contractor-ops/api test` (us-expansion gate) | ❌ Wave 0 |
| D-16 (cross) | Cross-org leak test per new model (no cross-tenant read) | security | `*.security.test.ts` (mirror `tenant-isolation-extra.security.test.ts`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the scoped quick-run for the touched service (`pnpm --filter @contractor-ops/api test <path>`).
- **Per wave merge:** `pnpm test` (turbo full suite) + `pnpm typecheck --filter=@contractor-ops/api` + `pnpm check:wiki-brain`.
- **Phase gate:** full suite green + `pnpm security:scan` + XSD-validation tests green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/tin-match.service.test.ts` — US-FORM-03 (cache/retry/escalation/no-block)
- [ ] `packages/api/src/services/__tests__/form-1099-nec.service.test.ts` — US-FORM-04 (aggregation/threshold/supersede)
- [ ] `packages/api/src/pdf-templates/__tests__/form-1099-nec-copy-b.test.tsx` — US-FORM-04 (render smoke)
- [ ] `packages/api/src/services/__tests__/iris-ack-parser.test.ts` — US-FORM-05 (all 6 statuses + errors)
- [ ] `packages/api/src/services/__tests__/tax-filing-transmitter.test.ts` — US-FORM-05 (factory default/flag)
- [ ] `<iris-pkg>/src/__tests__/generator.test.ts` + `validator.test.ts` — US-FORM-05/07 (build + XSD pass + CFSF code)
- [ ] `<iris-pkg>/scripts/verify-iris-schema-checksums.ts` — CI guard pinning XSD SHA-256
- [ ] `packages/api/src/__tests__/security/tax-filing-tenant-isolation.security.test.ts` — D-16 cross-org leak per new model
- [ ] IRS IRIS XSD schema bundle + `checksums.txt` + `source.txt` (download from SOR — required artifact, not a test file)
- [ ] Deterministic TIN-match mock fixtures (matched / mismatched / invalid indicators)

## Security Domain

> `security_enforcement` absent from `.planning/config.json` → treated as enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth session → tenant from session (never client input); live IRS clients use cert/credential store. |
| V3 Session Management | yes | Existing session + `module.us-expansion` gate; portal magic-link for consent. |
| V4 Access Control | yes | `CONTRACTOR_PII:READ` for TIN reveal (P84); staff-router-only PII; per-org tenant scoping; cross-org leak test per new model (D-16). |
| V5 Input Validation | yes | Zod on every tRPC procedure; `safeParse` on uploaded ack files; `us-validators.ts` for TIN/EIN/SSN; `.strict()` DTOs. |
| V6 Cryptography | yes | Encrypted SSN column (P84) + `decryptCredentials` for IRS client creds; never hand-roll. |
| V12 Files/Resources | yes | Uploaded ack-file parsing must be XXE/SSRF-safe (`noent:false`, `nonet:true`); bundled XSDs, no network schema fetch. |
| V13 API / Web Service | yes | A2A SOAP endpoint URL pinned (no user influence); MTOM attachment size limits. |

### Known Threat Patterns for {Node/tRPC/Prisma + XML/PDF + external IRS client}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XXE via uploaded ack file or crafted XML | Tampering / Info-disclosure | `libxmljs2` default `noent:false`; XXE-safe SVRL/ack normalizer (mirror `svrl-normalizer.ts`). |
| SSRF via `<xs:import schemaLocation="http://...">` or A2A URL | Info-disclosure / Tampering | `nonet:true` + `baseUrl` (bundled XSDs); pinned literal A2A base URL (peppol-adapter-factory pattern). |
| Cross-tenant 1099 read (IDOR/BOLA) | Info-disclosure | `organizationId` invariant on every new model; `.security.test.ts` cross-org leak test. |
| TIN/SSN exposure in logs or PDF artifact | Info-disclosure | Pino structured logging never logs full TIN; PDF shows masked recipient TIN per Pub 1179 (last 4) unless RBAC-gated. |
| Mass-assignment of `organizationId`/money fields via tRPC input | Tampering / Elevation | `.strict()` Zod DTOs; tenant from session. |
| Double-filing on retried batch | Tampering | `idempotency.ts` reserve/complete/clear (D-19). |
| Tampered immutable record (edited filed 1099) | Tampering / Repudiation | Append-only supersede chain (D-08/D-16); `writeAuditLog`. |
| Premature/unauthorized auto-file | Repudiation | Notify-only cron (D-05); human-in-the-loop before immutable archive + IRS file. |
| Recipient PDF furnished without consent | Compliance / Repudiation | Pub 1179 §4.6 consent gate (D-09) with timestamped audit. |

## Project Constraints (from CLAUDE.md)

- `semble search` before grep; **MUST Read before Edit/Write** on existing files; Edit > Write; no sed/script bulk replace; minimal diff.
- No `console.*` in app source — `@contractor-ops/logger` factories (`createCronLogger` for the cron). Cron uses `createCronLogger`.
- Feature flags via `@contractor-ops/feature-flags` only; keys in `registry.ts`/`flags-core.ts` then Unleash UI. `module.iris-efile` + `module.us-expansion` already registered PENDING.
- Tenant from session (`organizationId`, region); never `globalModels` for tenant-owning models; RLS + cross-org leak test per new model.
- `writeAuditLog` on sensitive mutations; pass `tx` in transactions. Zod on every tRPC procedure; `safeParse` for webhooks/uploads; no unsafe `as` on external payloads.
- New env → `.env.example` + package env schema (`packages/*/src/env.ts`); `pnpm check:no-process-env`.
- Deps: 7-day release age (`min-release-age=7`); no `@latest`; `pnpm audit` + `pnpm security:scan` after dep changes; typosquat check. (npm/npx blocked from repo root by the `.npmrc` unit bug — use pnpm or run from `/tmp` with `--config-dir`.)
- **Documentation follows code (gated):** any product change in apps/packages → matching wiki + indexes/graph in the same change set. Required updates for this phase: `wiki/domains/` (US year-end-filing domain page — extend the P85 us-tax page or add a sibling), `wiki/structure/api-routers-catalog.md`, `wiki/structure/prisma-schema-areas.md`, `wiki/structure/cron-jobs.md`, `wiki/integrations/` (IRS IRIS + e-Services TIN-Matching), `wiki/patterns/feature-flags.md`, `wiki/log.md` + `hot.md`; `.planning/MEMORY.md` for any new invariant. `pnpm check:wiki-brain` before done.
- UI (admin batch + portal consent surface): `frontend-design` skill MANDATORY; then `impeccable` + `PRODUCT.md`; web-vite page→container→hook→component; loading/empty/error + WCAG; i18n en/en-US/de/pl/ar (RTL) (D-20).
- Typecheck: `pnpm typecheck` (tsc, CI-canonical). Tests: `pnpm test` (run, don't cite from memory). NEVER unscoped web-vite test run.
- Adviser-verify annotations on tax artifacts (LOCAL-ONLY / legal-deferred posture, D-18).

## Sources

### Primary (HIGH confidence)
- In-tree: `packages/einvoice/src/profiles/xrechnung-de/{generator.ts,validator.ts,validator-bundle/}` — XMLBuilder + libxmljs2 XSD + CI checksum pattern (read).
- In-tree: `packages/api/src/services/{tax-form.service.ts,payment-export.ts,peppol-adapter-factory.ts,late-payment-claim-pdf.ts,classification-document-render.ts,audit-writer.ts,idempotency.ts}` (read).
- In-tree: `packages/db/src/retention-policy.ts` (RETENTION_YEARS has 1099-NEC:4, backup-withholding:7; MODEL_RETENTION_TYPE empty), `packages/db/prisma/schema/tax.prisma` (TaxFormSubmission supersede), `packages/feature-flags/src/{flags-core.ts,registry.ts,signoff-registry-flags.json}` (`module.iris-efile` + `module.us-expansion` PENDING), `apps/cron-worker/src/jobs/registry.ts`, `packages/api/src/middleware/require-us-expansion-flag.ts`, `packages/validators/src/us-validators.ts` (read).
- irs.gov — FIRE decommission 2026-12-31 / IRIS mandatory TY2026; Pub 2108A (TIN Matching interactive ≤25 / bulk ≤100k, PAF); Pub 1281 (B-notice/CP2100/24% backup withholding); Pub 1179 (substitute Copy B black ink + §4.6 e-delivery consent); IRIS schema package via SOR (TY2025 v2.0, posted 2025-11-06); IRIS working-group materials (VersionNum/VersionDt in payload, ack statuses, OriginalReceiptId).
- `.planning/REQUIREMENTS.md` line 18-19 (IRIS-primary correction; $2,000 OBBBA threshold), `.planning/milestones/v7.0-BACKLOG.md` OPEN #5.

### Secondary (MEDIUM confidence)
- Thomson Reuters, Ice Miller, Sovos, eFileMyForms, 1099Pro, BoomTax — FIRE→IRIS transition (FIRE retires by TY2026; new TCC ~45-day lead; ATS; A2A SOAP-only + MTOM; ack = form-by-form accepted/rejected).
- OnPay / Avalara / NATP / Tax1099 — OBBBA $2,000 threshold effective 2026-01-01, inflation-indexed 2027.
- Avalara Track1099 / BoomTax / Sovos direct-state-reporting — CF/SF participant list + direct-file states (drift-prone).

### Tertiary (LOW confidence — re-verify at execution)
- Exact IRIS XSD element names + A2A SOAP operation signatures (Pub 5718 is authoritative but the PDF did not render via WebFetch; download + read the schema package + Pub 5718 at execution).
- Exact current-year CF/SF participant + per-state direct-file matrix (changes annually).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every GA-path library is already in the workspace with verified versions; patterns directly mirrored from in-tree code.
- Architecture: HIGH (recomposition of proven in-tree patterns) / MEDIUM on exact IRIS XSD element structure and A2A SOAP signatures (re-verify against schema package + Pub 5718).
- Regulatory facts (FIRE decommission, OBBBA threshold, 24% backup withholding, TIN-match modes, CFSF mechanics, Pub 1179 consent): HIGH — corroborated across IRS publications + multiple tax-advisory sources.
- Pitfalls: HIGH — grounded in the verified regulatory facts + in-tree safety invariants.

**Research date:** 2026-06-16
**Valid until:** IRIS schema element details + CF/SF participant list — re-verify per tax year (next IRS schema ~Nov 2026 for TY2026). Library versions / in-tree patterns — stable ~30 days. Regulatory effective dates — stable through the milestone.

## RESEARCH COMPLETE

**Phase:** 86 - Theme A — TIN-Match → 1099-NEC → IRIS E-File → State Filing
**Confidence:** HIGH (in-tree patterns + IRS regulatory facts) / MEDIUM (exact IRIS XSD element names + A2A SOAP signatures — re-verify against downloaded schema package + Pub 5718 at execution)

### Key Findings
- **OPEN item #5 resolved:** FIRE decommissions 2026-12-31; TY2025 is its last year; TY2026 returns (filed early 2027, exactly when v7.0 ships its year-end loop) MUST use IRIS. IRIS is primary/mandatory; FIRE = doc-only. The 10-return aggregate e-file mandate continues under IRIS. [VERIFIED: irs.gov]
- **Threshold + backup withholding confirmed:** OBBBA $2,000 for payments after 2025-12-31 (TY2026), inflation-indexed from 2027; TY2025 stays $600 → seed the tax-year-keyed table accordingly. Backup withholding 24% (Pub 1281 B-notice/CP2100 mechanics) models D-07/D-12 faithfully.
- **IRIS A2A = SOAP-only + MTOM**, submit-then-poll; ack statuses are **Accepted / Rejected / Processing / Partially Accepted / Accepted with Errors / Not Found** + an Error Information Group (+ `OriginalReceiptId` for replacements) — the single ack parser (D-04) maps these. Schema package from the IRS Secure Object Repository (TY2025 = v2.0; VersionNum/VersionDt now in the payload manifest).
- **Two distinct IRS enrollment gates** (both plan-phase ops checklist items, both keep their live client dark): IRIS-A2A TCC (~45-day lead + ATS test) for transmit; PAF + e-Services registration for TIN-Matching.
- **Every GA-path primitive already exists in-tree** — XRechnung XMLBuilder+libxmljs2+CI-checksum for IRIS XML; `supersedeAndInsert` for CORRECTED; `@react-pdf/renderer@4.5.1` (NOT 3.4.5 as CONTEXT states) for Copy-B (Pub 1179 black-ink substitute + §4.6 consent gate); `ExchangeRate` service for payment-date FX; retention map pre-seeded with `1099-NEC`:4/`backup-withholding`:7. **`module.iris-efile` flag already exists PENDING — reuse it (Assumptions A1).**

### File Created
`/Users/mateusz.pitura/Repos/projects/contractor-ops/.planning/phases/86-theme-a-tin-match-1099-nec-iris-e-file-state-filing/86-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All GA libraries already in workspace; versions verified from package.json + installed node_modules. |
| Architecture | HIGH / MEDIUM | Recomposition of proven in-tree patterns; exact IRIS XSD/SOAP element names need re-verification against the schema package + Pub 5718. |
| Regulatory facts | HIGH | FIRE/IRIS, OBBBA threshold, 24% backup withholding, TIN-match modes, CFSF, Pub 1179 — corroborated across IRS + multiple advisory sources. |
| Pitfalls | HIGH | Grounded in verified regulatory facts + in-tree safety invariants. |

### Open Questions
- Exact IRIS XSD element/structure (manifest + B-record + CFSF state-code path) — download TY2025/TY2026 schema from SOR at plan time; treat this doc's structure as MEDIUM scaffolding.
- A2A SOAP/MTOM operation signatures + endpoint URLs — Pub 5718 authoritative (binary PDF; read at execution); off the GA critical path.
- Current-year CF/SF participant list + per-state direct-file matrix — drift-prone; seed from IRS CF/SF FAQ + Pub 1220/IRIS state guidance, adviser-verify-annotated.

### Ready for Planning
Research complete. The planner can create PLAN.md files: build the deterministic generation pipeline (TIN-match logic + mock, batch aggregation, `buildIrisXml`+`xsdValidate`, single ack parser, Copy-B PDF, per-state CFSF/CSV) behind `module.us-expansion`, keep live A2A SOAP/MTOM + live e-Services TIN-Match dark behind `module.iris-efile`/PAF, register `Form1099Nec` retention, and add the schema-package download + TCC/PAF enrollment as plan-phase operational checklist items.
