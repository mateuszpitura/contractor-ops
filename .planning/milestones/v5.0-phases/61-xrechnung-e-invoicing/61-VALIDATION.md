---
phase: 61
slug: xrechnung-e-invoicing
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-14
updated: 2026-04-14
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/einvoice/vitest.config.ts (existing) |
| **Quick run command** | `pnpm --filter @contractor-ops/einvoice test -- --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/einvoice --filter @contractor-ops/validators --filter @contractor-ops/api test -- --run && pnpm --filter web test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/einvoice test -- --run`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Test File (scaffold) | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| packages/validators/src/__tests__/leitweg-id.test.ts | 61-01 | 0 | EINV-05 | T-61-01-03 | Reject invalid Leitweg-IDs at Zod boundary | unit | `pnpm --filter @contractor-ops/validators test -- --run leitweg-id` | ✅ | ✅ green |
| packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts | 61-02 | 1 | EINV-01 | — | CII XML envelope matches XRechnung 3.0.2 CIUS | unit | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/generator` | ✅ | ⬜ pending (todo scaffold) |
| packages/einvoice/src/profiles/xrechnung-de/__tests__/leitweg-id-embed.test.ts | 61-02 | 1 | EINV-05 | — | Leitweg-ID embedded at BT-10 when resolver returns value | unit | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/leitweg-id-embed` | ✅ | ⬜ pending (todo scaffold) |
| packages/einvoice/src/profiles/xrechnung-de/__tests__/validator.test.ts | 61-03 | 2 | EINV-04 | T-61-01-01 | Three-layer KoSIT pipeline enforces XSD → EN 16931 → XRechnung CIUS | integration | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/validator` | ✅ | ⬜ pending (todo scaffold) |
| packages/einvoice/src/profiles/xrechnung-de/__tests__/svrl-normalizer.test.ts | 61-03 | 2 | EINV-04 | — | SVRL output normalised into typed validation report (D-14) | unit | `pnpm --filter @contractor-ops/einvoice test -- --run xrechnung-de/svrl-normalizer` | ✅ | ⬜ pending (todo scaffold) |
| packages/api/src/services/__tests__/leitweg-id-resolver.test.ts | 61-04 | 1 | EINV-05 | T-61-01-08 | D-06 resolution (contract > contractor default > null); tenant-scoped | unit | `pnpm --filter @contractor-ops/api test -- --run leitweg-id-resolver` | ✅ | ⬜ pending (todo scaffold) |
| packages/api/src/services/__tests__/einvoice-lifecycle-fsm.test.ts | 61-04 | 2 | EINV-07 | — | Legal state transitions enforced on EInvoiceLifecycle / Transmission | unit | `pnpm --filter @contractor-ops/api test -- --run einvoice-lifecycle-fsm` | ✅ | ⬜ pending (todo scaffold) |
| packages/api/src/routers/__tests__/einvoice.finalize.test.ts | 61-04 | 2 | EINV-01 / EINV-04 / EINV-07 | T-61-01-08 | finalize mutation: generate + validate + persist, multi-tenant | integration | `pnpm --filter @contractor-ops/api test -- --run einvoice.finalize` | ✅ | ⬜ pending (todo scaffold) |
| packages/api/src/routers/__tests__/einvoice.send.test.ts | 61-06 | 3 | EINV-06 | T-61-01-08 | send mutation: participant + capability gates, D-09 format routing | integration | `pnpm --filter @contractor-ops/api test -- --run einvoice.send` | ✅ | ⬜ pending (todo scaffold) |
| packages/api/src/routers/__tests__/leitweg-id.test.ts | 61-04 | 1 | EINV-05 | T-61-01-08 | Leitweg-ID CRUD + duplicate detection + tenant scoping | integration | `pnpm --filter @contractor-ops/api test -- --run leitweg-id` | ✅ | ⬜ pending (todo scaffold) |
| packages/einvoice/src/profiles/xrechnung-de/__tests__/fixtures/README.md | 61-03 | 2 | EINV-04 | T-61-01-01 | Fixture corpus manifest for KoSIT positive/negative samples | manifest | (doc) | ✅ | ⬜ pending (Plan 03 populates) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `saxon-js`, `libxmljs2`, `xslt3` (build-time) added to `packages/einvoice/package.json`
- [x] Leitweg-ID Modulo-11-10 Zod validator + ≥10 valid + ≥13 invalid fixtures (round-trip green)
- [x] KoSIT validator release tag pinned in `validator-bundle/source.txt` (release-2026-01-31) — SHA-256 pending download
- [x] Prisma schema set committed + `prisma db push` succeeded against Neon EU pooler
- [x] 10 RED-scaffold test files + 1 fixture manifest README in place for Waves 1–3
- [x] `EInvoice.*` i18n namespace populated across en/de/pl/ar
- [ ] Storecove sandbox `document_type_id` for XRechnung-CII confirmed via API probe — **DEFERRED to Plan 05** (STORECOVE_API_KEY not set in local env; placeholder literal committed in constants.ts marked "pending sandbox verification")

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end Peppol send to UK sandbox recipient | EINV-06 | Requires external ASP round-trip with test credentials | Generate test invoice → POST to Storecove sandbox → verify webhook `send.success` received |
| KoSIT official validator parity | EINV-01 | Cross-check against java-based KoSIT CLI not practical in CI | Download `validator-configuration-xrechnung` release, run sample invoices through both our saxon-js pipeline and reference Java validator, diff results |
| Storecove sandbox XRechnung-CII `document_type_id` | EINV-06 | Requires live STORECOVE_API_KEY unavailable during Plan 01 | Plan 05: POST minimal CII envelope to `/document_submissions`; confirm or correct `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID` constant |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (KoSIT fixture scaffold, Leitweg-ID fixtures, Storecove doc_type_id deferred with documented placeholder)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (flipped by last plan of the phase)

**Approval:** pending
