---
phase: 61
slug: xrechnung-e-invoicing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
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
| **Full suite command** | `pnpm --filter @contractor-ops/einvoice test -- --run && pnpm --filter web test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/einvoice test -- --run`
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | EINV-01 | TBD | TBD | unit | TBD | ❌ W0 | ⬜ pending |

*Populated by planner. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] KoSIT validator fixtures (XSD + Schematron .sch → .sef.json) committed to `packages/einvoice/fixtures/kosit/`
- [ ] Leitweg-ID Modulo-11-10 reference fixtures from KoSIT spec
- [ ] Storecove sandbox `document_type_id` for XRechnung-CII confirmed via API probe
- [ ] `saxon-js`, `libxmljs2`, `xslt3` (build-time) added to `packages/einvoice/package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end Peppol send to UK sandbox recipient | EINV-06 | Requires external ASP round-trip with test credentials | Generate test invoice → POST to Storecove sandbox → verify webhook `send.success` received |
| KoSIT official validator parity | EINV-01 | Cross-check against java-based KoSIT CLI not practical in CI | Download `validator-configuration-xrechnung` release, run sample invoices through both our saxon-js pipeline and reference Java validator, diff results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (KoSIT fixtures, Storecove doc_type_id)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
