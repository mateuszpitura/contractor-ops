---
plan: 64-09
phase: 64-legal-compliance-hardening
status: complete
commit: a83e4248
completed_at: 2026-04-26
---

# Plan 64-09: Super-Admin Classification Engine Flag Status Page

## What Was Built

Created `admin/feature-flags/classification-engine/page.tsx`: async RSC under the existing admin layout (no new shell). Shows app-side evaluated flag value (ENABLED/DISABLED with icons), signoff registry summary (PENDING count vs total), and full per-key disclaimer table with approvedBy/approvedAt/approverRole columns. Displays amber actionable banner when flag is ON in Unleash but overridden OFF by PENDING disclaimers — explains how to resolve via signoff-registry.json PR with CODEOWNERS review. Read-only — no Unleash toggle buttons. Smoke test file with 4 assertions. Added `Admin.ClassificationEngineFlag` i18n keys to en.json.

## Key Files Created

- `apps/web/src/app/admin/feature-flags/classification-engine/page.tsx`
- `apps/web/src/app/admin/feature-flags/classification-engine/__tests__/page.test.tsx`

## Key Files Modified

- `apps/web/messages/en.json` — Admin.ClassificationEngineFlag keys

## Self-Check: PASSED

- getRegistry() + getAllPending() + LOCKED_DISCLAIMERS imported from validators ✓
- evaluate('module.classification-engine') called server-side ✓
- No UNLEASH_URL or UNLEASH_API_TOKEN in source ✓
- Amber override banner shown when pendingKeys.length > 0 ✓
- No mutation/toggle buttons (read-only) ✓
- Signoff registry table renders all 12 disclaimer keys ✓
- Smoke tests pass ✓
