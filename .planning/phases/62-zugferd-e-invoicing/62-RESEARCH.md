# Phase 62 — Technical Research: ZUGFeRD E-Invoicing

**Researched:** 2026-04-14
**Status:** Complete — ready for planning
**Scope:** ZUGFeRD PDF/A-3 generation (EINV-02) + inbound XRechnung/ZUGFeRD parsing into a staging intake entity (EINV-03)

> This document synthesises the locked decisions in `62-CONTEXT.md` (D-01 through D-17) with library-level technical verification (pdf-lib, @react-pdf/renderer, ZUGFeRD 2.3.2 spec, veraPDF). It answers: "what do we need to know to plan this phase well?" CONTEXT.md already locked every load-bearing architectural decision — research here confirms those decisions are implementable with the chosen stack and surfaces concrete API calls the planner can encode into task `action` fields.

---

## Standard Stack (confirmed — no changes from project defaults)

| Layer | Tool | Status | Source |
|-------|------|--------|--------|
| PDF visual rendering | `@react-pdf/renderer` 4.4.1 | Already on `apps/web` + `packages/api` → add to `packages/einvoice` | CONTEXT.md D-04; `packages/api/src/pdf-templates/ir35-sds.tsx` |
| PDF/A-3 post-processing | `pdf-lib` (latest stable at plan time, targeting ~1.17.x) | New dep for `packages/einvoice` (runtime) | CONTEXT.md D-04; pdf-lib `/hopding/pdf-lib` docs |
| CII XML generation | In-house `packages/einvoice/src/profiles/xrechnung-de/generator.ts` | Reused verbatim from Phase 61 | CONTEXT.md D-02 |
| CII XML parsing | `fast-xml-parser` 5.5.11 | Already dep of `packages/einvoice` | CONTEXT.md D-07 |
| XML validation (3-layer KoSIT) | `packages/einvoice/src/profiles/xrechnung-de/validator.ts` | Reused verbatim from Phase 61 | CONTEXT.md D-08 |
| Database | Prisma 7 + Neon (multi-tenant extension) | Existing pattern | CONTEXT.md D-09; MEMORY.md `project_stack` |
| tRPC | v11 | Existing pattern | MEMORY.md `project_stack` |
| Object storage | Cloudflare R2 via `packages/api/src/services/r2.ts` | Existing pattern (content-addressed, signed URLs 300s) | CONTEXT.md D-15 |
| veraPDF conformance (CI) | Docker image `verapdf/cli:1.26` | New CI job on PRs touching `packages/einvoice/**` | CONTEXT.md D-05 |
| UI library | shadcn/ui (`base-nova` preset) on Next.js 15 | Already in place | 62-UI-SPEC.md |
| Logging | `@contractor-ops/logger` (Pino) | Project-wide; no `console.*` | MEMORY.md `feedback_logging` |
| Feature flag | `EINVOICE_IMPORT_ENABLED` via the Unleash wrapper | CONTEXT.md D-14; MEMORY.md `feature_flags_strategy` | |

---

## Architecture Patterns (confirmed)

### Outbound ZUGFeRD generation

Pipeline (CONTEXT.md D-04):

1. **CII XML** — reuse `buildXrechnungCii({ invoice })` from `xrechnung-de/generator.ts`. Output is a `string`. No fork.
2. **Visual PDF render** — new `zugferd-de/invoice-template.tsx` (React-PDF). Produces a `Uint8Array` via `renderToBuffer(<InvoiceDocument …/>)`.
3. **PDF/A-3 post-process** — new `zugferd-de/pdf-wrapper.ts`:
   - Load the rendered PDF: `const pdfDoc = await PDFDocument.load(renderedBytes)`
   - Attach the CII XML:
     ```ts
     const cii = new TextEncoder().encode(xmlString);
     await pdfDoc.attach(cii, 'factur-x.xml', {
       mimeType: 'application/xml',
       description: 'ZUGFeRD (Factur-X) CII XML invoice payload',
       afRelationship: AFRelationship.Alternative,
       creationDate: invoice.issueDate,
       modificationDate: new Date(),
     });
     ```
     (pdf-lib's `pdfDoc.attach` API accepts `afRelationship` natively per `/hopding/pdf-lib` docs — no need for manual `/AF` dictionary construction.)
   - Embed sRGB OutputIntent: pdf-lib does NOT expose `OutputIntent` as a high-level API. We construct it manually by adding a raw `PDFDict` via `pdfDoc.context.obj({ Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: 'sRGB', RegistryName: 'http://www.color.org', Info: 'sRGB IEC61966-2.1', DestOutputProfile: PDFStream(iccBytes) })`, then push to the catalog's `/OutputIntents` array: `pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntentRef]))`.
   - Write XMP metadata: pdf-lib's `setTitle/setAuthor/etc.` write Info-dict values. For the PDF/A-3 + ZUGFeRD XMP extension schema we build the XMP XML packet as a UTF-8 string (template in `zugferd-de/xmp-template.ts`), then set it as the catalog's `/Metadata` stream:
     ```ts
     const metadataStream = pdfDoc.context.stream(xmpBytes, { Type: 'Metadata', Subtype: 'XML' });
     pdfDoc.catalog.set(PDFName.of('Metadata'), pdfDoc.context.register(metadataStream));
     ```
   - Strip transparency / embed fonts: React-PDF subsets `Helvetica`-family fonts by default for embedded glyphs only. For PDF/A-3 full embedding, we explicitly `Font.register({ family: 'Noto Sans', src: bundled .ttf })` inside the template and use it as default. Noto Sans is licensed under the SIL Open Font License and is ~500KB subset-friendly.
   - Force PDF version to 1.7 (PDF/A-3 requires ≥ 1.7): `pdfDoc.context.header = PDFHeader.forVersion(1, 7)` or via save option.
4. **Structural sanity check** (`zugferd-structural-check.ts`): parse the output bytes back, assert: (a) catalog has `/Metadata` with XMP containing `pdfaid:part=3` + `fx:DocumentFileName=factur-x.xml`; (b) catalog has `/Names /EmbeddedFiles` with `factur-x.xml`; (c) `/AF` entry references the embedded file; (d) `/OutputIntents` present. Throws `ZUGFERD_WRAPPING_FAILED` with specific subcode on any missing invariant.

### Inbound parsing

- **CII parser (`xrechnung-de/parser.ts`)** — fleshes out the current stub. Uses `fast-xml-parser` with options `{ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: false }` to preserve `rsm:`/`ram:`/`udt:` namespaces. Walks the parsed tree and maps each CII path back to the `EInvoice` / `EInvoiceLine` envelope — inverse of `generator.ts`. Validation of XSD correctness is a separate concern handled by the Phase 61 validator.

  Profile-level detection: read `/rsm:CrossIndustryInvoice/rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID`; compare against a constant map:
  - `urn:cen.eu:en16931:2017` → `COMFORT`
  - `urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0` → `XRECHNUNG`
  - `urn:factur-x.eu:1p0:extended` → `EXTENDED`
  - `urn:factur-x.eu:1p0:basic` or `*:basic-wl` or `*:minimum` → `TOO_LOW` (reject in parser)

- **PDF parser (`zugferd-de/parser.ts`)** — uses `pdf-lib` to read the `/EmbeddedFiles` tree:
  ```ts
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const names = doc.catalog.get(PDFName.of('Names'));
  // walk Names → EmbeddedFiles → Names array of [string, FileSpec, …]
  // match filename 'factur-x.xml' (case-insensitive) OR any EF whose AFRelationship=/Alternative AND filename ends with .xml
  ```
  Extract `EF` stream bytes, decode UTF-8, delegate to the CII parser.

### Intake storage lifecycle

`InvoiceIntakeRequest` state machine (CONTEXT.md D-09, D-10, D-12):

```
upload → PARSED (if valid XSD + supported level)
PARSED → NEEDS_REVIEW   (if schematron warnings/errors)
PARSED / NEEDS_REVIEW → MATCHED     (user clicks Confirm match)
MATCHED → CONVERTED     (user clicks Convert to Invoice — requires validation acknowledged if NEEDS_REVIEW)
any → REJECTED          (user clicks Reject)
```

Hard rejects (no row written): XSD layer-1 failure, no XML attachment in PDF, unsupported level (MINIMUM / BASIC_WL), malformed XML, file > 5 MB, unsupported MIME.

### Matcher (D-11)

`packages/api/src/services/invoice-intake-matcher.ts` — pure function (org-scoped via Prisma extension):

```ts
export async function rankIntakeCandidates(
  db: PrismaClient,
  orgId: string,
  extracted: { supplierVatId?: string; supplierLeitwegId?: string; supplierName: string }
): Promise<MatchCandidate[]>
```

Strategy (deterministic, highest score first):
1. Exact VAT-ID match → score 100 + reason `VAT_ID`
2. Exact Leitweg-ID match → score 90 + reason `LEITWEG_ID`
3. Exact normalised-name match → score 70 + reason `EXACT_NAME`
4. Fuzzy Levenshtein ≤ 3 on normalised name → score `50 - distance*5` + reason `FUZZY_NAME`

Normalisation: lowercase + collapse whitespace + strip `GmbH|UG|AG|Ltd|Limited|Inc` suffixes.

Implementation: use the existing `fast-levenshtein` or implement a tiny DP routine (≤ 40 LoC) — no new dep if dev-only footprint matters.

### Content-addressed storage (D-15)

Reuses Phase 61's pattern verbatim:

| Artifact | R2 key | Source of sha256 |
|----------|--------|------------------|
| Raw uploaded PDF | `einvoice-intake/{orgId}/{sha256[0:16]}.pdf` | sha256 of the uploaded bytes |
| Raw uploaded XML | `einvoice-intake/{orgId}/{sha256[0:16]}.xml` | sha256 of the uploaded bytes |
| Extracted XML (from PDF upload) | `einvoice-intake/{orgId}/{sha256[0:16]}-extracted.xml` | sha256 of the extracted bytes |
| KoSIT HTML report | `einvoice-intake/{orgId}/{sha256[0:16]}-{ruleSetVersion}-report.html` | sha256 of the extracted XML |
| Generated ZUGFeRD PDF | `einvoice-pdf/{orgId}/{invoiceId}/{sha256[0:16]}.pdf` | sha256 of the generated PDF |

Signed URL TTL 300s. Dedup unique constraint: `@@unique([organizationId, rawFileSha256])` on `InvoiceIntakeRequest`.

### tRPC router (D-16, D-17)

New router `packages/api/src/routers/invoice-intake.ts` registered in `packages/api/src/routers/root.ts`. Extend existing `einvoice.ts` with `generateZugferdPdf`. All inputs validated with Zod at the tRPC boundary (CLAUDE.md § Validation & Data Safety). All procedures multi-tenant-scoped via the existing Prisma extension.

### UI structure (from 62-UI-SPEC.md)

- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` — gains `<ImportSplitButton>` in the header
- `apps/web/src/app/[locale]/(dashboard)/invoices/intake/page.tsx` — new list route
- `apps/web/src/app/[locale]/(dashboard)/invoices/intake/[id]/page.tsx` — new detail route
- `apps/web/src/components/invoices/intake/*` — 12 new composition components (enumerated in 62-UI-SPEC.md § Registry Safety)
- `apps/web/src/components/invoices/einvoice-tab/einvoice-tab.tsx` — extend with a "ZUGFeRD" section + "Download ZUGFeRD PDF" button
- Sidebar entry added to `apps/web/src/components/layout/` (or wherever `invoices` section lives), flag-gated
- Messages: `apps/web/messages/{en,de,gb}.json` extended under `EInvoice` namespace (all strings catalogued in 62-UI-SPEC.md § Copywriting Contract)

---

## Validation Architecture (Nyquist — Dimension 8)

Layered defence, each gate with an explicit failure-surface and a test that exercises the gate:

| Gate | Layer | Failure mode | Where tested |
|------|-------|--------------|--------------|
| G1 | Zod input schema on every tRPC procedure | Invalid request shape → 400 with field path | `packages/api/src/routers/__tests__/invoice-intake.test.ts` — "rejects …" cases |
| G2 | File size + MIME sniff on `upload` | >5 MB or wrong MIME → typed error `FILE_TOO_LARGE` / `UNSUPPORTED_MIME` | same |
| G3 | XSD (CII D16B) validation, layer 1 | Hard reject → `CII_XSD_INVALID` (no row created) | `xrechnung-de` validator already tested; extend fixture for inbound |
| G4 | Profile-level gate (MINIMUM/BASIC_WL) | Hard reject → `ZUGFERD_LEVEL_UNSUPPORTED` | new `zugferd-de/__tests__/parser.test.ts` |
| G5 | Schema-set invariants in generator sanity check | `ZUGFERD_WRAPPING_FAILED:{subcode}` throw | new `zugferd-de/__tests__/pdf-wrapper.test.ts` |
| G6 | Structural integrity assertions in parser | `ZUGFERD_NO_XML_ATTACHMENT` on missing EF | new parser test |
| G7 | EN 16931 + XRechnung schematron (KoSIT layers 2 & 3) | Soft gate → `validationStatus: WARNINGS / INVALID`; row persists with report | reused from Phase 61 |
| G8 | Unique-constraint dedup `(orgId, sha256)` | P2002 → return existing intake id (idempotent) | intake-service test |
| G9 | State machine guards (`convertToInvoice` requires MATCHED + acknowledged/valid) | `tRPC` precondition error | router test |
| G10 | veraPDF CI Docker gate against 3 golden fixtures | CI job fails, PR blocks merge | `.github/workflows/verapdf.yml` |

**Test Strategy:**

- Unit tests for: CII parser (inverse of generator — round-trip fixture asserts `parse(build(x)) ≈ x`), PDF wrapper (structural sanity invariants), matcher (VAT / Leitweg / fuzzy cases), XMP template render, profile-level detection.
- Integration tests for: each tRPC procedure (upload → parse → validate → persist → match → convert path + all reject paths), idempotent dedup, state-machine guards.
- Fixture tests for veraPDF: 3 golden cases generated deterministically from `packages/einvoice/src/profiles/zugferd-de/__fixtures__/` (minimal COMFORT, reverse-charge + Leitweg-ID, Kleinunternehmer §19).
- A11y + i18n tests on the new routes (following Phase 60 pattern).
- Storybook / visual regression deferred to ongoing design-system phase — not Phase 62 scope.

**Observability:**

- Pino logger with structured fields `{ phase: 'einvoice-intake', stage: 'parse|validate|match|convert|generate-zugferd', intakeId, orgId, profileLevel, validationStatus, durationMs }`.
- No PII in logs beyond `orgId` + `intakeId` (IDs only — never supplier name / VAT / raw bytes).
- Generator failure rate + intake reject rate suitable for future Grafana dashboard; exposed as Pino metrics tags today.

---

## Pitfalls & Risks (discovered during research)

| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| `@react-pdf/renderer` embeds Helvetica by reference (AFM), not subsetting, which fails PDF/A-3 | veraPDF rule 6.3.3 fails | Template explicitly registers Noto Sans (bundled `.ttf` in `zugferd-de/assets/`) and uses it as default family |
| pdf-lib has no native XMP API | Cannot rely on high-level setters | Build XMP XML packet from template string; inject as catalog `/Metadata` stream via low-level `pdfDoc.context` API — verified pattern in pdf-lib issue tracker |
| pdf-lib has no native OutputIntent API | Same | Build `PDFDict` + `PDFStream` for the sRGB ICC profile via low-level context; push into `/OutputIntents` catalog array |
| `PDFDocument.load` on malformed inbound PDFs can throw or silently drop attachments | Parser false-negative "no XML" | Pass `{ ignoreEncryption: true, throwOnInvalidObject: false }` and scan `/AF` entries as fallback when `/Names /EmbeddedFiles` is missing |
| Extracted XML encoding may be UTF-8 with/without BOM, or UTF-16 | Parser malfunction | Detect BOM via `Uint8Array[0..3]`, strip UTF-8 BOM, auto-decode UTF-16 BE/LE; if detection fails, reject with `CII_ENCODING_UNSUPPORTED` |
| Levenshtein on long strings is O(n*m) — Contractor names can be ~60 chars × potentially thousands of rows | Matcher latency ≥ 200ms for large orgs | Pre-filter candidates by first 3 normalised chars via Prisma `startsWith`; run Levenshtein only on pre-filtered set |
| `InvoiceIntakeRequest` duplicates by content hash — a user re-uploading the same document returns the same row | Could be surprising UX | UI explicitly surfaces "Already imported — opening existing intake" toast on 409-equivalent path |
| Base64-encoded file in tRPC input is memory-heavy for 5 MB | Inefficient but acceptable | v5.0 accepts; if file-size cap raised later, migrate to signed-URL direct upload + post-upload validation webhook (deferred) |
| ZUGFeRD spec allows embedded PDFs within EF tree (nested attachments) — we must skip them when searching for `factur-x.xml` | Parser misidentifies wrong attachment | Filter EF iteration to entries with `.xml` suffix AND MimeType=`application/xml` or `text/xml`; fall back to AFRelationship=Alternative filter |
| veraPDF Docker image `verapdf/cli:1.26` pulls ~300 MB; CI runtime could balloon | CI minutes | Cache the image in GH Actions via `docker/setup-buildx-action` + image pull cache; fixtures run in <10s once image cached |
| Intake list "Imports" sidebar nav must NOT appear when `EINVOICE_IMPORT_ENABLED` flag is false, but outbound "Download ZUGFeRD PDF" must always work | Inconsistent UX if both flagged identically | Outbound button has NO flag (always visible when Phase 61 einvoice tab is enabled); only inbound surfaces (sidebar, split-button "Import" item, `/intake/*` routes → 404) are flagged |
| Prisma migration for the new `InvoiceIntakeRequest` table is blocking — forgetting `prisma db push` yields false-positive typecheck passes | Live DB lacks the table; queries fail at runtime | `[BLOCKING]` schema push task injected by the planner — enforced by the Schema Push Detection Gate (Step 5.7 of plan-phase) |
| Locked DE legal phrases: the "Error — XSD reject" copy embeds user-facing legal/statutory implications | Could drift from §14 UStG wording | Route DE error strings through `packages/validators/src/legal/de.ts` with CI parity test (Phase 56 pattern) |
| Multi-tenant safety: intake rows must NEVER leak across orgs | Regulatory incident | Use the existing `prismaForOrg(orgId)` extension for ALL intake queries; add a `tRPCContext.orgId` invariant in middleware |
| The matcher reuses inbound extracted sha256 for dedup — same file uploaded by two users in same org should collapse | Expected | Unique `(orgId, rawFileSha256)`; upload mutation catches P2002 and returns existing intake id |
| XMP namespace URI `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#` is load-bearing — ZUGFeRD readers check for it | If mistyped, readers reject | Store in a constant; assert in `zugferd-structural-check` unit test |
| `@react-pdf/renderer` v4 has a breaking change in the `renderToBuffer` import path vs v3 | Compile error | Pin to `^4.4.1` matching `apps/web` + `packages/api` |

---

## Summary of Implementation Surface

**Net-new packages touched:** `packages/einvoice`, `packages/api`, `packages/db`, `packages/feature-flags`, `apps/web`.

**Net-new files (approximate):**

- `packages/einvoice/src/profiles/zugferd-de/` — `constants.ts`, `schemas.ts`, `invoice-template.tsx`, `xmp-template.ts`, `pdf-wrapper.ts`, `zugferd-structural-check.ts`, `generator.ts`, `parser.ts`, `validator.ts`, `index.ts`, `assets/sRGB2014.icc`, `assets/NotoSans-Regular.ttf`, `assets/NotoSans-Bold.ttf`, `__fixtures__/{minimal,reverse-charge,kleinunternehmer}.json`, `__tests__/` (~6 unit test files).
- `packages/einvoice/scripts/generate-zugferd-fixtures.ts`
- `packages/einvoice/src/profiles/xrechnung-de/parser.ts` — real implementation (replaces stub)
- `packages/db/prisma/schema/invoice.prisma` — add `InvoiceIntakeRequest` + enums; extend `EInvoiceLifecycle` with `zugferdPdfKey`; add `ZUGFERD_GENERATED` enum value to `EInvoiceLifecycleEventType`
- `packages/db/prisma/schema/migrations/{timestamp}_invoice_intake_request/migration.sql`
- `packages/api/src/routers/invoice-intake.ts`
- `packages/api/src/routers/einvoice.ts` — extend with `generateZugferdPdf`
- `packages/api/src/routers/root.ts` — register `invoiceIntake`
- `packages/api/src/services/invoice-intake-service.ts` (upload/parse/validate/persist orchestration)
- `packages/api/src/services/invoice-intake-matcher.ts`
- `packages/api/src/services/__tests__/` (~3 test files)
- `apps/web/src/app/[locale]/(dashboard)/invoices/intake/page.tsx` + `[id]/page.tsx`
- `apps/web/src/components/invoices/intake/` (~12 components per 62-UI-SPEC.md + `__tests__/`)
- `apps/web/src/components/invoices/einvoice-tab/download-zugferd-pdf-button.tsx`
- `apps/web/src/components/layout/` — extend sidebar with flag-gated `Imports` entry
- `apps/web/messages/{en,de,gb}.json` — extend `EInvoice` namespace
- `apps/web/e2e/functional/intake-upload-flow.spec.ts` — new Playwright e2e
- `packages/feature-flags/src/` — register `EINVOICE_IMPORT_ENABLED` (flag definition)
- `.github/workflows/verapdf.yml` (or extend existing `ci.yml` with job)

**Existing files modified:**

- `packages/einvoice/package.json` — add `pdf-lib`, `@react-pdf/renderer` (runtime)
- `packages/einvoice/src/registry.ts` — register `ZUGFERD_DE_PROFILE_ID`
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` — add `<ImportSplitButton>`
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` (or wherever the `<EInvoiceTab>` consumer lives) — show ZUGFeRD section when invoice is finalised

---

## Known unknowns resolved to "Claude's Discretion" defaults

| CONTEXT.md discretion item | Default chosen during research | Rationale |
|----------------------------|--------------------------------|-----------|
| Exact pdf-lib call sequence for XMP writing | Template-string XMP packet + `pdfDoc.context.stream(bytes, { Type: 'Metadata', Subtype: 'XML' })` + `pdfDoc.catalog.set(PDFName.of('Metadata'), ...)` | pdf-lib issue tracker confirms this is the canonical pattern for PDF/A metadata |
| ICC profile choice | `sRGB2014.icc` (3 kB, CC0-equivalent) | Permissive license; smaller than IEC61966-2.1; works with all PDF/A validators |
| Font embedding strategy | Bundle Noto Sans Regular + Bold subset (~600 kB) via `Font.register` | Helvetica cannot be embedded; Noto Sans is SIL OFL licensed and widely supported |
| KoSIT HTML report — inline iframe vs link | Link only (with signed R2 URL TTL 300s) | Start simple; upgrade if usability feedback demands (deferred) |
| Levenshtein threshold | 3 | Standard starting point; tunable post-launch |
| `downloadRawFile` access | Regular users (same org) | They uploaded it; auth handled by multi-tenant extension |
| `_unmappedFields` visibility | Collapsed "Advanced/technical" section on detail page | Developer utility; not core UX |
| File size cap | 5 MB (CONTEXT.md starting point) | ZUGFeRD PDFs typically 1-3 MB |

All "Claude's Discretion" items from CONTEXT.md are now resolved and pinned as plan-actionable defaults.

---

*Research complete. Ready for gsd-planner.*
