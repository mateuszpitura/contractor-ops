---
phase: 12
slug: integration-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | packages/integrations/vitest.config.ts (Wave 0 creates) |
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
| 12-01-01 | 01 | 1 | INTG-01 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/credential-service.test.ts -t "encrypt"` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | INTG-01 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/credential-service.test.ts -t "isolation"` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | INTG-01 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/oauth-state.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | INTG-02 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/webhook-dispatcher.test.ts -t "verify"` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | INTG-02 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/webhook-dispatcher.test.ts -t "unknown"` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 1 | INTG-02 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/webhook-dispatcher.test.ts -t "log"` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | INTG-03 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/health-service.test.ts` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | INTG-01 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/token-refresh.test.ts` | ❌ W0 | ⬜ pending |
| 12-04-02 | 04 | 2 | INTG-01 | unit | `pnpm --filter @contractor-ops/integrations vitest run src/__tests__/token-refresh.test.ts -t "lazy"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/integrations/vitest.config.ts` — test configuration for new package
- [ ] `packages/integrations/src/__tests__/credential-service.test.ts` — encryption round-trip + per-provider isolation
- [ ] `packages/integrations/src/__tests__/webhook-dispatcher.test.ts` — signature verification + logging
- [ ] `packages/integrations/src/__tests__/health-service.test.ts` — health aggregation
- [ ] `packages/integrations/src/__tests__/token-refresh.test.ts` — proactive + lazy refresh
- [ ] `packages/integrations/src/__tests__/oauth-state.test.ts` — state HMAC generation + verification
- [ ] Framework install: `pnpm add vitest@^4.1.0 --filter @contractor-ops/integrations -D`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect flow with real provider | INTG-01 | Requires external OAuth provider (Slack) | 1. Click "Connect Slack" in settings 2. Complete OAuth flow 3. Verify connection shows as CONNECTED |
| Webhook delivery from external service | INTG-02 | Requires real webhook from external service | 1. Trigger Slack interactivity event 2. Verify WebhookDelivery record created 3. Verify async processing completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
