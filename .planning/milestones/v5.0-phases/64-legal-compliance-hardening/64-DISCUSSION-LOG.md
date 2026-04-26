# Phase 64: Legal Compliance Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `64-CONTEXT.md` — this log preserves the discussion path.

**Date:** 2026-04-15
**Phase:** 64-legal-compliance-hardening
**Mode:** discuss (interactive, 4 areas)

## Gray Areas Presented

| # | Area | User selected |
|---|------|---------------|
| 1 | Feature flag mechanics — render-tree exclusion + API gate + cron skip | ✓ |
| 2 | Disclaimer PENDING→APPROVED lifecycle + CI gate | ✓ |
| 3 | Advisory banner + escalation logging | ✓ |
| 4 | SDS cover page + DRV upload + ToS | ✓ |

All four selected.

## Area 1 — Feature flag mechanics

| Question | User choice |
|----------|-------------|
| UI render-tree exclusion | Server-side `layout.tsx` flag check + `notFound()` + `<FeatureGate>` RSC wrapper |
| tRPC API gate | Conditional router registration + middleware defense-in-depth (two layers) |
| Cron skip | Route handler early-return with `@contractor-ops/logger` audit entry |
| LEGAL-10 flip gate | App-side evaluator override in `packages/feature-flags/src/evaluator.ts` |

## Area 2 — Disclaimer lifecycle + CI gate

| Question | User choice |
|----------|-------------|
| Signoff state recording | Separate `signoff-registry.json` in git with Zod-validated structured metadata |
| CI gate design | Dual-layer: always-run unit test (dangling entries) + production-branch deploy gate (block PENDING) |
| Signoff workflow | PR with CODEOWNERS `legal-platform` review + approver-email attestation via hash |

## Area 3 — Advisory banner + escalation

| Question | User choice |
|----------|-------------|
| Banner content + placement | Locked jurisdiction-aware phrases on all classification pages via route `layout.tsx` |
| Escalation audit | New `ClassificationEscalationEvent` Prisma model (append-only, multi-tenant) |
| Expert help link | Internal MDX referral page with jurisdiction-specific content (reuses Phase 56 MDX) |

## Area 4 — SDS cover / DRV upload / ToS

| Question | User choice |
|----------|-------------|
| SDS approval UX | Two-step: in-app checkbox + `SdsApproval` entity + embedded approval block in PDF cover page |
| DRV letter upload | Extend Phase 59 `ClassificationDocument` with new `DRV_DECISION_LETTER` enum value |
| ToS update + acceptance | New MDX `/terms/` pages + `ConsentEvent 'tos'` scope + non-dismissible re-acceptance modal on version bump |

## Summary

- 32 explicit decisions captured (D-01 through D-32 in CONTEXT.md).
- `module.classification-engine` flag registered in the existing feature-flag wrapper with default=false (ship-dark).
- UI gate: route `layout.tsx` + `notFound()` ensures classification never enters the render tree when OFF — no CSS hiding.
- API gate: two-layer enforcement (conditional registration in appRouter + per-procedure middleware).
- Disclaimer signoff moves from code-comment PENDING markers to a structured `signoff-registry.json` with Zod validation + dual-layer CI gate.
- App-side evaluator override (D-10) makes the app authoritative over Unleash: even if Unleash is flipped ON, the app refuses to expose classification until every disclaimer is APPROVED.
- 6 new locked phrases introduced (banners × 2, SDS approval, DRV unverified, ToS × 2) — all seeded PENDING in the registry.
- New Prisma models: `ClassificationEscalationEvent` (audit) + `SdsApproval` (approval evidence). Plus enum extensions on `ClassificationDocumentKind` and `ConsentScope`.
- ToS re-acceptance enforced via non-dismissible modal at root layout level; `ConsentEvent` scope extended.
- Existing infrastructure REUSED heavily: Phase 56 MDX + `ConsentEvent`, Phase 58 disclaimer constants, Phase 59 `ClassificationDocument` + R2, Phase 59 `ir35-sds.tsx` PDF template, Phase 60 DRV panel + compliance-pill palette.
- No scope creep — virus scanning, external compliance DB integration, data purge on flag-off, admin UI for flipping Unleash, operator dashboards all deferred.
- Zero todos folded (`gsd-tools todo match-phase 64` = 0 matches).
