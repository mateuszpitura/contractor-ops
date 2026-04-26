---
phase: 48
slug: zatca-fatoorah-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/einvoice/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/einvoice test -- --run` |
| **Full suite command** | `pnpm --filter @contractor-ops/einvoice test -- --run && pnpm --filter @contractor-ops/api test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/einvoice test -- --run`
- **After every plan wave:** Run `pnpm --filter @contractor-ops/einvoice test -- --run && pnpm --filter @contractor-ops/api test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 1 | ZATCA-01 | T-48-01 | UBL 2.1 XML matches ZATCA schema with mandatory fields | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*generator"` | ❌ W0 | ⬜ pending |
| 48-01-02 | 01 | 1 | ZATCA-01 | — | ZATCA extensions (ICV, PIH, UUID) present in generated XML | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*extensions"` | ❌ W0 | ⬜ pending |
| 48-02-01 | 02 | 1 | ZATCA-02 | T-48-02 | XAdES signature validates with test certificate | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*sign"` | ❌ W0 | ⬜ pending |
| 48-02-02 | 02 | 1 | ZATCA-02 | T-48-02 | Private key never appears in logs or responses | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*key.*leak"` | ❌ W0 | ⬜ pending |
| 48-03-01 | 03 | 1 | ZATCA-03 | — | TLV encoding produces correct byte sequence for known inputs | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*tlv"` | ❌ W0 | ⬜ pending |
| 48-03-02 | 03 | 1 | ZATCA-03 | — | QR code contains all 5 required fields (tags 1-5) | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*qr"` | ❌ W0 | ⬜ pending |
| 48-04-01 | 04 | 2 | ZATCA-04 | T-48-03 | ICV is strictly monotonic per organization | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*hash.*chain"` | ❌ W0 | ⬜ pending |
| 48-04-02 | 04 | 2 | ZATCA-04 | T-48-03 | First invoice PIH equals SHA-256 of "0" | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*first.*invoice"` | ❌ W0 | ⬜ pending |
| 48-05-01 | 05 | 2 | ZATCA-05 | T-48-04 | B2B invoices submitted to clearance endpoint | unit | `pnpm --filter @contractor-ops/api test -- --run -t "zatca.*clearance"` | ❌ W0 | ⬜ pending |
| 48-05-02 | 05 | 2 | ZATCA-07 | T-48-04 | B2C invoices submitted to reporting endpoint | unit | `pnpm --filter @contractor-ops/api test -- --run -t "zatca.*reporting"` | ❌ W0 | ⬜ pending |
| 48-06-01 | 06 | 3 | ZATCA-06 | T-48-05 | CSR generation includes required ZATCA attributes | unit | `pnpm --filter @contractor-ops/einvoice test -- --run -t "zatca.*csr"` | ❌ W0 | ⬜ pending |
| 48-06-02 | 06 | 3 | ZATCA-06 | T-48-05 | Onboarding wizard stores certificates in Infisical | integration | `pnpm --filter @contractor-ops/api test -- --run -t "zatca.*onboarding"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/einvoice/src/__tests__/zatca-generator.test.ts` — stubs for ZATCA-01 XML generation
- [ ] `packages/einvoice/src/__tests__/zatca-signer.test.ts` — stubs for ZATCA-02 XAdES signing
- [ ] `packages/einvoice/src/__tests__/zatca-qr.test.ts` — stubs for ZATCA-03 TLV/QR encoding
- [ ] `packages/einvoice/src/__tests__/zatca-hash-chain.test.ts` — stubs for ZATCA-04 hash chain
- [ ] `packages/api/src/services/__tests__/zatca-submission.test.ts` — stubs for ZATCA-05/07 API submission
- [ ] `packages/einvoice/src/__tests__/zatca-onboarding.test.ts` — stubs for ZATCA-06 CSR/onboarding
- [ ] `xml-crypto` and `qrcode` npm packages installed

*Existing vitest infrastructure covers test framework — no new framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ZATCA sandbox clearance | ZATCA-05 | Requires live ZATCA sandbox credentials | Submit test invoice via onboarding wizard, verify clearance response |
| Certificate procurement UI | ZATCA-06 | Wizard step requires visual verification | Walk through all 5 onboarding wizard steps |
| QR code visual scan | ZATCA-03 | QR reader verification | Scan generated QR from PDF/screen with mobile app |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
