---
phase: 17
slug: ksef-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | packages/integrations/vitest.config.ts |
| **Quick run command** | `pnpm --filter @contractor-ops/integrations test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/integrations test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | KSEF-01 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/ksef-api-client.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | KSEF-02 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/ksef-xml-parser.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | KSEF-01, KSEF-03 | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/ksef-sync.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | KSEF-04 | unit | `pnpm --filter @contractor-ops/api vitest run src/services/__tests__/ksef-duplicate.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/integrations/src/__tests__/ksef-api-client.test.ts` — stubs for KSEF-01 (auth flow, query, error handling)
- [ ] `packages/integrations/src/__tests__/ksef-xml-parser.test.ts` — stubs for KSEF-02 (FA(3) parsing with sample XML)
- [ ] `packages/api/src/services/__tests__/ksef-sync.test.ts` — stubs for KSEF-01, KSEF-03 (sync orchestration, metadata persistence)
- [ ] `packages/api/src/services/__tests__/ksef-duplicate.test.ts` — stubs for KSEF-04 (cross-source duplicate detection)
- [ ] `packages/integrations/src/__tests__/fixtures/sample-fa3.xml` — sample FA(3) XML fixture

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KSeF provider card connects with token | KSEF-01 | Requires KSeF test environment credentials | 1. Go to Settings > Integrations 2. Click Connect KSeF 3. Enter test token 4. Verify "Connected" status |
| KSeF provider card connects with certificate | KSEF-01 | Requires qualified e-seal cert file | 1. Click "Certificate" tab in setup dialog 2. Upload .p12 test cert 3. Verify credentials validated |
| Sync Now button triggers immediate pull | KSEF-01 | Requires live KSeF API | 1. Click Sync Now on connected KSeF card 2. Verify sync log entry appears 3. Verify invoices appear in list |
| KSeF badge visible in invoice list | KSEF-03 | Visual verification | 1. Navigate to Invoices 2. Verify KSeF badge on KSeF-sourced rows |
| Duplicate banner shows on matched invoices | KSEF-04 | Cross-source visual verification | 1. Upload invoice manually 2. Wait for KSeF sync with same invoice 3. Verify duplicate banners on both |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
