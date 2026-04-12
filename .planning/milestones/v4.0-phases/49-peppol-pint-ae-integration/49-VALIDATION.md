---
phase: 49
slug: peppol-pint-ae-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/einvoice/vitest.config.ts` |
| **Quick run command** | `cd packages/einvoice && npx vitest run --reporter=verbose` |
| **Full suite command** | `npx turbo test --filter=@contractor-ops/einvoice --filter=@contractor-ops/api` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/einvoice && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx turbo test --filter=@contractor-ops/einvoice --filter=@contractor-ops/api`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 49-01-01 | 01 | 1 | PEPPOL-01 | T-49-01 / — | ASP credentials encrypted, tenant-isolated participant lookup | unit | `cd packages/einvoice && npx vitest run peppol-ae` | ❌ W0 | ⬜ pending |
| 49-01-02 | 01 | 1 | PEPPOL-01 | — | Participant ID validated against scheme format | unit | `cd packages/einvoice && npx vitest run peppol-ae` | ❌ W0 | ⬜ pending |
| 49-02-01 | 02 | 1 | PEPPOL-02 | T-49-02 / — | PINT-AE XML conforms to UBL 2.1 schema | unit | `cd packages/einvoice && npx vitest run peppol-ae` | ❌ W0 | ⬜ pending |
| 49-02-02 | 02 | 1 | PEPPOL-02 | — | Transmission status tracked per invoice | integration | `cd packages/api && npx vitest run peppol` | ❌ W0 | ⬜ pending |
| 49-03-01 | 03 | 2 | PEPPOL-03 | T-49-03 / — | Webhook signature verified before processing | unit | `cd packages/einvoice && npx vitest run peppol-ae` | ❌ W0 | ⬜ pending |
| 49-03-02 | 03 | 2 | PEPPOL-03 | — | Inbound XML parsed to EInvoice correctly | unit | `cd packages/einvoice && npx vitest run peppol-ae` | ❌ W0 | ⬜ pending |
| 49-04-01 | 04 | 1 | PEPPOL-04 | — | QR contains seller name, TRN, date, total, VAT | unit | `cd packages/einvoice && npx vitest run peppol-ae` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/einvoice/src/__tests__/peppol-ae.test.ts` — stubs for PEPPOL-01, PEPPOL-02, PEPPOL-04
- [ ] `packages/api/src/routers/__tests__/peppol.test.ts` — stubs for PEPPOL-02, PEPPOL-03
- [ ] Test fixtures: sample PINT-AE UBL 2.1 XML document

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ASP sandbox transmission | PEPPOL-02 | Requires live ASP sandbox API credentials | Configure Storecove sandbox key, submit test invoice, verify delivery |
| Inbound webhook from ASP | PEPPOL-03 | Requires ASP to send test webhook | Trigger test inbound from ASP sandbox, verify invoice created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
