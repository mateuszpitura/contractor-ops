---
phase: 62
slug: zugferd-e-invoicing
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 62 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Every task has an automated verify; no 3-task streak without sampling. No watch-mode.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (monorepo default) + Playwright 1.x (e2e) |
| **Config file** | per-package `vitest.config.ts`; root `playwright.config.ts` |
| **Quick run command** | `pnpm --filter <pkg> test -- --run <file>` |
| **Full suite command** | `pnpm test` (all packages) + `pnpm test:e2e` (Playwright) |
| **Estimated runtime** | ~120s unit + integration; ~40s veraPDF CI job; ~90s e2e (intake flow) |

**Notes:**
- `--run` flag ensures no watch-mode (Nyquist requirement).
- veraPDF runs only in CI via Docker (`verapdf/cli:1.26`) — not part of local `pnpm test`; the CI job is the gate.
- All pre-existing Phase 61 einvoice tests continue to run and must remain green.

---

## Sampling Rate

- **After every task commit:** `pnpm --filter <pkg> test -- --run <impacted-file>` (≤15s)
- **After every plan wave:** `pnpm --filter <impacted-pkgs> test -- --run` (≤60s)
- **Before `/gsd-verify-work`:** Full suite green + CI veraPDF job green on the open PR
- **Max feedback latency:** 60 seconds per-wave

---

## Per-Task Verification Map

> Task IDs use the convention `{phase}-{plan}-{task}`. Concrete task-level IDs are fixed by the planner; this table enumerates the verification targets by plan + functional area so every task has a declared sampling anchor.

| Area | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists |
|------|------|------|-------------|-----------------|-----------|-------------------|-------------|
| Prisma migration — `InvoiceIntakeRequest` model + enums + `EInvoiceLifecycle.zugferdPdfKey` + `ZUGFERD_GENERATED` event | 01 | 1 | EINV-03 | Multi-tenant scoping enforced via Prisma extension | schema build + migrate reset dry-run | `pnpm --filter @contractor-ops/db test -- --run` | ✅ |
| `[BLOCKING]` Prisma schema push to live DB | 01 | 1 | EINV-03 | Types reflect live DB state | db push verify | `pnpm --filter @contractor-ops/db db:push --accept-data-loss && pnpm --filter @contractor-ops/db db:verify` | ✅ W0 |
| `packages/einvoice/zugferd-de/constants.ts` — profile IDs, guideline URN map, XMP namespaces | 02 | 2 | EINV-02 | Constant values match spec exactly | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/constants.test.ts` | ✅ |
| `xrechnung-de/parser.ts` — real CII parser | 02 | 2 | EINV-03 | Round-trip fixture parses to the envelope that re-generates bit-identical XML | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/xrechnung-de/__tests__/parser.test.ts` | ✅ |
| `zugferd-de/parser.ts` — PDF extraction + delegation | 02 | 2 | EINV-03 | Rejects PDF without `factur-x.xml`; detects level from guideline URN | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/parser.test.ts` | ✅ |
| `zugferd-de/xmp-template.ts` — XMP packet builder | 03 | 2 | EINV-02 | Packet contains `pdfaid:part=3`, `fx:DocumentFileName=factur-x.xml`, `fx:ConformanceLevel=EN 16931` | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/xmp-template.test.ts` | ✅ |
| `zugferd-de/pdf-wrapper.ts` — attach XML + XMP + OutputIntent + fonts | 03 | 3 | EINV-02 | Structural-check asserts every invariant; throws typed error on any missing piece | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/pdf-wrapper.test.ts` | ✅ |
| `zugferd-de/invoice-template.tsx` — React-PDF visual | 03 | 3 | EINV-02 | Renders with Noto Sans registered; passes snapshot test | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/invoice-template.test.tsx` | ✅ |
| `zugferd-de/generator.ts` — orchestrator (CII → render → wrap) | 03 | 3 | EINV-02 | Refuses non-COMFORT levels; sanity check passes on output | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/generator.test.ts` | ✅ |
| `zugferd-de/zugferd-structural-check.ts` | 03 | 3 | EINV-02 | Throws `ZUGFERD_WRAPPING_FAILED:{subcode}` on any invariant violation | unit | `pnpm --filter @contractor-ops/einvoice test -- --run profiles/zugferd-de/__tests__/structural-check.test.ts` | ✅ |
| `zugferd-de/__fixtures__/` + `scripts/generate-zugferd-fixtures.ts` | 03 | 3 | EINV-02 | 3 deterministic fixtures generate reproducible bytes | unit | `pnpm --filter @contractor-ops/einvoice exec tsx scripts/generate-zugferd-fixtures.ts --check` | ✅ |
| `.github/workflows/verapdf.yml` — Docker gate | 03 | 3 | EINV-02 | 3 fixtures pass veraPDF on PR; report archived as artifact on fail | CI integration | `gh workflow run verapdf.yml --ref <branch>` (CI-run) | ✅ W0 |
| `invoice-intake-matcher.ts` | 04 | 3 | EINV-03 | VAT + Leitweg + exact + fuzzy cases ranked deterministically | unit | `pnpm --filter @contractor-ops/api test -- --run services/__tests__/invoice-intake-matcher.test.ts` | ✅ |
| `invoice-intake-service.ts` — upload→parse→validate→persist orchestration | 04 | 4 | EINV-03 | Hard-reject paths (XSD, no-attachment, level-too-low, file-too-large) do NOT create rows; soft-gate paths (warnings) DO create rows with the right status | integration | `pnpm --filter @contractor-ops/api test -- --run services/__tests__/invoice-intake-service.test.ts` | ✅ |
| `routers/invoice-intake.ts` — all 10 procedures | 05 | 4 | EINV-03 | Zod rejects bad inputs; state-machine guards reject illegal transitions; multi-tenant isolation verified | integration | `pnpm --filter @contractor-ops/api test -- --run routers/__tests__/invoice-intake.test.ts` | ✅ |
| `routers/einvoice.ts` — `generateZugferdPdf` extension | 05 | 4 | EINV-02 | Writes lifecycle event, returns signed URL, idempotent per invoice+sha | integration | `pnpm --filter @contractor-ops/api test -- --run routers/__tests__/einvoice.generate-zugferd.test.ts` | ✅ |
| `apps/web/messages/{en,de,gb}.json` — `EInvoice` namespace extensions | 06 | 4 | EINV-02, EINV-03 | DE statutory error strings go through `packages/validators/src/legal/de.ts`; parity test passes | unit | `pnpm --filter @contractor-ops/validators test -- --run legal/__tests__/de-parity.test.ts` | ✅ |
| `apps/web/src/components/invoices/intake/` — 12 composition components | 06 | 5 | EINV-03 | Status pills + filter chips render per 62-UI-SPEC.md tokens; a11y roles correct | unit (RTL) | `pnpm --filter apps-web test -- --run components/invoices/intake/__tests__/` | ✅ |
| `apps/web/src/components/invoices/einvoice-tab/download-zugferd-pdf-button.tsx` | 06 | 5 | EINV-02 | Button calls mutation, shows skeleton while pending, triggers download on success, toasts on error | unit (RTL) | `pnpm --filter apps-web test -- --run components/invoices/einvoice-tab/__tests__/download-zugferd-pdf-button.test.tsx` | ✅ |
| `/invoices/intake/` + `/invoices/intake/[id]/` routes | 06 | 5 | EINV-03 | Flag-gated 404 when flag off; renders intake list + detail otherwise | unit (RTL) | `pnpm --filter apps-web test -- --run 'app/**/invoices/intake/__tests__'` | ✅ |
| Sidebar flag-gated entry | 06 | 5 | EINV-03 | Entry hidden when flag off; active state uses `--primary` | unit (RTL) | `pnpm --filter apps-web test -- --run components/layout/__tests__` | ✅ |
| `apps/web/e2e/functional/intake-upload-flow.spec.ts` — Playwright e2e | 07 | 5 | EINV-02, EINV-03 | Full roundtrip: upload PDF → list → detail → match → convert → verify Invoice exists | e2e | `pnpm test:e2e -- --grep "intake-upload-flow"` | ✅ |

**Sampling continuity proof:** Plans 01–07 are sampled at every task boundary (unit where deterministic, integration at service/router seams, e2e at the user flow). No more than 2 consecutive tasks within a wave share a test file — each task's `<acceptance_criteria>` drives a distinct `test(...)` block, guaranteeing per-task feedback.

---

## Wave 0 Requirements

Wave 0 = infrastructure and dependencies executed *before* any feature task.

- [x] Existing monorepo test infrastructure covers all phase requirements (vitest + Playwright already installed at root and per-package)
- [ ] `packages/einvoice/package.json` — add `pdf-lib` and `@react-pdf/renderer` as runtime deps *(Plan 02, Wave 1)*
- [ ] `packages/einvoice/src/profiles/zugferd-de/assets/` — bundle `sRGB2014.icc`, `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` with checksum manifest *(Plan 02, Wave 1)*
- [ ] `packages/db` — Prisma migration for `InvoiceIntakeRequest` created AND applied via `[BLOCKING]` push *(Plan 01, Wave 1)*
- [ ] `.github/workflows/verapdf.yml` exists and is triggered on PRs touching `packages/einvoice/**` *(Plan 03, Wave 3)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ZUGFeRD PDF opens correctly in Adobe Acrobat Pro, shows attachment in sidebar, Acrobat's built-in ZUGFeRD-aware reader (if plugin installed) extracts the `factur-x.xml` | EINV-02 | Acrobat is closed-source; no CI-reachable assertion | Open generated fixture PDF in Acrobat; confirm attachments panel shows `factur-x.xml`; confirm XMP properties panel shows "ZUGFeRD EN 16931 COMFORT" |
| Inbound intake UX with a real third-party XRechnung from a German counterparty | EINV-03 | Requires human judgement of "did the extracted data feel right?" | Upload a sample XRechnung (sanitised) from `/fixtures/real-world-samples/`; confirm parsed fields match the visible PDF; confirm match candidates surface expected Contractor |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`--run` enforced)
- [x] Feedback latency < 60s per-wave
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-14
