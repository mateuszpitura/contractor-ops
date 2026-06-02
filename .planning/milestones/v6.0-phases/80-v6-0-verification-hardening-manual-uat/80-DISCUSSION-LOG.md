# Phase 80: v6.0 Verification + Hardening + Manual UAT - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 80-v6-0-verification-hardening-manual-uat
**Areas discussed:** Integration-test composition, Test layer + location, 'Hardening' deliverable, Doc structure

---

## Integration-test composition
| Option | Description | Selected |
|--------|-------------|----------|
| Single composed scenario, F1+F3+F4 | Exactly SC#1; F2 covered at per-phase + UAT level | ✓ |
| Add an F2 leg too | Separate offboarding-completes → ACCESS_REVOKE assertion | |
| Small composition matrix | Multiple composed variants | |
| You decide | Researcher picks | |

**User's choice:** single composed scenario, F1+F3+F4
**Notes:** F2 ACCESS_REVOKE saga runs post-offboarding-completion — can't compose into a hard-blocked-offboarding path; verified separately + in UAT.

---

## Test layer + location
| Option | Description | Selected |
|--------|-------------|----------|
| vitest integration in packages/api | DB + tRPC + services, MSW for IdP/gov, seed-dev fixtures | ✓ |
| E2E browser harness (Playwright) | Full UI; heavy, overlaps manual UAT | |
| You decide | Researcher picks | |

**User's choice:** vitest integration in packages/api

---

## 'Hardening' deliverable
| Option | Description | Selected |
|--------|-------------|----------|
| Milestone-wide gate re-run + security scan | All v6.0 lint/i18n/db gates + pnpm audit + security:scan, documented; no perf | ✓ |
| Add a perf / load pass | Perf profiling; low value pre-deploy | |
| Gate-rerun only (skip security scan) | Lighter; skips dep-audit sweep | |
| You decide | Researcher picks | |

**User's choice:** milestone-wide gate re-run + security scan (no perf — LOCAL-ONLY)

---

## Doc structure
| Option | Description | Selected |
|--------|-------------|----------|
| 3 separate docs, legal per-jurisdiction | 80-HUMAN-UAT.md + 80-LEGAL-SIGNOFF.md (per adviser) + 80-RETROSPECTIVE.md | ✓ |
| One consolidated verification doc | Everything in 80-VERIFICATION.md | |
| You decide | Researcher picks | |

**User's choice:** 3 separate docs, legal sign-off split per-jurisdiction (DE/UK/UAE/KSA) — mirrors v5.0 Phase 69 / 63-HUMAN-UAT.md

---

## Claude's Discretion

Integration-test fixture/seed shape + seed-dev reuse; locked-phrase guard assertion mechanism; retrospective velocity computation; legal-signoff cross-linking vs inline restatement; UAT scenario dedup vs re-list against per-phase docs.

## Deferred Ideas

None — discussion stayed within phase scope.
