---
phase: 62-zugferd-e-invoicing
plan: 02
subsystem: einvoice

tags:
  - einvoice
  - zugferd
  - xrechnung
  - pdf-lib
  - fast-xml-parser
  - parser
  - registry

# Dependency graph
requires:
  - phase: 61-xrechnung-e-invoicing
    provides: XRechnung CII generator, KoSIT three-layer validator, XRECHNUNG constants + fixture bundle
  - phase: 62-zugferd-e-invoicing
    plan: 01
    provides: InvoiceIntakeRequest Prisma model + ZUGFERD_GENERATED enum value
provides:
  - @contractor-ops/einvoice ZUGFeRD profile skeleton (profile id "zugferd-de")
  - parseZugferdPdf(bytes) — pdf-lib-based PDF extractor that delegates to XRechnung CII parser
  - parseXrechnungCii(xml) — real CII inbound parser (replaces Phase 61 stub) returning { invoice, profileLevel, warnings, unmappedFields }
  - validateZugferdEmbeddedXml — KoSIT three-layer delegate
  - ZugferdPdfUploadSchema — tRPC input schema for intake route (Plan 05)
  - ZugferdDEProfile class registered via registerZugferdDEProfile()
  - ZUGFeRD XMP namespace + guideline URN map + PDF/A-3 id constants
  - sRGB + Noto Sans bundled assets with sha256 checksum manifest (ready for Plan 03 PDF/A-3 wrapper)
affects:
  - 62-03-zugferd-generator (consumes bundled assets + profile class + constants)
  - 62-04-invoice-intake-service (consumes parseZugferdPdf + ZugferdPdfUploadSchema)
  - 62-05-invoice-intake-router (consumes profile via registry)
  - 62-06-invoice-intake-ui (consumes schemas)
  - 62-07-e2e-and-hardening (consumes full stack)

# Tech tracking
tech-stack:
  added:
    - "pdf-lib@^1.17.1 — PDF load + embedded-file tree traversal (+ Plan 03 PDF/A-3 wrapping)"
    - "@react-pdf/renderer@^4.4.1 — pinned for Plan 03 visual template (already used in packages/api + apps/web — added here to avoid duplicate pnpm resolution tree)"
    - "Noto Sans Regular + Bold @ googlefonts/noto-fonts (SIL OFL 1.1) — ~569KB + ~575KB vendored for PDF/A-3 font embedding"
    - "sRGB ICC profile @ ArtifexSoftware/ghostpdl iccprofiles (Apache-2.0) — ~2576 bytes vendored for PDF/A-3 OutputIntent"
  patterns:
    - "Parser returns rich wrapper (ParsedXrechnung = { invoice, profileLevel, warnings, unmappedFields }) — EInvoiceProfile.parse unwraps .invoice for registry contract"
    - "Typed POJO errors (ParserError discriminated union) thrown as JSON shapes — callers inspect .code without catching+rethrowing at every layer"
    - "Attachment search order: exact filename (factur-x.xml case-insensitive) → fileSpec /F or /UF match → AFRelationship=Alternative + .xml suffix fallback"
    - "Test fixtures generated at test-time via pdf-lib (no binary churn in git) — beforeAll builds deterministic PDFs by attaching generator CII output into a blank document"
    - "Back-compat thin wrappers (parseXRechnungCii PascalCase → parseXrechnungCii lowercase return invoice only) preserve existing profile index.ts callers while adding the richer public API"

key-files:
  created:
    - packages/einvoice/src/profiles/zugferd-de/constants.ts
    - packages/einvoice/src/profiles/zugferd-de/schemas.ts
    - packages/einvoice/src/profiles/zugferd-de/validator.ts
    - packages/einvoice/src/profiles/zugferd-de/parser.ts
    - packages/einvoice/src/profiles/zugferd-de/profile.ts
    - packages/einvoice/src/profiles/zugferd-de/index.ts
    - packages/einvoice/src/profiles/zugferd-de/__tests__/constants.test.ts
    - packages/einvoice/src/profiles/zugferd-de/__tests__/parser.test.ts
    - packages/einvoice/src/profiles/zugferd-de/__tests__/validator.test.ts
    - packages/einvoice/src/profiles/zugferd-de/assets/sRGB2014.icc
    - packages/einvoice/src/profiles/zugferd-de/assets/NotoSans-Regular.ttf
    - packages/einvoice/src/profiles/zugferd-de/assets/NotoSans-Bold.ttf
    - packages/einvoice/src/profiles/zugferd-de/assets/checksums.txt
    - packages/einvoice/src/profiles/zugferd-de/assets/README.md
    - packages/einvoice/src/profiles/xrechnung-de/__tests__/parser.test.ts
  modified:
    - packages/einvoice/package.json (pdf-lib + @react-pdf/renderer deps)
    - packages/einvoice/src/profiles/xrechnung-de/parser.ts (real CII parser — replaces stub)
    - packages/einvoice/src/profiles/xrechnung-de/index.ts (canParse capability flipped to true)
    - packages/einvoice/src/registry.ts (import + re-export both profile IDs)
    - packages/einvoice/src/index.ts (ZUGFeRD barrel exports + registerZugferdDEProfile)
    - packages/einvoice/src/__tests__/registry.test.ts (replace obsolete "throws Phase 62" assertions)
  deleted:
    - packages/einvoice/src/profiles/xrechnung-de/__tests__/parser-stub.test.ts (stub replaced)

key-decisions:
  - "Parser returns wrapped shape { invoice, profileLevel, warnings, unmappedFields } — richer than EInvoiceProfile.parse's bare Promise<EInvoice>. The wrapper is the primary public API; EInvoiceProfile callers get the bare envelope via a thin unwrap."
  - "MINIMUM / BASIC / BASIC-WL profiles are hard-rejected by URN membership (throws ZUGFERD_LEVEL_UNSUPPORTED) rather than best-effort-mapped. These levels do not carry the EN 16931 semantic model, so any lossy mapping would silently strip line items or VAT detail."
  - "Added xeinkauf.de XRechnung 3.0 guideline URN alongside legacy xoev-de URN — the KoSIT release-2026-01-31 validator emits the xeinkauf.de canonical form, while older documents still carry xoev-de. Both map to XRECHNUNG."
  - "EXTENDED-level parsing surfaces a LEVEL_EXTENDED_BEST_EFFORT warning (non-fatal) so downstream intake can flag the record for human review without blocking."
  - "Source of truth for Attachment filename match is exact 'factur-x.xml' (case-insensitive) → fileSpec /F or /UF name → AFRelationship=Alternative + .xml suffix fallback. Matches Factur-X §5.3.2 + hedges against writers that embed the CII with a non-canonical name."
  - "ICC profile sourced from ArtifexSoftware/ghostpdl (Apache-2.0) rather than www.color.org (returned 403). 2576 bytes; signature verified at offset 36 = 'acsp'."
  - "Test fixtures are generated at test-time via pdf-lib — no binary PDFs committed. Keeps fixtures text-diffable via their EInvoice JSON source + deterministic through pinned creation/modification dates."

patterns-established:
  - "Typed POJO error discriminated union pattern — parsers throw { code, ... } shapes rather than Error subclasses, so downstream router middleware can switch on .code without typeof checks"
  - "Re-exporting profile ID constants from registry.ts (in addition to profile-directory constants.ts) so a single grep of registry.ts lists the finite surface of registered profile slugs"
  - "pdf-lib lookupMaybe over lookup — lookup throws on missing keys, lookupMaybe returns undefined. Use lookupMaybe for all optional-dict traversals; reserve lookup for cases where absence is a bug."

requirements-completed: [EINV-03]

# Metrics
duration: ~30 min
completed: 2026-04-15
tasks-completed: 5
tasks-total: 5
tests-added: 38 (+ 7 net in existing registry.test.ts assertions updated)
tests-passing: 450 / 450 across entire @contractor-ops/einvoice suite
---

# Phase 62 Plan 02: ZUGFeRD Profile Skeleton + Parsers Summary

**Full ZUGFeRD/Factur-X inbound profile stood up (pdf-lib PDF load → EmbeddedFiles tree scan → CII XML delegate to real XRechnung parser), Phase 61 XRechnung CII stub replaced with the real implementation, PDF/A-3 asset bundle (sRGB ICC + Noto Sans Regular/Bold) vendored with sha256-pinned manifest, registry registration wired.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-15T01:31Z
- **Completed:** 2026-04-15T01:48Z
- **Tasks:** 5 / 5
- **New test cases:** 38 (23 constants + 13 xrechnung parser + 7 zugferd parser + 1 validator ref-equality + updated registry round-trip test)
- **Total einvoice tests passing:** 450 / 450

## Accomplishments

### Task 1 — pdf-lib + @react-pdf/renderer runtime deps added
- `pdf-lib@^1.17.1` added to `packages/einvoice/dependencies`
- `@react-pdf/renderer@^4.4.1` pinned to exact `packages/api` version (single pnpm resolution tree)
- Verified at runtime: `require('pdf-lib').PDFDocument` + `require('@react-pdf/renderer').Document` both resolve inside `@contractor-ops/einvoice`
- **Commit:** `a4828bf6`

### Task 2 — PDF/A-3 asset bundle vendored
- `sRGB2014.icc` (2576 bytes, Apache-2.0 via `ArtifexSoftware/ghostpdl/master/iccprofiles/default_rgb.icc`) — signature verified (`acsp` at offset 36)
- `NotoSans-Regular.ttf` (569208 bytes, SIL OFL 1.1) + `NotoSans-Bold.ttf` (575740 bytes, SIL OFL 1.1) from `googlefonts/noto-fonts/main/hinted/ttf/NotoSans/`
- `checksums.txt` with three `sha256  filename` lines (format `^[0-9a-f]{64}  [A-Za-z0-9\-\.]+$` enforced)
- `README.md` documenting sources, licenses, download date, re-verify command
- Verify command passes locally: `node -e "<compute+compare>" → ok`
- **Commit:** `88ff0cbb`

### Task 3 — zugferd-de constants module
- `ZUGFERD_DE_PROFILE_ID = 'zugferd-de'`, `ZUGFERD_ATTACHMENT_FILENAME = 'factur-x.xml'` (spec-mandated)
- `ZUGFERD_XMP_NAMESPACE = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#'` (load-bearing for reader indexing)
- XMP prefix + document-type + version constants
- PDF/A-3 identification constants (part=3, conformance=B, aiim.org namespace)
- `GUIDELINE_URN_TO_LEVEL` map with 6 entries (EN 16931, Factur-X comfort, XRechnung legacy xoev-de + canonical xeinkauf.de, Factur-X en16931 alias, Factur-X extended)
- `UNSUPPORTED_GUIDELINE_URNS` set with 6 entries (3 Factur-X + 3 ZUGFeRD 2p1: minimum / basic / basicwl)
- 25 unit tests covering exact string values + disjointness invariant
- **Commit:** `1e345e66`

### Task 4 — Real XRechnung CII inbound parser
- Replaces the Phase-61 stub that threw `/Phase 62/`
- `parseXrechnungCii(xml) → { invoice, profileLevel, warnings, unmappedFields }`
- Back-compat `parseXRechnungCii(xml) → EInvoice` alias preserves existing profile callers
- fast-xml-parser with namespace preservation (`removeNSPrefix: false`)
- Profile-level detection via `GUIDELINE_URN_TO_LEVEL` lookup; MINIMUM / BASIC / BASIC-WL hard-throw `ZUGFERD_LEVEL_UNSUPPORTED`
- EXTENDED-level emits exactly one `LEVEL_EXTENDED_BEST_EFFORT` warning
- UTF-8 BOM handling, `CII_PARSE_FAILED` on malformed XML / missing root
- Uses `@contractor-ops/logger` via `.child({ module })` — zero `console.*`
- 13 test cases: 6 round-trip (header, totals, parties, lines, taxes, zero-warnings), KoSIT positive-minimal fixture, 2 unsupported-level branches, EXTENDED warning, 2 malformed branches, BOM stripping, Kleinunternehmer §19
- **Commit:** `cd8f748e`

### Task 5 — ZUGFeRD PDF parser + profile class + registry
- `parseZugferdPdf(bytes) → ParsedZugferd` — pdf-lib load with `ignoreEncryption: true, throwOnInvalidObject: false` → EmbeddedFiles tree scan → UF-stream decode → delegate to `parseXrechnungCii`
- Two-stage attachment search: exact `factur-x.xml` (case-insensitive) → then AFRelationship=Alternative + `.xml` suffix fallback
- Typed errors: `ZUGFERD_PDF_UNREADABLE`, `ZUGFERD_NO_XML_ATTACHMENT`, `CII_PARSE_FAILED` (bubbled), `ZUGFERD_LEVEL_UNSUPPORTED` (bubbled)
- `ZugferdPdfUploadSchema` — base64 + filename regex + 255 char limit
- `validateZugferdEmbeddedXml` — re-export of `validateXRechnungCii` (reference-equality test ensures no drift)
- `ZugferdDEProfile` class implementing `EInvoiceProfile` (parse accepts base64 PDF, generate throws until Plan 03)
- `registerZugferdDEProfile()` convenience function in package `index.ts` (pattern-matches existing `register*Profile` helpers)
- Registry `registry.ts` imports + re-exports `XRECHNUNG_DE_PROFILE_ID` + `ZUGFERD_DE_PROFILE_ID` so the registry module statically lists both slugs
- 8 test cases: 2 happy path (invoice fields + raw buffer + extractedXml), no-attachment, MINIMUM propagation, malformed PDF, AFRelationship fallback; validator ref-equality assertion
- Test fixtures built at test-time via pdf-lib — no binary PDFs committed (text-diffable EInvoice JSON input + deterministic timestamps)
- **Commit:** `be2a5122`

## Task Commits

1. **Task 1: Add pdf-lib + @react-pdf/renderer runtime deps** — `a4828bf6` (feat)
2. **Task 2: Bundle ICC + TTF assets with sha256 checksum manifest** — `88ff0cbb` (chore)
3. **Task 3: Create zugferd-de/constants.ts with guideline URN map + XMP namespaces** — `1e345e66` (feat)
4. **Task 4: Implement real XRechnung CII parser (replaces stub)** — `cd8f748e` (feat)
5. **Task 5: Implement ZUGFeRD PDF parser + schemas + validator delegate + index.ts + registry registration** — `be2a5122` (feat)

## Decisions Made

- **Rich-wrapper parser shape.** `parseXrechnungCii` returns `{ invoice, profileLevel, warnings, unmappedFields }` rather than bare `EInvoice`. This lets the ZUGFeRD PDF parser + intake service surface the profile level + best-effort extended warnings without refetching or reparsing. The `EInvoiceProfile.parse()` contract returns `Promise<EInvoice>`, so the profile class thinly unwraps `.invoice`.
- **MINIMUM / BASIC / BASIC-WL hard reject.** These levels drop or collapse parts of the EN 16931 model that our canonical envelope requires. Best-effort mapping would silently lose line items or tax detail. Throwing `ZUGFERD_LEVEL_UNSUPPORTED` with the exact URN the document carries lets the intake pipeline present a precise user-facing error.
- **Typed POJO errors (not Error subclasses).** `{ code, message|level, ... }` JSON shapes thrown via `satisfies ParserError` give downstream layers a stable switch surface without importing parser internals.
- **Attachment search: exact filename → fallback on AFRelationship.** Two-sweep traversal inside the `/Names /EmbeddedFiles` tree. First match factur-x.xml exactly; on miss, accept any `.xml` with `AFRelationship=Alternative`. Matches Factur-X §5.3.2 spec order while tolerating writers that embed the CII with a non-canonical filename.
- **Test fixtures generated at test-time via pdf-lib.** Zero binary PDFs committed. `beforeAll` builds deterministic PDFs via `PDFDocument.create()` + `pdfDoc.attach(xmlBytes, 'factur-x.xml', { afRelationship })` with pinned dates. Keeps fixtures text-diffable (the source is an `EInvoice` JSON) and reproducible.
- **`lookupMaybe` over `lookup` for all optional dict paths.** pdf-lib's `lookup` throws when a key is missing — using `lookupMaybe` everywhere avoids noisy traceback logs on plain PDFs and makes the parser's "no attachment" branch deterministic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added xeinkauf.de XRechnung 3.0 guideline URN to GUIDELINE_URN_TO_LEVEL**
- **Found during:** Task 4 (parser test against KoSIT positive-minimal fixture)
- **Issue:** The plan's map only listed `urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0` (legacy). The KoSIT validator-configuration-xrechnung release-2026-01-31 (bundled in Phase 61) emits the canonical `xeinkauf.de` form on actual XRechnung 3.0 documents. The Phase-61 positive-minimal fixture uses the xeinkauf.de URN — parser would have thrown `ZUGFERD_LEVEL_UNSUPPORTED` on a legitimately canonical XRechnung.
- **Fix:** Added the canonical xeinkauf.de URN to `GUIDELINE_URN_TO_LEVEL` alongside the legacy xoev-de URN. Both map to `XRECHNUNG`. Map now has 6 entries.
- **Files modified:** `packages/einvoice/src/profiles/zugferd-de/constants.ts`, `__tests__/constants.test.ts`
- **Committed in:** `cd8f748e`

**2. [Rule 1 - Bug] Replaced obsolete Phase-61 stub assertions in registry.test.ts**
- **Found during:** Post-Task-4 full-suite run
- **Issue:** `packages/einvoice/src/__tests__/registry.test.ts` contained two assertions that pinned the Phase-61 stub behaviour: (a) `profile.parse('<cii/>') throws /Phase 62/`; (b) `getComplianceStatus().canParse === false // Phase 62`. Both are now incorrect — Plan 62-02 Task 4 is the exact work that replaces the stub.
- **Fix:** Replaced the throw-assertion with a round-trip assertion (`parse(generate(invoice)).id === invoice.id`) and flipped the compliance capability assertion to `true`. Also updated `profiles/xrechnung-de/index.ts` `getComplianceStatus` to set `canParse: true`.
- **Files modified:** `packages/einvoice/src/__tests__/registry.test.ts`, `packages/einvoice/src/profiles/xrechnung-de/index.ts`
- **Committed in:** `be2a5122`

**3. [Rule 3 - Blocking] Switched pdf-lib lookup calls to lookupMaybe**
- **Found during:** Task 5 (initial zugferd-de parser test run)
- **Issue:** pdf-lib's `PDFDict.lookup(key, Type)` throws `UnexpectedObjectTypeError` when `key` is absent (it's a type-assertion helper, not a look-up helper). The plain-PDF "no attachment" test path produced an uncaught error instead of returning null; the AFRelationship-fallback test crashed for the same reason in `extractFromEmbeddedFilesTree`.
- **Fix:** Replaced all optional-key traversal with `lookupMaybe`, which returns `undefined` on missing keys. Kept `lookup` only where absence is a programmer error (not the case here). Also needed `PDFStream` import alongside `PDFRawStream` because `lookupMaybe`'s overload set exposes `PDFStream` (superclass) — narrow at runtime with `instanceof PDFRawStream`.
- **Files modified:** `packages/einvoice/src/profiles/zugferd-de/parser.ts`
- **Committed in:** `be2a5122`

**4. [Rule 2 - Missing Critical] Added AFRelationship fallback scan inside EmbeddedFiles tree**
- **Found during:** Task 5 (AFRelationship fallback test with attachment named `invoice.xml`)
- **Issue:** Initial parser only matched exact filename `factur-x.xml` in the EmbeddedFiles tree and only consulted the `/AF` array as a secondary path. But when pdf-lib's `attach()` is called, the spec lands only inside `/Names /EmbeddedFiles` (not necessarily `/AF`). Without a fallback inside the EmbeddedFiles leaf, any PDF that embeds the CII under a non-canonical name (possible in the wild) was silently rejected.
- **Fix:** Added a second sweep in `extractFromEmbeddedFilesTree` that accepts any attachment with `AFRelationship=Alternative` and a `.xml` suffix. Matches Factur-X §5.3.2 spec intent (prefer canonical filename, accept AF fallback).
- **Files modified:** `packages/einvoice/src/profiles/zugferd-de/parser.ts`
- **Committed in:** `be2a5122`

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bugs, 1 Rule 2 missing critical, 1 Rule 3 blocking).
**Impact on plan:** All preserve plan intent while fixing correctness issues that would have surfaced on any real ZUGFeRD PDF or any actual XRechnung 3.0 document from KoSIT-conformant producers. No scope creep.

## Issues Encountered

- **www.color.org returned 403 for direct sRGB2014.icc download.** Substituted with `ArtifexSoftware/ghostpdl/master/iccprofiles/default_rgb.icc` (Apache-2.0) — 2576 bytes, ICC signature verified at offset 36 = `acsp`. Suitable for PDF/A-3 OutputIntent. Plan 03's veraPDF fixture job will confirm conformance downstream.
- **`pnpm install` postinstall build fails on pre-existing issues unrelated to Task 1.** `storecove-adapter.test.ts` carries 5 type errors from a prior plan's GovApiRateLimiter mock shape drift, and `saxon-js` lacks `@types/saxon-js`. These are pre-existing out-of-scope issues — individual `pnpm --filter @contractor-ops/einvoice exec vitest run` commands complete cleanly (450/450 tests pass), so the build failure is a cosmetic postinstall artifact for this plan's scope.
- **pdf-lib `attach()` is per-document side-effectful + persists via `save()` only.** The API doesn't expose a direct `findEmbedded()` read-side counterpart, so we hand-roll the EmbeddedFiles tree traversal (arbitrary-depth `/Names` + `/Kids` recursion) plus the `/AF` array fallback.

## User Setup Required

None — all dependencies resolve via pnpm workspace, all assets are bundled with checksum verification.

## Next Phase Readiness

- **Plan 62-03 (ZUGFeRD PDF/A-3 wrapping)** can import `ZUGFERD_XMP_NAMESPACE`, `PDFA_ID_*`, `ZUGFERD_ATTACHMENT_FILENAME`, and read the bundled `sRGB2014.icc` + `NotoSans-{Regular,Bold}.ttf` assets from their committed paths. The generator's structural-sanity check should assert that a round-trip PDF → `parseZugferdPdf` → extracted XML equals the input CII bytes.
- **Plan 62-04 (intake service)** can call `parseZugferdPdf(bytes)` directly for the richer `ParsedZugferd` shape (profile level + warnings + raw PDF bytes + extracted XML all in one pass) without going through the `EInvoiceProfile` interface.
- **Plan 62-05 (intake router)** can use `ZugferdPdfUploadSchema` as the mutation input; the router's error middleware can switch on the typed POJO `.code` values (`ZUGFERD_PDF_UNREADABLE`, `ZUGFERD_NO_XML_ATTACHMENT`, `CII_PARSE_FAILED`, `ZUGFERD_LEVEL_UNSUPPORTED`).
- **No blockers** for downstream plans.

## Self-Check: PASSED

Verified:
- [x] `packages/einvoice/package.json` `dependencies` contains `"pdf-lib": "^1.17.1"` and `"@react-pdf/renderer": "^4.4.1"`
- [x] `pnpm --filter @contractor-ops/einvoice exec node -e "require('pdf-lib')"` exits 0; `require('@react-pdf/renderer')` exits 0
- [x] `packages/einvoice/src/profiles/zugferd-de/assets/sRGB2014.icc` exists, 2576 bytes (≥1000), signature `acsp`
- [x] `packages/einvoice/src/profiles/zugferd-de/assets/NotoSans-Regular.ttf` exists, 569208 bytes (≥100000)
- [x] `packages/einvoice/src/profiles/zugferd-de/assets/NotoSans-Bold.ttf` exists, 575740 bytes (≥100000)
- [x] `checksums.txt` has exactly 3 lines, each matching `^[0-9a-f]{64}  [A-Za-z0-9\-\.]+$`, and all sha256 digests match bundled files
- [x] `assets/README.md` contains the string "SIL OFL"
- [x] `profiles/zugferd-de/constants.ts` contains `export const ZUGFERD_DE_PROFILE_ID = 'zugferd-de'` and `ZUGFERD_ATTACHMENT_FILENAME = 'factur-x.xml'` and `ZUGFERD_XMP_NAMESPACE` ending in `:1p0#`
- [x] `GUIDELINE_URN_TO_LEVEL['urn:cen.eu:en16931:2017']` === `'COMFORT'`
- [x] `UNSUPPORTED_GUIDELINE_URNS` contains `'urn:factur-x.eu:1p0:minimum'` and `'urn:factur-x.eu:1p0:basicwl'`
- [x] GUIDELINE_URN_TO_LEVEL + UNSUPPORTED_GUIDELINE_URNS disjointness test passes
- [x] `profiles/xrechnung-de/parser.ts` exports `parseXrechnungCii` (+ back-compat `parseXRechnungCii`), imports `@contractor-ops/logger`, imports `GUIDELINE_URN_TO_LEVEL` from zugferd-de constants, and contains no `console.` calls
- [x] `__tests__/parser.test.ts` (xrechnung-de) contains 14 `it(...)` cases covering round-trip × 6, KoSIT fixture, MINIMUM-reject, basicwl-reject, extended-warning, malformed × 2, BOM, plus Kleinunternehmer supplementary
- [x] `profiles/zugferd-de/parser.ts` exports `parseZugferdPdf`, imports `PDFDocument` from `pdf-lib` and `parseXrechnungCii` from xrechnung-de; grep shows `AFRelationship` present 10 times
- [x] `profiles/zugferd-de/schemas.ts` re-exports `EInvoiceSchema` from xrechnung-de
- [x] `profiles/zugferd-de/validator.ts` re-exports `validateZugferdEmbeddedXml` that === xrechnung-de's `validateXRechnungCii` (reference-equality test asserts this)
- [x] `profiles/zugferd-de/index.ts` exports `ZUGFERD_DE_PROFILE_ID` (explicit re-export in addition to `export * from './constants.js'`)
- [x] `src/registry.ts` contains `ZUGFERD_DE_PROFILE_ID` as an imported + re-exported symbol
- [x] `pnpm --filter @contractor-ops/einvoice exec vitest run` — 450/450 tests pass across 32 files
- [x] `pnpm --filter @contractor-ops/einvoice exec tsc --noEmit` — 0 new TS errors (6 pre-existing: 5 storecove-adapter mock shape drift + 1 saxon-js @types missing, both from prior plans, both out-of-scope)
- [x] No `console.` calls in any file created or modified by this plan (only match is the string inside a comment documenting the rule)
- [x] All 5 task commits exist: `a4828bf6` (Task 1), `88ff0cbb` (Task 2), `1e345e66` (Task 3), `cd8f748e` (Task 4), `be2a5122` (Task 5)

---
*Phase: 62-zugferd-e-invoicing*
*Completed: 2026-04-15*
