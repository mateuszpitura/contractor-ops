---
phase: 16
slug: ocr-invoice-parsing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `packages/api/vitest.config.ts`, `packages/integrations/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test --run && pnpm --filter @contractor-ops/integrations test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test --run`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | OCR-01 | unit | `pnpm --filter @contractor-ops/integrations test --run` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | OCR-01, OCR-02 | unit | `pnpm --filter @contractor-ops/api test --run` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | OCR-01, OCR-02, OCR-03 | type-check | `npx tsc --noEmit --project apps/web/tsconfig.json` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/integrations/src/services/__tests__/ocr-service.test.ts` — stubs for OCR-01 (Claude Vision extraction, adapter interface)
- [ ] `packages/api/src/routers/__tests__/ocr.test.ts` — stubs for OCR-01/OCR-02 (tRPC endpoints, confidence scoring)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Split panel PDF viewer renders correctly | OCR-03 | Requires browser with react-pdf worker | Upload PDF → verify left panel shows rendered PDF with page navigation |
| Confidence color-coded borders display | OCR-02 | Visual rendering verification | Upload invoice → verify green/amber/red borders on extracted fields |
| Portal OCR pre-fill flow | OCR-01 | Requires portal auth session + real PDF | Login to portal → upload invoice → verify extracted fields pre-fill form |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
