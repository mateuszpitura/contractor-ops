# Phase 61: XRechnung E-Invoicing - Research

**Researched:** 2026-04-14
**Domain:** EN 16931 e-invoicing — XRechnung CIUS (CII syntax), KoSIT validation, Leitweg-ID, Peppol BIS Billing 3.0 via Storecove
**Confidence:** HIGH (core stack + validation harness + Leitweg-ID spec verified; two MEDIUM areas flagged for planner: Storecove CII-for-UK B2G behaviour + libxmljs2 runtime footprint on Render)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase boundary.** New profile `packages/einvoice/src/profiles/xrechnung-de/` mirroring `peppol-ae/` (`constants.ts`, `generator.ts`, `parser.ts`, `validator.ts`, `schemas.ts`, `index.ts`). Shares `engine/xml-utils.ts` and core `EInvoice`/`EInvoiceProfile` interfaces — no refactor of peppol-ae. Registered in `packages/einvoice/src/registry.ts` under a new `XRECHNUNG_DE_PROFILE_ID`. Excluded: ZUGFeRD, inbound parsing, invoice-receipt flow — all Phase 62.

**CII generator & KoSIT validation (EINV-01 / EINV-04).**
- D-01: new profile directory mirroring peppol-ae layout; registry entry.
- D-02: pin `XRechnung 3.0.2` via `XRECHNUNG_VERSION` constant. Document-level `CustomizationID = urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0` and `ProfileID = urn:fdc:peppol.eu:2017:poacc:billing:01:1.0` so the same XML is KoSIT-valid and Peppol-valid.
- D-03: KoSIT validation runs locally with bundled schematron XSLTs + `saxon-js`. Pre-compiled KoSIT artifacts checked into `packages/einvoice/src/profiles/xrechnung-de/validator-bundle/`: `EN16931-CII-validation.xslt`, `XRechnung-CII-validation.xslt`, `CII-D16B-schema/`, `README.md`. Pre-compile happens ONCE at PR/release time via `scripts/recompile-kosit-schematron.ts`; runtime is pure `saxon-js`. Three-layer validation: (1) XSD via `libxmljs2`, (2) EN 16931 CII Schematron via `saxon-js`, (3) XRechnung CIUS Schematron via `saxon-js`. Short-circuit on the first layer's fatal errors. Each layer produces SVRL; `validator.ts` normalises to typed `XRechnungValidationReport { layer, status, errors[], warnings[], infos[] }`.
- D-04: validation trigger = on-demand + eager at finalize. New `finalizeEInvoice` tRPC mutation builds envelope → generates CII → runs KoSIT → persists to `EInvoiceLifecycle` + uploads XML to R2 → returns report. "Validate now" CTA re-runs validation without mutating stored XML.

**Leitweg-ID (EINV-05).**
- D-05: new Prisma model `LeitwegId` (fields per CONTEXT.md). Unique `(organizationId, value)`. Indexed on `(organizationId, contractorId)` and `(organizationId, contractId)`.
- D-06: resolution rule — contractId row > contractor default > none. Helper at `packages/api/src/services/leitweg-id-resolver.ts`.
- D-07: Zod validator in `packages/validators/src/leitweg-id.ts` with regex `/^(\d{2,12})(?:-([A-Z0-9]{0,30}))?-(\d{2})$/` + `.refine()` for Modulo-11-10 check digit.
- D-08: soft-gate with warning — add `Contractor.isPublicSectorBuyer` (default false). Missing Leitweg-ID → `warnings: ['LEITWEG_ID_MISSING']` but XML still produced. Hard-block only when Storecove send requires it per buyer's Peppol document-type.

**Peppol transmission (EINV-06).**
- D-09: extend `StorecoveAdapter.transmitInvoice` with format discriminator in `packages/einvoice/src/asp/types.ts`: `format: { kind: 'ubl-pint-ae' } | { kind: 'cii-xrechnung', customizationId, profileId } | { kind: 'ubl-peppol-bis-3' }`. Maps to Storecove's `document_type_id`. HMAC, rate limiter, audit logger reused.
- D-10: per-org one-time participant registration via Storecove. New `Organization` fields: `peppolParticipantId`, `peppolParticipantSchemeId`, `peppolParticipantStatus` enum (`NOT_REGISTERED | PENDING | ACTIVE | SUSPENDED | FAILED`). Settings UI at `/[locale]/(dashboard)/settings/e-invoicing/`. Send gate: refuse unless `ACTIVE`. **⚠️ Planner must reconcile with existing `PeppolParticipant` table in `packages/db/prisma/schema/peppol.prisma` — see §Collision with existing Peppol tables.**
- D-11: new `Contractor` fields `peppolSchemeId`, `peppolParticipantValue` (paired). Pre-flight `lookupParticipantCapabilities` call before send. `PeppolCapabilityCache` table, 6h TTL. Lookup failure → `PARTICIPANT_NOT_REACHABLE`.

**Lifecycle & compliance (EINV-07).**
- D-12: new Prisma model `EInvoiceLifecycle` 1:1 with `Invoice`. FSM helper enforces transitions (not DB trigger).
- D-13: child `EInvoiceLifecycleEvent` append-only audit trail.
- D-14: structured summary in `validationReportSummary Json`; full HTML report in R2 at `einvoice-reports/{orgId}/{invoiceId}/{ruleSetVersion}-{reportSha256[0:16]}.html`. Signed URL TTL 300s.
- D-15: compliance UI — column + filter chips + summary tile on invoices list; new "E-invoice" tab on `/[locale]/(dashboard)/invoices/[id]/` (tabbed layout). CTAs: Generate / Finalize + validate / Download XML / Download full report / Send via Peppol.
- D-16: new routers `packages/api/src/routers/einvoice.ts` (extend existing), `leitwegId.ts`, `peppol-participant.ts`.

### Claude's Discretion
- XRechnung 3.0.2 release pin confirmation — [VERIFIED: latest KoSIT validator-configuration release 2026-01-31 still compatible with 3.0.x; pin is safe, see §State of the Art].
- KoSIT artifact release tag — [VERIFIED: 2026-01-31] pick that release (or most recent at implementation time).
- `saxon-js` vendoring approach — go with `pnpm add` per CONTEXT.md.
- SVRL → typed-report normalisation shape — see §Code Examples for recommended shape.
- `PeppolCapabilityCache` TTL — 6h default is reasonable; tighten to 1h only if Storecove SML turns out to be volatile (no evidence it is).
- UI layout of "E-invoice" detail tab — defer to frontend-design plugin.
- i18n error copy — follow Phase 56 patterns under new `EInvoice` namespace.
- Admin bulk "Force re-validate all invoices" — nice-to-have; scope-budget call.
- Webhook-driven status updates: silent UI update vs notification — silent is fine initially.

### Deferred Ideas (OUT OF SCOPE)
- ZUGFeRD PDF/A-3 (Phase 62).
- Inbound XRechnung / ZUGFeRD parsing (Phase 62).
- UBL-XRechnung variant — deferred; CII covers both German and UK B2G routes in scope.
- Factur-X / FatturaPA / other country profiles — future phases.
- Peppol Directory auto-registration — Storecove handles SMP; public directory deferred.
- Bulk ZIP export.
- Embedded line-attachment PDFs (AdditionalReferencedDocument).
- Digital signature on XRechnung XML — EN 16931 does not require it.
- Mustangproject JVM integration — rejected; saxon-js covers the need.
- Non-B2G private-sector DE XRechnung invoicing.
- Per-invoice XML manual-edit UI.
- Validation against historical XRechnung 2.x.
- Automatic XRechnung-version upgrade migrations.
- Leitweg-ID public-directory auto-suggest.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EINV-01 | User can generate XRechnung-compliant e-invoices (EN 16931 + German CIUS) in CII XML | §Standard Stack (fast-xml-parser → CII), §Code Examples (namespace + BT-10 skeleton), §Architecture Patterns (profile layout) |
| EINV-04 | User can validate e-invoices against KoSIT's 3-layer validation (XSD + EN 16931 Schematron + XRechnung Schematron) | §Standard Stack (saxon-js + libxmljs2), §Architecture Patterns (SVRL pipeline), §Code Examples (3-layer runner + SVRL report shape), §Common Pitfalls (prebuild pitfalls) |
| EINV-05 | User can manage Leitweg-IDs per-contractor / per-contract with format + check-digit validation | §Standard Stack (Zod), §Code Examples (Leitweg-ID Modulo-11-10 + Zod refine), §Common Pitfalls (ambiguous spec clause) |
| EINV-06 | User can send e-invoices to UK public sector via Peppol BIS 3.0 using existing Storecove ASP | §Standard Stack (Storecove client existing), §Architecture Patterns (format-discriminator adapter), §Common Pitfalls (CII vs UBL for UK B2G receivers — critical) |
| EINV-07 | User can view e-invoicing compliance status per organisation | §Architecture Patterns (lifecycle FSM), §Code Examples (Prisma models + event log), §Collision with existing Peppol tables |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Compliance consequence for Phase 61 |
|-----------|-------------------------------------|
| UI via `frontend-design` plugin; high-polish, a11y, responsive | Invoice list chips, compliance tile, "E-invoice" tab, Settings→E-invoicing page all run through plugin. |
| Turborepo monorepo + clean boundaries | Profile code lives in `packages/einvoice`; tRPC in `packages/api`; validators in `packages/validators`; DB in `packages/db`. No cross-boundary imports. |
| `ctx7` / Context7 for library docs, always current versions | Version-verify saxon-js / libxmljs2 / fast-xml-parser before locking. Done — see §Standard Stack. |
| Zod at every external boundary | `leitwegId`, `peppolScheme`, `peppolValue`, webhook bodies, finalizeEInvoice input — all Zod-validated. |
| No secrets leaked, least privilege, rate-limit, RLS where relevant | Reuse `GovApiRateLimiter` + `GovApiAuditLogger`; tenant middleware + per-org scoping on `LeitwegId` / `EInvoiceLifecycle` / `PeppolCapabilityCache`. |
| Performance: no overfetching, cache where appropriate | `PeppolCapabilityCache` TTL table; validation report summary denormalised to avoid re-rendering full SVRL. |
| `.env.example` up to date | Add `STORECOVE_API_KEY`, `STORECOVE_WEBHOOK_SECRET` — verify already present; if not, add. |
| No `console.*` in source; use `@contractor-ops/logger` | Storecove adapter already has one `console.error` (b12 line 143) — NOT a Phase 61 concern but keep Phase 61 additions console-free. |
| Append-only audit trails, Prisma extension for multi-tenant | `EInvoiceLifecycleEvent` is append-only; `LeitwegId`, `EInvoiceLifecycle`, `EInvoiceLifecycleEvent`, `PeppolCapabilityCache` all `organizationId`-scoped. |
| Deployment status = LOCAL-ONLY; legal sign-off deferred | Any German tax-adviser review of XRechnung-specific copy is post-deploy; do not block CI on it. |

## Summary

Phase 61 adds XRechnung (German CIUS on EN 16931, CII syntax) as a new pluggable e-invoicing profile in `packages/einvoice/`, wires it through the existing Storecove ASP for UK B2G Peppol delivery, adds Leitweg-ID management with Modulo-11-10 check-digit validation, and surfaces compliance state on the invoices list + a new "E-invoice" detail tab. The technical core — CII XML generation, local KoSIT three-layer validation (XSD + EN 16931 Schematron + XRechnung Schematron), and lifecycle tracking — is well-trodden territory with stable tooling. All decisions in CONTEXT.md are implementable as written. **Three concrete risks require the planner's attention:** (1) CONTEXT.md proposes adding `peppolParticipantId` fields directly to `Organization` (D-10), but the repo already has a separate `PeppolParticipant` table wired to Storecove — the planner MUST reconcile rather than double-store; (2) Peppol network defaults to UBL, and CII is only an optional receiver capability in SMP, so the "one XML serves both markets" premise (D-02) holds *only* when the UK recipient has registered CII receive capability — a pre-flight capability check is mandatory, not optional; (3) `libxmljs2@0.37.0` requires native bindings and may fail prebuild on Render — if that happens, `libxml2-wasm` is a tested pure-WASM fallback that keeps the deployment story clean.

**Primary recommendation:** Implement the new profile under `packages/einvoice/src/profiles/xrechnung-de/`, add saxon-js and either libxmljs2 or libxml2-wasm to the einvoice workspace, bundle the KoSIT 2026-01-31 release as checked-in XSLT + XSD artifacts, reconcile `Organization` vs existing `PeppolParticipant` model before writing the migration, and gate UK B2G Peppol sends on an SMP-capability pre-flight that verifies CII receive support.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `saxon-js` | 2.7.0 (2024-10-17) | Run KoSIT-supplied XSLT (compiled from Schematron) over CII XML to produce SVRL | [CITED: saxonica.com] XSLT 3.0 conformant, pure JS (no native deps), works in Node 24; widely referenced as the go-to for schematron-derived XSLT evaluation in JS. [VERIFIED: npm registry `npm view saxon-js`] |
| `libxmljs2` | 0.37.0 (2025-06) | Layer-1 XSD schema validation against bundled CII D16B schemas | [VERIFIED: npm registry `npm view libxmljs2`] MIT, libxml2 bindings. Depends on `node-gyp` + `nan` — native build at install. ⚠️ See §Common Pitfalls for Render-deployment risk + fallback. |
| `fast-xml-parser` | 5.5.12 (already installed, pinned ^5.5.11 in einvoice package.json) | Build CII XML (generator) and parse validation reports | Already used by `peppol-ae/generator.ts`; same library keeps einvoice dependency surface tight. [VERIFIED: repo `packages/einvoice/package.json`] |
| `zod` | ^3.25.76 (workspace pin) | Input validation at tRPC + Prisma boundary; Leitweg-ID schema; Storecove webhook schema | Already in einvoice + validators packages. Required by CLAUDE.md. |
| `@contractor-ops/gov-api` | workspace:* | `GovApiRateLimiter` + `GovApiAuditLogger` for Storecove calls | Already wired into `StorecoveAdapter`; reused as-is. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `libxml2-wasm` | latest | Pure-WASM XSD validator | Fallback for layer-1 if `libxmljs2` native build fails on Render. [CITED: jameslan.github.io/libxml2-wasm] |
| `xslt3` | 2.7.0 | Saxon-JS CLI for one-shot compilation of `.sch` → `.xslt` | Used only inside `scripts/recompile-kosit-schematron.ts` (dev-only); not a runtime dep. [VERIFIED: npm registry] |
| `xml-crypto` | ^6.1.2 | Already installed; NOT needed — EN 16931 / XRechnung removes signature requirements | Do NOT add XML digital signing for XRechnung (explicit deferred decision). |
| `@xmldom/xmldom` | 0.8.12 devDep | DOM parsing in tests when saxon-js SEF loading needs a DOM | Optional, already available as devDep in einvoice. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `saxon-js` | `ph-schematron-js` / `schxslt` | [CITED: phax.github.io/ph-schematron] pure-Java; out of scope for Node. `schxslt` is a Schematron-to-XSLT compiler — still needs an XSLT engine. No JS alternative as mature as saxon-js for XSLT 3.0. |
| `libxmljs2` | `libxml2-wasm` | WASM avoids native build, but ~2× slower on large schemas and ~5MB larger bundle. Prefer `libxmljs2` *if* Render builds reliably; have `libxml2-wasm` ready as drop-in. |
| `fast-xml-parser` CII builder | hand-rolled `xml-utils.ts` string builder | Existing `packages/einvoice/src/engine/xml-utils.ts` primitives exist; for consistency with `peppol-ae/generator.ts` use `fast-xml-parser` (same library, same style). |
| Local KoSIT validator | Remote KoSIT HTTP validator at xrechnung.de | [ASSUMED] The public KoSIT validator is a reference implementation, not an SLA-backed service. Local execution gives determinism + no network dep + no PII leaving the app. Consistent with CONTEXT.md D-03. |
| Separate adapter per format | Format discriminator on existing adapter (D-09) | Adapter-per-format duplicates HMAC, rate-limit, audit wiring. Discriminator is additive and tested. |

**Installation:**
```bash
pnpm --filter @contractor-ops/einvoice add saxon-js libxmljs2
pnpm --filter @contractor-ops/einvoice add -D xslt3
# If libxmljs2 prebuild fails on Render, swap to: pnpm --filter @contractor-ops/einvoice add libxml2-wasm
```

**Version verification:** [VERIFIED 2026-04-14 via `npm view`]
- saxon-js: `2.7.0` — published 2024-10-17 (stable, 1 dep: axios)
- libxmljs2: `0.37.0` — published 2025-06 (10 months ago; active)
- fast-xml-parser: `5.5.12` (einvoice pins `^5.5.11` — already satisfied)
- xslt3: `2.7.0`
- @xmldom/xmldom: `0.8.12`

## Architecture Patterns

### Recommended Project Structure
```
packages/einvoice/src/
├── profiles/
│   └── xrechnung-de/                         # NEW — mirrors peppol-ae/
│       ├── constants.ts                      # XRECHNUNG_VERSION, CustomizationID, ProfileID, CII namespaces, code lists
│       ├── generator.ts                      # EInvoice → CII XML (fast-xml-parser)
│       ├── parser.ts                         # CII XML → EInvoice (Phase 62 makes real use; minimal stub in 61)
│       ├── validator.ts                      # 3-layer KoSIT runner (libxmljs2 → saxon-js → saxon-js)
│       ├── validator-bundle/                 # NEW — checked-in KoSIT artifacts
│       │   ├── EN16931-CII-validation.xslt   # Pre-compiled from EN16931-CII.sch
│       │   ├── XRechnung-CII-validation.xslt # Pre-compiled from XRechnung-CII.sch
│       │   ├── CII-D16B-schema/              # UN/CEFACT CII D16B XSDs
│       │   ├── source.txt                    # Pinned KoSIT release tag (e.g., release-2026-01-31)
│       │   └── README.md                     # Re-compile instructions + Apache-2.0 license notice
│       ├── schemas.ts                        # Zod schemas for XRechnung-specific extensions
│       ├── svrl-normalizer.ts                # NEW — SVRL → typed XRechnungValidationReport
│       ├── leitweg-id-embed.ts               # NEW — resolves LeitwegId → BT-10 value for generator
│       ├── index.ts                          # XRechnungDEProfile class; registry entry
│       └── __tests__/
│           ├── generator.test.ts             # Known-good CII fixture assertions
│           ├── validator.test.ts             # Positive + negative cases (KoSIT test suite fixtures)
│           ├── leitweg-id-embed.test.ts
│           └── svrl-normalizer.test.ts

packages/validators/src/
└── leitweg-id.ts                             # NEW — Zod schema with Modulo-11-10 refine

packages/api/src/
├── routers/
│   ├── einvoice.ts                           # EXTEND — add finalize/revalidate/downloadXml/downloadReport/send/listByOrg
│   ├── leitweg-id.ts                         # NEW — list / listByContractor / listByContract / create / update / delete / setDefault
│   └── peppol-participant.ts                 # NEW — getStatus / register / deregister (OR extend existing peppol.ts — see §Collision)
└── services/
    ├── leitweg-id-resolver.ts                # NEW — per-invoice resolution rule (D-06)
    └── einvoice-lifecycle-fsm.ts             # NEW — state-transition helper (D-12)

packages/db/prisma/schema/
└── einvoice.prisma                           # NEW file — LeitwegId, EInvoiceLifecycle, EInvoiceLifecycleEvent, PeppolCapabilityCache

scripts/
└── recompile-kosit-schematron.ts             # NEW — one-shot: .sch → .xslt using xslt3 CLI
```

### Pattern 1: Pluggable profile (inherited)
**What:** XRechnung profile exports a class implementing `EInvoiceProfile` and registers in the static registry.
**When to use:** Always — this is the established pattern (peppol-ae, ksef, zatca all follow it).
**Example:** [VERIFIED: `packages/einvoice/src/profiles/peppol-ae/index.ts`] see PeppolAEProfile — copy the class shape, swap UBL → CII.

### Pattern 2: Three-layer SVRL validation pipeline (new)
**What:** Stateless runner chains XSD → EN 16931 Schematron → XRechnung Schematron, short-circuits on layer-1 fatal failures, returns normalised report.
**When to use:** All XRechnung validations (finalize, revalidate).
**Example:** See §Code Examples.
**Key design:** Each layer emits SVRL; normaliser extracts `<svrl:failed-assert>` and `<svrl:successful-report>` elements + their `@flag` (fatal/warning/info) into the typed shape.

### Pattern 3: Format-discriminated ASP transmission (D-09 additive change)
**What:** `TransmitInvoiceParams.format` discriminated union; adapter maps to Storecove `document_type_id` string + receiver scheme.
**When to use:** Any new profile that routes through Storecove. Keep peppol-ae's existing call sites untouched — make `format` optional with `{ kind: 'ubl-pint-ae' }` default OR have each profile pass its own format explicitly.

### Pattern 4: Lifecycle FSM in code (not DB trigger)
**What:** `einvoice-lifecycle-fsm.ts` exports a `transition(current, event) → next` function; invalid transitions throw. Every mutation to `EInvoiceLifecycle.validationStatus` / `transmissionStatus` must go through the FSM.
**When to use:** All lifecycle mutations. Keeps Prisma schema simple and testable.

### Pattern 5: Append-only event audit (mirrors Phase 60)
**What:** `EInvoiceLifecycleEvent` rows are inserted, never updated/deleted. Parent `EInvoiceLifecycle` holds current state; child provides history.
**When to use:** All lifecycle state changes write an event row in the same transaction.

### Anti-Patterns to Avoid
- **Calling the public KoSIT HTTP validator at runtime:** external dependency with no SLA, potential PII leakage, non-deterministic builds. Local execution only.
- **Storing full SVRL XML in a database column:** SVRL for a large invoice can be 100KB+; R2 with content-addressed key is correct. Summary (first 20 issues) is enough for the UI.
- **Embedding `saxon-js` SEF compilation at request time:** compile once at build/PR time, load the compiled XSLT at runtime.
- **Generating CII via string concatenation:** entities/escaping bugs surface as layer-1 XSD failures that are very hard to debug. Use `fast-xml-parser`.
- **Letting `finalizeEInvoice` take > 2 s:** three-layer validation should complete in < 1 s on a warm Node process. Warm the SEF cache at server startup.
- **Double-storing Peppol participant data** (CONTEXT.md D-10 adds fields to `Organization`, but `PeppolParticipant` table already exists). See §Collision with existing Peppol tables.

### Collision with existing Peppol tables
[VERIFIED: `packages/db/prisma/schema/peppol.prisma`] repo already has `PeppolParticipant` and `PeppolTransmission` models + existing `peppolRouter` at `packages/api/src/routers/peppol.ts` (403 lines, wired to Storecove). These were added by a prior phase (likely 55). CONTEXT.md D-10 proposes adding `Organization.peppolParticipantId / peppolParticipantSchemeId / peppolParticipantStatus` — which would **duplicate** what `PeppolParticipant` already stores.

**Recommendation for planner (must resolve before schema migration):**
- **Option A (preferred):** keep `PeppolParticipant` as the single source of truth. Add Phase 61 needs as new fields on `PeppolParticipant` (e.g., `supportsXRechnungCII Boolean @default(false)`, `lastCapabilityCheckAt DateTime?`). Add a computed `peppolParticipantStatus` derivation helper. The Settings→E-invoicing page reads from `PeppolParticipant` via the existing `peppolRouter`.
- **Option B (invasive):** migrate `PeppolParticipant` → directly-on-`Organization` fields as CONTEXT.md suggests. Requires rewriting existing `peppolRouter`, `PeppolTransmission` FK, and all Storecove connect/disconnect flows. High risk.
- **Option C (hybrid, current CONTEXT intent):** keep both. Unacceptable — double-truth.

Planner should adopt Option A and update D-10/D-16 accordingly. The existing `peppolRouter.connect/disconnect/getStatus` procedures can be the basis for Phase 61's participant-registration surface — Phase 61 extends them rather than introducing `peppol-participant.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schematron evaluation | Custom XPath runner | `saxon-js` + KoSIT-provided compiled XSLT | Schematron rules compile to XSLT 2.0+; building a runner means re-implementing XPath 3.1 for hundreds of rules. KoSIT already ships compiled XSLT in their release. |
| XSD validation | Custom schema walker | `libxmljs2` or `libxml2-wasm` | CII D16B XSD has deeply nested imports and substitution groups. libxml2 is the reference. |
| CII XML construction | String templates | `fast-xml-parser` (XMLBuilder) | Namespace prefixes + attribute ordering + empty-element handling are easy to get wrong; `fast-xml-parser` gets it right and matches peppol-ae style. |
| Modulo-11-10 check digit | "Wait it's just mod 10" | ISO/IEC 7064 MOD 11-10 implementation (see §Code Examples) | [CITED: loc.gov/issn/check, wikipedia Luhn/Mod-11-10] Mod 11-10 is a specific algorithm (ISO 7064) distinct from Luhn and ISBN-10's Mod-11. Implementations that look right often get the weighting wrong. Port the KoSIT reference. |
| Storecove REST client | New fetch wrapper | Existing `StorecoveClient` in `packages/einvoice/src/asp/storecove/client.ts` | Already typed, Zod-validated, AbortSignal-timed. |
| Webhook HMAC verification | Manual | Existing `StorecoveAdapter.verifyWebhookSignature` (HMAC-SHA256, timing-safe) | [VERIFIED: `adapter.ts` line 239–267] production-grade; reused as-is. |
| Rate limiting + audit logging | New service | `GovApiRateLimiter` + `GovApiAuditLogger` | Already composed into `StorecoveAdapter`. |
| Peppol participant capability lookup | New SMP client | Storecove's `/api/v2/discovery/receives` endpoint | [CITED: storecove.com/docs] Storecove already provides SMP discovery. Avoids writing an SMP/SML client from scratch. |
| Multi-tenant scoping | Manual `where: { organizationId }` everywhere | Existing Prisma client extension | Already in place; all new models MUST use it. |
| Signed R2 URLs | New signer | `putObjectAndSignDownload` / `signExistingDownload` (Phase 59) | [CITED: CONTEXT.md canonical refs] already production; 300s TTL matches existing policy. |

**Key insight:** The *entire* cryptographic + transport layer already exists in the repo from the peppol-ae/KSA work. Phase 61 is mostly adding a second profile and a validation runner. Resist any temptation to introduce parallel infrastructure.

## Runtime State Inventory

Phase 61 is a greenfield feature phase (no rename/refactor/migration). This section is omitted.

## Common Pitfalls

### Pitfall 1: Peppol UK B2G recipients default to UBL, not CII
**What goes wrong:** The Phase 61 plan assumes "one CII XML serves both KoSIT + Peppol UK" (CONTEXT.md D-02 "simultaneously Peppol-valid"). In reality, Peppol BIS Billing 3.0 treats UBL as mandatory and CII as an optional receiver capability that must be registered in the recipient's SMP.
**Why it happens:** [CITED: docs.peppol.eu/poacc/billing/3.0/bis/] "Peppol BIS supports the optional use of the UN/CEFACT XML Cross Industry Invoice, D16B (CII), meaning that receivers of invoices can register in the SMP to receive CII invoices alongside the mandatory UBL version." [CITED: b2brouter.net] CII-to-UBL transformation is recommended for *receivers*, but issuers must send what the receiver declares.
**How to avoid:** The pre-flight `lookupParticipantCapabilities` (CONTEXT.md D-11) becomes LOAD-BEARING, not just a nice-to-have. The planner must:
1. Query Storecove `/api/v2/discovery/receives` for the buyer's `schemeId:value`.
2. Check the returned `documentTypes` includes a CII variant of BIS Billing 3.0.
3. If NO → fail the send with an actionable error `PARTICIPANT_DOES_NOT_ACCEPT_CII`, and (optional future enhancement) offer to transmit a UBL conversion instead.
4. If YES → proceed with the XRechnung-CII send.
**Warning signs:** Storecove returns 422 at submit time with "unsupported document type at receiver" → the capability check was skipped or wrong.
**Planner impact:** D-09's `format: { kind: 'cii-xrechnung' }` variant is correct; add a UBL variant + a UBL transform step as a future enhancement line-item in the plan, even if Phase 61 ships CII-only. Document this limitation in the success-criteria verification.

### Pitfall 2: `libxmljs2` prebuild failure on Render / edge runtimes
**What goes wrong:** `libxmljs2` ships native C++ bindings via `prebuild-install` + `node-gyp`. On some Linux container images (especially stripped Alpine variants), prebuild falls back to source compilation, which needs a full C toolchain + libxml2-dev. If the Render base image lacks them, install fails at deploy.
**Why it happens:** [VERIFIED: `npm view libxmljs2` shows `nan`, `node-gyp`, `prebuild-install` as deps.] Prebuilt binaries cover major Node versions + glibc, but not musl (Alpine) without extra config.
**How to avoid:**
1. Check `apps/web/Dockerfile` — currently uses the Node image; verify it's debian-based (`node:24` or `node:24-slim`), not Alpine.
2. Run a one-off `pnpm install --filter @contractor-ops/einvoice` inside the Render build logs locally before shipping.
3. If prebuild fails: switch to `libxml2-wasm` — pure WASM, no native build, deploys identically across Render/Vercel/edge. Expect ~2× slower XSD validation (still well under 100ms for CII).
**Warning signs:** `npm ERR! code 1 while installing libxmljs2` in deploy logs; `node-gyp rebuild` messages.

### Pitfall 3: Modulo-11-10 confused with Luhn or Mod-11
**What goes wrong:** Engineers reach for Luhn (credit cards) or Mod-11 (ISBN-10) when the spec says "Modulo-11-10". The three produce different check digits; the check digit that validates a Leitweg-ID will silently reject or accept wrong IDs.
**Why it happens:** [CITED: wikipedia Check_digit] Multiple check-digit algorithms exist with similar names. ISO/IEC 7064 MOD 11,10 is a specific hybrid.
**How to avoid:** Port the reference implementation verbatim. [CITED: github.com/konfirm/node-iso7064] is a reference for ISO 7064. Ground truth against KoSIT's published test vectors (the validator-configuration-xrechnung release ships Leitweg-ID test cases).
**Warning signs:** Leitweg-IDs that pass your Zod `.refine()` but fail KoSIT BR-DE-17 / CII-SR-449 rules at layer-3 validation.
**Concrete Step:** the Plan MUST include a Wave-0 task: check in a fixtures file `packages/validators/src/__tests__/leitweg-id.fixtures.ts` with ≥10 known-good IDs (from KoSIT test suite) + ≥10 known-bad IDs (wrong check digit, malformed length, invalid character). Zod schema tests assert each.

### Pitfall 4: KoSIT XSLT lookup of XSD imports fails at runtime
**What goes wrong:** `libxmljs2.parseXml` loads the root CII D16B XSD fine, but fails on nested `<xs:import schemaLocation="...">` because the working directory isn't where the bundle is.
**Why it happens:** XSD import resolution is path-relative. `saxon-js` SEF files have the same gotcha with `<xsl:import-schema>`.
**How to avoid:** Pass absolute paths or pre-resolve schemas. Best practice: use libxmljs2's `baseUrl` option and set it to the `validator-bundle/CII-D16B-schema/` directory. For saxon-js, bundle everything it needs into the SEF at compile time.
**Warning signs:** layer-1 passes in tests but fails in production with "unknown element {urn:un:unece:uncefact:...}:CrossIndustryInvoice".
**Concrete step:** add an integration test that boots the validator with `NODE_ENV=production`-style cwd (e.g., `cd /tmp && node ...`) to flush out path-resolution bugs.

### Pitfall 5: CustomizationID / ProfileID typos are silent layer-2 failures
**What goes wrong:** EN 16931 Schematron rules are keyed off `CustomizationID`. A typo (e.g., missing `#compliant#` marker, wrong version string, lowercase vs uppercase) doesn't throw — the wrong rule set applies or no rules apply, and the document "passes" invalidly.
**Why it happens:** Schematron switches on string equality, not schema-level enforcement.
**How to avoid:** Lock the `CustomizationID` and `ProfileID` as exported constants in `xrechnung-de/constants.ts`; never build them inline in the generator. Add a test that asserts exact string equality against the spec values.
**Warning signs:** Layer 2 reports zero errors on a document you know has issues.

### Pitfall 6: Invoice currency ≠ EUR rejected by BR-DE rules
**What goes wrong:** XRechnung rule `BR-DE-17` requires `BT-5` (invoice currency) = EUR for German B2G invoices. A contractor invoicing a German agency in GBP fails layer-3.
**How to avoid:** Plan should block or warn on non-EUR currencies when the buyer is DE public-sector (derived from `Contractor.isPublicSectorBuyer` + `countryCode === 'DE'`). Surface the warning in the "E-invoice" tab.

### Pitfall 7: Lifecycle FSM race conditions on concurrent webhook + mutation
**What goes wrong:** User clicks "Send via Peppol" while a Storecove webhook for a previous send is in flight; both transition `transmissionStatus`, last-write-wins overwrites "DELIVERED" with "QUEUED".
**How to avoid:** FSM `transition(current, event)` must be called inside a Prisma transaction with `SELECT ... FOR UPDATE` on the lifecycle row. Reject invalid transitions (e.g., QUEUED → QUEUED from stale state).
**Warning signs:** Lifecycle status oscillates; event log shows impossible sequences.

## Code Examples

Verified patterns grounded in the repo + official specs.

### CII XRechnung skeleton (generator)
```typescript
// Source: [VERIFIED: deutschebahn.com CII XRechnung sample PDF + kpetersdms/validationtool XSL paths]
// In: packages/einvoice/src/profiles/xrechnung-de/constants.ts

export const XRECHNUNG_VERSION = '3.0.2' as const;
export const XRECHNUNG_CUSTOMIZATION_ID =
  'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0' as const;
export const XRECHNUNG_PROFILE_ID =
  'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0' as const;

// CII D16B namespaces
export const RSM_NS = 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100';
export const RAM_NS = 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100';
export const UDT_NS = 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100';
export const QDT_NS = 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100';

// In: packages/einvoice/src/profiles/xrechnung-de/generator.ts
import { XMLBuilder } from 'fast-xml-parser';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
});

export function generateXRechnungCii(
  invoice: EInvoice,
  leitwegId: string | null, // BT-10 value resolved upstream by leitweg-id-resolver.ts
): string {
  const doc = {
    'rsm:CrossIndustryInvoice': {
      '@_xmlns:rsm': RSM_NS,
      '@_xmlns:ram': RAM_NS,
      '@_xmlns:udt': UDT_NS,
      '@_xmlns:qdt': QDT_NS,
      'rsm:ExchangedDocumentContext': {
        'ram:GuidelineSpecifiedDocumentContextParameter': {
          'ram:ID': XRECHNUNG_CUSTOMIZATION_ID,
        },
      },
      'rsm:ExchangedDocument': {
        'ram:ID': invoice.id,
        'ram:TypeCode': invoice.invoiceTypeCode,
        'ram:IssueDateTime': {
          'udt:DateTimeString': {
            '@_format': '102',
            '#text': toCiiDate(invoice.issueDate), // YYYYMMDD
          },
        },
      },
      'rsm:SupplyChainTradeTransaction': {
        'ram:IncludedSupplyChainTradeLineItem': invoice.lines.map(toLineItem),
        'ram:ApplicableHeaderTradeAgreement': {
          ...(leitwegId ? { 'ram:BuyerReference': leitwegId } : {}),
          'ram:SellerTradeParty': buildCiiParty(invoice.supplier),
          'ram:BuyerTradeParty': buildCiiParty(invoice.customer),
        },
        'ram:ApplicableHeaderTradeDelivery': {
          /* BT-72 etc. */
        },
        'ram:ApplicableHeaderTradeSettlement': {
          'ram:InvoiceCurrencyCode': invoice.currencyCode,
          'ram:ApplicableTradeTax': invoice.taxBreakdown.map(toCiiTax),
          'ram:SpecifiedTradeSettlementHeaderMonetarySummation': buildMonetarySummation(invoice),
        },
      },
    },
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${builder.build(doc)}`;
}
```

### Three-layer KoSIT validator
```typescript
// Source: [CITED: saxonica.com/html/documentation12 + itplr-kosit validator README]
// In: packages/einvoice/src/profiles/xrechnung-de/validator.ts

import SaxonJS from 'saxon-js';
import libxmljs from 'libxmljs2'; // or: import libxml from 'libxml2-wasm';
import path from 'node:path';
import fs from 'node:fs/promises';
import { normaliseSvrl } from './svrl-normalizer.js';

const BUNDLE_DIR = path.join(__dirname, 'validator-bundle');

// Load once at module init — SEFs are reusable.
const en16931Sef = await fs.readFile(path.join(BUNDLE_DIR, 'EN16931-CII-validation.sef.json'), 'utf8');
const xrechnungSef = await fs.readFile(path.join(BUNDLE_DIR, 'XRechnung-CII-validation.sef.json'), 'utf8');
const ciiXsd = await fs.readFile(path.join(BUNDLE_DIR, 'CII-D16B-schema/CrossIndustryInvoice_100pD16B.xsd'), 'utf8');

export interface XRechnungValidationReport {
  status: 'VALID' | 'INVALID' | 'WARNINGS';
  ruleSetVersion: string; // e.g., 'XRechnung 3.0.2 / KoSIT release-2026-01-31'
  layers: {
    layer: 'XSD' | 'EN16931-SCH' | 'XRECHNUNG-SCH';
    status: 'PASS' | 'FAIL' | 'SKIPPED';
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    infos: ValidationIssue[];
  }[];
}

export interface ValidationIssue {
  ruleId: string;     // e.g., 'BR-DE-17'
  xpath: string;      // location in the document
  message: string;
  severity: 'fatal' | 'error' | 'warning' | 'info';
}

export async function validateXRechnungCii(xml: string): Promise<XRechnungValidationReport> {
  const layers: XRechnungValidationReport['layers'] = [];

  // Layer 1: XSD
  const xsdDoc = libxmljs.parseXml(ciiXsd, { baseUrl: path.join(BUNDLE_DIR, 'CII-D16B-schema/') });
  const instanceDoc = libxmljs.parseXml(xml);
  const xsdValid = instanceDoc.validate(xsdDoc);
  const xsdErrors: ValidationIssue[] = xsdValid ? [] : (instanceDoc.validationErrors ?? []).map(e => ({
    ruleId: 'XSD',
    xpath: '',
    message: e.message,
    severity: 'fatal' as const,
  }));
  layers.push({ layer: 'XSD', status: xsdValid ? 'PASS' : 'FAIL', errors: xsdErrors, warnings: [], infos: [] });

  if (!xsdValid) {
    // Short-circuit: no point running schematron on malformed XML
    layers.push({ layer: 'EN16931-SCH', status: 'SKIPPED', errors: [], warnings: [], infos: [] });
    layers.push({ layer: 'XRECHNUNG-SCH', status: 'SKIPPED', errors: [], warnings: [], infos: [] });
    return { status: 'INVALID', ruleSetVersion: RULE_SET_VERSION, layers };
  }

  // Layer 2: EN 16931 Schematron (via saxon-js)
  const en16931Result = await SaxonJS.transform({
    stylesheetInternal: JSON.parse(en16931Sef),
    sourceText: xml,
    destination: 'serialized',
  });
  const en16931Issues = normaliseSvrl(en16931Result.principalResult as string);
  layers.push({
    layer: 'EN16931-SCH',
    status: en16931Issues.errors.length > 0 ? 'FAIL' : 'PASS',
    ...en16931Issues,
  });

  // Layer 3: XRechnung CIUS Schematron
  const xrechnungResult = await SaxonJS.transform({
    stylesheetInternal: JSON.parse(xrechnungSef),
    sourceText: xml,
    destination: 'serialized',
  });
  const xrechnungIssues = normaliseSvrl(xrechnungResult.principalResult as string);
  layers.push({
    layer: 'XRECHNUNG-SCH',
    status: xrechnungIssues.errors.length > 0 ? 'FAIL' : 'PASS',
    ...xrechnungIssues,
  });

  const hasErrors = layers.some(l => l.errors.length > 0);
  const hasWarnings = layers.some(l => l.warnings.length > 0);
  return {
    status: hasErrors ? 'INVALID' : hasWarnings ? 'WARNINGS' : 'VALID',
    ruleSetVersion: RULE_SET_VERSION,
    layers,
  };
}
```

**Note:** `saxon-js` reads compiled Stylesheet Export Files (SEF) in JSON form, not `.xslt` directly. The build-time script (`scripts/recompile-kosit-schematron.ts`) compiles the KoSIT-provided `.sch` → `.xslt` → `.sef.json` using the `xslt3` CLI. CONTEXT.md D-03 references "EN16931-CII-validation.xslt" — planner should clarify these are SEF artifacts, not raw XSLT.

### Leitweg-ID Modulo-11-10 check digit (Zod refine)
```typescript
// Source: [CITED: leitweg-id.de KoSIT Format specification v2.0.2 + ISO/IEC 7064:2003 MOD 11,10]
// In: packages/validators/src/leitweg-id.ts

import { z } from 'zod';

const STRUCTURE_RE = /^(\d{2,12})(?:-([A-Z0-9]{0,30}))?-(\d{2})$/;

/**
 * ISO/IEC 7064 MOD 11,10 check digit over the concatenation of
 * coarse-address + fine-address (skipping the hyphen).
 * Returns the expected 2-digit check string.
 */
function computeLeitwegCheckDigit(payload: string): string {
  let p = 10;
  for (const ch of payload) {
    const digit = parseInt(ch, 36); // 0-9 → 0-9; A → 10; Z → 35
    if (Number.isNaN(digit)) throw new Error(`Invalid char '${ch}'`);
    let s = (p + digit) % 10;
    if (s === 0) s = 10;
    p = (s * 2) % 11;
  }
  const computed = (11 - p) % 10; // single digit 0..9
  // Leitweg uses a 2-digit check: the spec defines the two digits as the
  // computed digit over BOTH halves (grob, then fein-if-present). See KoSIT
  // Format specification v2.0.2 §4 for the exact split; port verbatim from
  // the reference impl and validate against KoSIT test vectors.
  return computed.toString().padStart(2, '0');
}

export const leitwegIdSchema = z
  .string()
  .min(5, 'Leitweg-ID too short')
  .max(46, 'Leitweg-ID too long')
  .regex(STRUCTURE_RE, 'Leitweg-ID structure invalid')
  .refine(value => {
    const m = STRUCTURE_RE.exec(value);
    if (!m) return false;
    const [, coarse, fine, check] = m;
    const payload = coarse + (fine ?? '');
    try {
      return computeLeitwegCheckDigit(payload) === check;
    } catch {
      return false;
    }
  }, { message: 'Leitweg-ID check digit invalid' });
```

**Planner action required:** the exact two-digit check construction from the ISO 7064 single-digit result is the one sentence in the KoSIT spec that different implementations interpret differently. The plan MUST include: (a) a fixtures file sourced from KoSIT's published test suite, (b) an assertion test against every fixture, (c) a note in 61-SUMMARY.md if KoSIT specification source is unreachable pointing to the fixture set used. [ASSUMED: A1 — my ISO-7064-style computation above is *illustrative*; the canonical impl should be ported from a reference source + round-tripped against KoSIT fixtures before being locked in.]

### Prisma models (Phase 61 additions)
```prisma
// In: packages/db/prisma/schema/einvoice.prisma (NEW FILE)

model LeitwegId {
  id                       String    @id @default(cuid())
  organizationId           String
  value                    String    @db.VarChar(46)
  description              String?
  contractorId             String?
  contractId               String?
  isDefaultForContractor   Boolean   @default(false)
  validFrom                DateTime?
  validTo                  DateTime?
  notes                    String?
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt

  organization             Organization  @relation(fields: [organizationId], references: [id])
  contractor               Contractor?   @relation(fields: [contractorId], references: [id])
  contract                 Contract?     @relation(fields: [contractId], references: [id])

  @@unique([organizationId, value])
  @@index([organizationId, contractorId])
  @@index([organizationId, contractId])
}

model EInvoiceLifecycle {
  id                        String                   @id @default(cuid())
  organizationId            String
  invoiceId                 String                   @unique
  profileId                 String                   // 'xrechnung-de', 'peppol-ae-pint', ...
  xmlKey                    String?                  // R2 object key
  xmlSha256                 String?                  @db.VarChar(64)
  ruleSetVersion            String?
  validatedAt               DateTime?
  validationStatus          EInvoiceValidationStatus @default(NOT_VALIDATED)
  validationReportSummary   Json?
  validationReportFullKey   String?
  transmittedAt             DateTime?
  transmissionId            String?                  // Storecove message ID
  transmissionStatus        EInvoiceTransmissionStatus @default(NOT_SENT)
  deliveredAt               DateTime?
  deliveryAckJson           Json?
  lastErrorJson             Json?
  createdAt                 DateTime                 @default(now())
  updatedAt                 DateTime                 @updatedAt

  organization              Organization             @relation(fields: [organizationId], references: [id])
  invoice                   Invoice                  @relation(fields: [invoiceId], references: [id])
  events                    EInvoiceLifecycleEvent[]

  @@unique([organizationId, invoiceId])
  @@index([organizationId, validationStatus])
  @@index([organizationId, transmissionStatus])
}

enum EInvoiceValidationStatus {
  NOT_VALIDATED
  VALID
  INVALID
  WARNINGS
}

enum EInvoiceTransmissionStatus {
  NOT_SENT
  QUEUED
  SENT
  DELIVERED
  FAILED
}

model EInvoiceLifecycleEvent {
  id             String                     @id @default(cuid())
  organizationId String
  lifecycleId    String
  eventType      EInvoiceLifecycleEventType
  occurredAt     DateTime                   @default(now())
  actorUserId    String?
  detailsJson    Json?
  createdAt      DateTime                   @default(now())

  lifecycle      EInvoiceLifecycle          @relation(fields: [lifecycleId], references: [id])
  organization   Organization               @relation(fields: [organizationId], references: [id])

  @@index([organizationId, lifecycleId])
  @@index([organizationId, eventType])
}

enum EInvoiceLifecycleEventType {
  GENERATED
  VALIDATED
  TRANSMITTED
  DELIVERY_ACK
  DELIVERY_FAILED
  RE_VALIDATED
  RE_TRANSMITTED
}

model PeppolCapabilityCache {
  id             String   @id @default(cuid())
  organizationId String
  schemeId       String
  value          String
  documentTypes  Json     // array of doc-type IDs the participant accepts
  cachedAt       DateTime @default(now())
  expiresAt      DateTime

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, schemeId, value])
  @@index([organizationId, expiresAt])
}
```

**Contractor additions (D-08 / D-11):**
```prisma
// In: packages/db/prisma/schema/contractor.prisma (ADD to existing Contractor model)
isPublicSectorBuyer      Boolean   @default(false)
peppolSchemeId           String?   @db.VarChar(4)   // e.g., '0060'
peppolParticipantValue   String?   @db.VarChar(64)  // e.g., Companies House number

// Zod pair constraint at boundary: both set or both null.
```

**⚠️ Organization additions (D-10):** see §Collision — prefer extending `PeppolParticipant` over adding duplicative `Organization` fields.

### Format-discriminated adapter (D-09)
```typescript
// In: packages/einvoice/src/asp/types.ts (MODIFY existing interface)

export type EInvoiceFormat =
  | { kind: 'ubl-pint-ae' }
  | { kind: 'cii-xrechnung'; customizationId: string; profileId: string }
  | { kind: 'ubl-peppol-bis-3' };

export interface TransmitInvoiceParams {
  xml: string;
  senderParticipantId: string;
  receiverParticipantId: string;
  documentTypeId: string; // kept for backwards compat with peppol-ae callers
  format?: EInvoiceFormat; // NEW — optional; defaults to 'ubl-pint-ae'
  organizationId?: string;
}

// In: packages/einvoice/src/asp/storecove/adapter.ts (MODIFY transmitInvoice)
// When format.kind === 'cii-xrechnung', map to Storecove's CII document type
// constant for XRechnung — confirm exact string via sandbox test before locking.
```

**Exact Storecove `document_type_id` for XRechnung CII:** [MEDIUM CONFIDENCE — need to verify in sandbox] the value is documented only at `storecove.com/docs/`; the published docs mention "XRechnung (both UBL and CII)" but don't enumerate the discriminator. Planner should include a Wave-0 task "verify Storecove CII document_type_id against sandbox" that captures the literal string and writes it to `constants.ts`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mustangproject (Java) for XRechnung gen + validation | Pure-JS generator + saxon-js validator | 2023–2024 ecosystem maturation | No JVM in Node deploys; simpler ops |
| Remote KoSIT HTTP validator | Local bundled XSLT + saxon-js | Industry standard since KoSIT open-sourced artifacts | Deterministic builds, no PII leaks, no SLA dependency |
| XML Digital Signature on invoice | NONE | EN 16931 removed the requirement; only ZUGFeRD legacy flows keep it | `xml-crypto` package stays unused for XRechnung |
| Peppol Directory manual registration | SMP-only via Storecove | Storecove covers SMP; Directory listing is separate opt-in | Out of scope per CONTEXT.md |
| XRechnung 2.3 | XRechnung 3.0 / 3.0.2 | 2024-02 (3.0), 2024-07 (3.0.2) | CONTEXT.md locks 3.0.2 — matches current KoSIT release support |

**Deprecated/outdated:**
- XRechnung 2.x rule sets — KoSIT still ships validator configs for historical versions but CONTEXT.md correctly pins to 3.0.x.
- UBL-only Peppol BIS senders — CII is fully supported by Peppol BIS 3.0 as of 2023; but receivers must register the capability (see Pitfall 1).
- `libxmljs` (v0.x, pre-fork) — unmaintained; `libxmljs2` is the active fork. [VERIFIED: npm view]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ISO-7064 MOD 11,10 illustrative implementation in §Code Examples requires round-tripping against KoSIT test vectors before it can be locked as the Leitweg-ID check-digit algorithm. | §Code Examples (Leitweg-ID) | Medium — incorrect check-digit logic silently rejects valid IDs or accepts invalid ones. Mitigation: fixtures-based tests as planner action. |
| A2 | The Storecove `document_type_id` literal for XRechnung-CII is not documented publicly; planner must verify against sandbox before locking a constant. | §Code Examples (Adapter) | Medium — wrong string → 422 at transmit time. Wave-0 sandbox verification task. |
| A3 | `CustomizationID = urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0` is the correct value for XRechnung 3.0.x. I have high confidence this is right (widely referenced), but the literal should be double-checked against the KoSIT 2026-01-31 scenarios.xml. | §User Constraints D-02 | Low — if wrong, layer-2 Schematron silently applies the wrong rule set (see Pitfall 5). |
| A4 | Render's default Node image is debian-based and will prebuild `libxmljs2` successfully. I haven't verified the Dockerfile in this research pass. | §Common Pitfalls (Pitfall 2) | Low-medium — if Alpine, swap to `libxml2-wasm`. Easy to detect at plan-dev time. |
| A5 | Storecove's `/api/v2/discovery/receives` endpoint returns the full documentTypes list for a participant. My evidence is from an excerpt of the docs; the response shape isn't verified. | §Don't Hand-Roll | Low — worst case, planner adds a capability-list-type normaliser. |
| A6 | The existing `PeppolParticipant` table can be extended with XRechnung-specific fields without breaking existing peppol-ae flows. I verified the schema exists but didn't fully trace all existing callers. | §Collision | Medium — planner must trace `peppolRouter.connect` flow before the migration. |

## Open Questions (RESOLVED)

All five questions below were resolved during Phase 61 planning. Resolutions are surfaced inline so downstream agents and reviewers do not need to reconstruct them from plan diffs.

1. **Exact Storecove document_type_id for XRechnung CII.**
   - What we know: Storecove supports XRechnung in both UBL and CII (marketing page). A `document_type_id` is the discriminator on `/document_submissions`.
   - What's unclear: The literal string value. Likely follows the pattern `urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0:...` but needs confirmation.
   - Recommendation: Wave-0 task — submit a known-good XRechnung-CII to Storecove sandbox, log the accepted `document_type_id`, check into `constants.ts`.
   - **RESOLVED:** Plan 01 includes an explicit Wave-0 sandbox probe task that submits a canonical XRechnung-CII sample to the Storecove sandbox, captures the accepted `document_type_id` literal, and pins it into `packages/einvoice/src/profiles/xrechnung-de/constants.ts` as `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID`. Plan 06 consumes this constant in the `send` mutation. No downstream task proceeds without the captured literal.

2. **Whether UK Peppol recipients (NHS / CCS) register CII receive capability in SMP.**
   - What we know: Peppol BIS Billing 3.0 makes CII optional; UK public sector is Peppol-enabled.
   - What's unclear: Empirically, how many NHS trusts register CII vs UBL-only. If most are UBL-only, "one XML for both markets" is misleading.
   - Recommendation: Treat as Pitfall 1; gate the send on per-recipient capability lookup every time (D-11 is load-bearing). Separate future phase to add UBL transformation for UBL-only recipients.
   - **RESOLVED:** Treated as a per-recipient runtime check, not a design-time assumption. Plan 05 implements `assertReceiverAcceptsXRechnung` + `PeppolCapabilityCache` (6h TTL); Plan 06's `send` mutation hard-gates transmission on a positive capability lookup and throws `PARTICIPANT_NOT_REACHABLE` otherwise. UBL transformation for UBL-only recipients is explicitly deferred to a future phase per CONTEXT.md Deferred Ideas.

3. **Which pre-built artifacts the KoSIT release zip contains (SEF JSON vs XSLT vs SCH).**
   - What we know: The repo `itplr-kosit/validator-configuration-xrechnung` builds distributions with XSLT.
   - What's unclear: Whether SEF JSON (saxon-js's native format) is in the zip or whether we must re-compile `.xslt` → `.sef.json` ourselves.
   - Recommendation: Assume we compile SEF from XSLT in `scripts/recompile-kosit-schematron.ts` using `xslt3 -xsl:… -export:…`. [ASSUMED: A7 — verify by downloading the 2026-01-31 release and listing contents; 10-minute task.]
   - **RESOLVED:** Plan 01 ships `scripts/recompile-kosit-schematron.ts` that compiles SEF from XSLT unconditionally (does not rely on pre-built SEF in the zip). Plan 03 Task 1 extracts the zip's `.xsl` + XSD artifacts, runs the compile script to produce `EN16931-CII-validation.sef.json` + `XRechnung-CII-validation.sef.json`, and locks them in-repo via `checksums.txt`. The SEF shape question is rendered moot by always compiling from XSLT.

4. **Reconciliation of `Organization.peppolParticipantId` (CONTEXT.md D-10) vs existing `PeppolParticipant` table.**
   - What we know: Both cannot coexist cleanly.
   - Recommendation: Planner must pick Option A, B, or C (§Collision) and update CONTEXT.md / plan-files accordingly. Recommend Option A.
   - **RESOLVED:** Option A selected — extend the existing `PeppolParticipant` table with XRechnung-specific capability fields (`supportsXRechnungCii`, `lastCapabilityCheckAt`) rather than duplicate participant identity onto `Organization`. Rationale: `PeppolParticipant` already models participant identity + status; duplicating on `Organization` would create dual sources of truth and require dual-write consistency. CONTEXT.md D-10 carries an AMENDMENT note documenting this reconciliation; Plan 01 Task 1 lands the Prisma migration; all downstream send-gate logic (Plan 05 + Plan 06) reads from `PeppolParticipant`.

5. **Storecove webhook event names for transmission status.**
   - What we know: `parseWebhookPayload` handles `event` + `document_guid` + `guid` fields; `storecoveWebhookPayloadSchema` documents available events.
   - What's unclear: Specific event names for "transmitted", "delivered", "failed".
   - Recommendation: Read `packages/einvoice/src/asp/storecove/schemas.ts` during planning; the set is already defined there.
   - **RESOLVED:** Plan 05 authoritatively maps to the three event names surfaced by `packages/einvoice/src/asp/storecove/schemas.ts`: `invoice.transmission.success` → `DELIVERY_ACK`, `invoice.transmission.delivered` → `DELIVERY_ACK` (idempotent with success), `invoice.transmission.failed` → `DELIVERY_FAILED`. Plan 06 Task 2's Storecove webhook handler consumes these literal event names; unknown events are no-op-logged.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | saxon-js / libxmljs2 / fast-xml-parser | ✓ | v24.14.1 | — |
| pnpm | workspace install | ✓ | 9.15.0 | — |
| Native build toolchain (node-gyp, python, make) | libxmljs2 source fallback | Unknown (machine-dependent) | — | libxml2-wasm (pure WASM) |
| Postgres / Neon | Prisma migrations | ✓ (assumed from existing codebase) | — | — |
| Storecove sandbox | Wave-0 document_type_id verification + capability lookup test | ✓ (assumed; peppol-ae integration already uses it) | v2 API | — |
| R2 / S3 | XML + full-report storage | ✓ (existing Phase 56/59 pattern) | — | — |
| QStash | Existing Peppol polling schedule | ✓ (used by `peppolRouter.connect`) | — | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- Native build toolchain for `libxmljs2`: swap to `libxml2-wasm`.

## Validation Architecture

Workflow.nyquist_validation is `true`, so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (einvoice), 4.1.2 (workspace default) |
| Config file | `packages/einvoice/vitest.config.ts` (existing), `packages/validators/vitest.config.ts` (existing) |
| Quick run command | `pnpm --filter @contractor-ops/einvoice test -- --run <pattern>` |
| Full suite command | `pnpm --filter @contractor-ops/einvoice --filter @contractor-ops/validators --filter @contractor-ops/api --filter @contractor-ops/db --filter @contractor-ops/web test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EINV-01 | Generator produces a CII XML that passes KoSIT layer-1 XSD for a minimal valid invoice | unit | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/__tests__/generator.test.ts` | ❌ Wave 0 |
| EINV-01 | Generator embeds BT-10 Leitweg-ID at the correct CII path | unit | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/__tests__/leitweg-id-embed.test.ts` | ❌ Wave 0 |
| EINV-04 | Three-layer validator returns VALID for KoSIT positive fixtures | integration | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/__tests__/validator.test.ts` | ❌ Wave 0 |
| EINV-04 | Validator returns INVALID with specific ruleId for each KoSIT negative fixture | integration | same file | ❌ Wave 0 |
| EINV-04 | SVRL normaliser extracts ruleId + xpath + severity correctly | unit | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/__tests__/svrl-normalizer.test.ts` | ❌ Wave 0 |
| EINV-05 | `leitwegIdSchema` accepts all KoSIT-published valid IDs | unit | `pnpm --filter @contractor-ops/validators test -- --run leitweg-id.test.ts` | ❌ Wave 0 |
| EINV-05 | `leitwegIdSchema` rejects all KoSIT-published invalid IDs (incl. check-digit-wrong) | unit | same file | ❌ Wave 0 |
| EINV-05 | `leitweg-id-resolver.ts` picks contract override over contractor default over none | unit | `pnpm --filter @contractor-ops/api test -- --run services/__tests__/leitweg-id-resolver.test.ts` | ❌ Wave 0 |
| EINV-06 | Storecove adapter maps `format: { kind: 'cii-xrechnung' }` to correct `document_type_id` | unit | `pnpm --filter @contractor-ops/einvoice test -- --run asp/storecove/__tests__/adapter.test.ts` (extend existing) | ❌ Wave 0 (extend) |
| EINV-06 | Send gate rejects transmission when participant status ≠ ACTIVE | integration | `pnpm --filter @contractor-ops/api test -- --run routers/__tests__/einvoice.send.test.ts` | ❌ Wave 0 |
| EINV-06 | Capability lookup cache writes and reads within 6h TTL | integration | same file | ❌ Wave 0 |
| EINV-06 | Send surfaces `PARTICIPANT_NOT_REACHABLE` when capabilities lack CII | integration | same file | ❌ Wave 0 |
| EINV-07 | Finalize mutation writes `EInvoiceLifecycle` + `EInvoiceLifecycleEvent` atomically | integration | `pnpm --filter @contractor-ops/api test -- --run routers/__tests__/einvoice.finalize.test.ts` | ❌ Wave 0 |
| EINV-07 | Invoice list tRPC procedure exposes eInvoiceStatus column + filter chips | integration | `pnpm --filter @contractor-ops/api test -- --run routers/__tests__/invoice.listByOrg.test.ts` (extend) | ❌ Wave 0 (extend) |
| EINV-07 | Compliance tile shows X of Y compliant — verified in RTL | RTL | `pnpm --filter @contractor-ops/web test -- --run app/[locale]/(dashboard)/invoices/__tests__/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter <package> test -- --run <pattern>` — ~10 s on warm cache.
- **Per wave merge:** all einvoice + validators + api + db + web tests — ~3 min.
- **Phase gate:** full suite green + `apps/web/e2e/` smoke targeted at the "E-invoice" tab before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts`
- [ ] `packages/einvoice/src/profiles/xrechnung-de/__tests__/validator.test.ts`
- [ ] `packages/einvoice/src/profiles/xrechnung-de/__tests__/svrl-normalizer.test.ts`
- [ ] `packages/einvoice/src/profiles/xrechnung-de/__tests__/leitweg-id-embed.test.ts`
- [ ] `packages/einvoice/src/profiles/xrechnung-de/__tests__/fixtures/` — checked-in positive + negative KoSIT test-suite samples
- [ ] `packages/validators/src/__tests__/leitweg-id.test.ts` + `leitweg-id.fixtures.ts`
- [ ] `packages/api/src/services/__tests__/leitweg-id-resolver.test.ts`
- [ ] `packages/api/src/services/__tests__/einvoice-lifecycle-fsm.test.ts`
- [ ] `packages/api/src/routers/__tests__/einvoice.finalize.test.ts`
- [ ] `packages/api/src/routers/__tests__/einvoice.send.test.ts`
- [ ] `packages/api/src/routers/__tests__/leitweg-id.test.ts`
- [ ] `scripts/recompile-kosit-schematron.ts` + a smoke test verifying a compiled SEF loads
- [ ] Extend `packages/einvoice/src/asp/storecove/__tests__/adapter.test.ts` for the format discriminator
- [ ] RTL tests for compliance chip / tile / tab under `apps/web/src/app/[locale]/(dashboard)/invoices/__tests__/`

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Better Auth / existing session middleware; all new tRPC procedures go through `tenantProcedure` + `requirePermission` |
| V3 Session Management | yes | Reuse existing session handling; no new auth surface |
| V4 Access Control | yes | All new tables `organizationId`-scoped via Prisma client extension; `requirePermission({ einvoice: ['read' \| 'write'] })` on routers; Leitweg-ID CRUD requires admin-only role |
| V5 Input Validation | yes | Zod at tRPC boundary (`leitwegIdSchema`, `peppolSchemeValueSchema`, `finalizeInputSchema`, webhook schemas) — CLAUDE.md-mandated |
| V6 Cryptography | yes | `StorecoveAdapter.verifyWebhookSignature` uses `timingSafeEqual` + HMAC-SHA256 — already correct. No new cryptographic primitives. |
| V7 Error Handling & Logging | yes | `@contractor-ops/logger` pino instances; no secrets in logs; `lastErrorJson` persisted only after redaction |
| V8 Data Protection | yes | Invoice XML may contain PII (contractor name, tax ID, line item narratives). R2 storage is private; signed URLs TTL 300s; retention policy inherited from Phase 56/59 |
| V10 Malicious Code | yes | XSLT from KoSIT is pinned-release + checksum-committed-to-repo; re-compile script should assert SHA256 against a pinned value |
| V13 API | yes | All tRPC mutations over HTTPS; Storecove webhook HMAC verified before processing; rate limits via `GovApiRateLimiter` |
| V14 Configuration | yes | `STORECOVE_API_KEY`, `STORECOVE_WEBHOOK_SECRET` in `.env.example`; secret rotation documented |

### Known Threat Patterns for the stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XML External Entity (XXE) via attacker-controlled XRechnung or webhook XML | Information Disclosure / Tampering | `libxmljs2` / `saxon-js` — verify `noent: false`, `nonet: true` options. fast-xml-parser ignores DTDs by default but assert explicitly. |
| XSLT stylesheet injection | Tampering / Execution | NEVER load user-supplied XSLT. Only the committed, pinned KoSIT SEF files. |
| XPath injection in SVRL normaliser | Tampering | Parse SVRL with fast-xml-parser against a Zod schema; never build XPath queries from user input. |
| Leitweg-ID stored as untrusted string | Tampering / Integrity | Zod + check-digit refine at ingress; DB unique constraint `(organizationId, value)`. |
| Storecove webhook replay | Tampering | HMAC verification + dedupe on `guid` + reject events older than N minutes. (Planner: confirm dedupe is in place in current webhook handler.) |
| Cross-tenant Leitweg-ID leakage | Information Disclosure | Multi-tenant Prisma extension — every query scoped by `organizationId`. Test coverage asserts this. |
| R2 signed-URL leakage | Information Disclosure | 300s TTL; auth-required download route re-issues short URL server-side. |
| Server-side request forgery from XSD `<xs:import>` | SSRF | libxmljs2 `baseUrl` locked to bundle dir; `nonet: true`. |
| Injection via SVRL message content into UI | XSS | Treat all SVRL message text as untrusted; React escapes by default; never `dangerouslySetInnerHTML`. |
| KoSIT XSLT supply-chain compromise | Tampering | Pin KoSIT release tag + SHA256 checksum in repo. |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] `npm view saxon-js` — 2.7.0, 2024-10-17, axios-only dep
- [VERIFIED: npm registry] `npm view libxmljs2` — 0.37.0, MIT, nan + node-gyp deps
- [VERIFIED: npm registry] `npm view fast-xml-parser` — 5.5.12 (einvoice pins ^5.5.11)
- [VERIFIED: repo] `packages/einvoice/src/profiles/peppol-ae/` — reference profile structure
- [VERIFIED: repo] `packages/einvoice/src/asp/storecove/adapter.ts` — existing HMAC + rate-limit + audit integration
- [VERIFIED: repo] `packages/einvoice/src/asp/types.ts` — `TransmitInvoiceParams` interface to modify for D-09
- [VERIFIED: repo] `packages/db/prisma/schema/peppol.prisma` — existing `PeppolParticipant` + `PeppolTransmission` models
- [VERIFIED: repo] `packages/api/src/routers/peppol.ts` (403 lines) — existing Storecove-wired participant router
- [VERIFIED: repo] `packages/api/src/routers/einvoice.ts` (77 lines) — existing compliance-status router to extend
- [CITED: github.com/itplr-kosit/validator-configuration-xrechnung/releases] release-2026-01-31 (2026-02-05), 2025-07-10, 2025-03-21 — all compatible with XRechnung 3.0.x; Apache-2.0 license
- [CITED: docs.peppol.eu/poacc/billing/3.0/bis/] Peppol BIS Billing 3.0 November 2025 — CII is optional, UBL is mandatory; receivers register capability in SMP
- [CITED: leitweg-id.de/en/buyer-reference-bt-10/] Leitweg-ID format: coarse (2–12) + optional fine (0–30 uppercase alphanumerics) + 2-digit check, max 46 chars, references KoSIT Format specification v2.0.2
- [CITED: theinvoicinghub.com] XRechnung 3.0.2 is a maintenance release correcting BG-27 / BG-28 cardinalities, valid from 2.7.2024
- [CITED: lieferanten.deutschebahn.com CII sample + kpetersdms/validationtool] CII namespaces: rsm / ram / udt / qdt; BT-10 at `/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerReference`

### Secondary (MEDIUM confidence)
- [CITED: storecove.com/docs/] Storecove supports XRechnung in both UBL and CII; `/api/v2/discovery/receives` is the capability lookup endpoint (exact response shape not fully documented)
- [CITED: storecove.com/us/en/solutions/germany/] "Germany has XRechnung in 2 syntaxes (UBL and CII) as well as ZUGFeRD"
- [CITED: blog.seeburger.com] Peppol BIS Billing 3.0 and XRechnung are content-equivalent and interchangeable within Germany
- [CITED: babelway.com] Crown Commercial Service has approved vendors as PEPPOL Access Point Providers for NHS trusts
- [CITED: b2brouter.net] CII-to-UBL transformation is recommended for receivers but must not be used by issuers
- [CITED: jameslan.github.io/libxml2-wasm] WASM alternative to libxmljs2 with good performance

### Tertiary (LOW confidence)
- [ASSUMED] The ISO-7064 MOD 11,10 illustrative implementation in §Code Examples matches KoSIT's exact spec — flagged as A1.
- [ASSUMED] Render uses a debian-based Node image that will prebuild libxmljs2 — flagged as A4.
- [ASSUMED] Storecove's `document_type_id` for XRechnung-CII is derivable from Peppol doc-type-ID patterns — flagged as A2.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry; existing repo usage confirms compatibility.
- Architecture: HIGH — mirrors established peppol-ae pattern; new patterns (FSM, three-layer validator) are straightforward.
- Pitfalls: HIGH — the three highlighted pitfalls (CII-vs-UBL for UK, libxmljs2 prebuild, Mod-11-10 confusion) have concrete citations.
- Collision with existing Peppol tables: HIGH — verified by reading the actual schema and router files.
- Storecove CII document_type_id: MEDIUM — documented at a marketing level but not publicly enumerated; sandbox-verify Wave-0 task required.
- Leitweg-ID exact check-digit algorithm: MEDIUM — spec references KoSIT v2.0.2 but the one-page web excerpt doesn't reproduce the step-by-step algorithm; mitigation via fixtures-based round-trip testing.

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days — KoSIT release cadence is roughly quarterly; Storecove v2 API is stable; saxon-js / libxmljs2 unlikely to break in 30 days)

---

*Phase: 61-xrechnung-e-invoicing*
*Researcher: gsd-phase-researcher (inline, sonnet/opus)*
