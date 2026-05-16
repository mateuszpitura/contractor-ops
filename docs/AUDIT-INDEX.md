# Audit Index

**Last reviewed:** 2026-05-16
**Purpose:** Single index of every audit-style artifact in the repo with date + status so a new reader knows which file to trust.

## Legend

| Status | Meaning |
|---|---|
| `current` | Active tracker — read this first. |
| `historical` | Preserved snapshot from a prior point in time. Do not edit; consult only for chain-of-custody. |
| `superseded-by` | Closed out; pointer to the successor. |

---

## Current trackers

| Document | Date | Status | Notes |
|---|---|---|---|
| [`docs/PRODUCTION-CHECKLIST.md`](./PRODUCTION-CHECKLIST.md) | last reviewed 2026-05-16 | `current` | Canonical post-launch production-readiness tracker. Owns infra, observability, security headers, CI/CD gates, DR, docs. Reconciled against the 2026-05-11 audit closure. |
| [`../contractor-ops-launch-checklist.md`](../contractor-ops-launch-checklist.md) | 2026-03-30 (last audited 2026-04-04) | `current` | Pre-launch product checklist — authoritative on multi-tenancy, auth, GDPR, payments. Complements `PRODUCTION-CHECKLIST.md`. |
| [`../.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md`](../.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md) | 2026-05-11 | `current` | Closure doc for the 5-reviewer audit. Single read for "what's the state of the audit work?". Reconciled into `PRODUCTION-CHECKLIST.md` on 2026-05-16. |
| [`RUNBOOK-PHASE-2-3-DEPLOY.md`](./RUNBOOK-PHASE-2-3-DEPLOY.md) | active | `current` | Canonical deploy procedure (§4) + smoke tests (§5) + monitoring (§7) + Tier-2 backlog (§9). |
| [`TECH-DEBT.md`](./TECH-DEBT.md) | active | `current` | Living tracked-debt ledger. |
| [`COMMIT-ATTRIBUTION.md`](./COMMIT-ATTRIBUTION.md) | active | `current` | Maps Phase 2/3 commits whose subjects drift from actual file content. |

## Historical snapshots

| Document | Date | Status | Notes |
|---|---|---|---|
| [`../SECURITY-AUDIT.md`](../SECURITY-AUDIT.md) | 2026-04-11 | `historical` (superseded-by `docs/PRODUCTION-CHECKLIST.md`) | Launch-time security audit snapshot. Preserved verbatim; do not edit. Open items (CSP `unsafe-inline`) tracked in `PRODUCTION-CHECKLIST.md` §5. |
| [`../goals/fe-be-integration-audit/AUDIT.md`](../goals/fe-be-integration-audit/AUDIT.md) | 2026-05-16 generation | `historical` | Heuristic FE↔BE mutation audit. The 5 HIGH findings are heuristic blind-spots (reclassification scheduled in `goals/production-hardening/` Phase B.1.a). |

## 2026-05-03 audit corpus (immutable historical)

The nine deep-dive audits seeded by the 2026-05-03 review. All `historical` — superseded by the 2026-05-11 closure. Do not edit in place; closure-driven changes land in `PRODUCTION-CHECKLIST.md`.

| Document | Status | One-line summary |
|---|---|---|
| [`../.audit-2026-05-03/00-SYNTHESIS.md`](../.audit-2026-05-03/00-SYNTHESIS.md) | `historical` (superseded-by `AUDIT-CLOSURE-2026-05-11.md`) | Cross-domain synthesis of the nine audits. |
| [`../.audit-2026-05-03/01-db-performance.md`](../.audit-2026-05-03/01-db-performance.md) | `historical` | DB performance findings (indexes, hot paths, query plans). |
| [`../.audit-2026-05-03/02-security.md`](../.audit-2026-05-03/02-security.md) | `historical` | Security audit — auth, RLS, CSP, secret scanning. Closure-confirmed; do not edit. |
| [`../.audit-2026-05-03/03-integrations.md`](../.audit-2026-05-03/03-integrations.md) | `historical` | External integrations — adapters, idempotency, webhook hygiene. |
| [`../.audit-2026-05-03/04-async.md`](../.audit-2026-05-03/04-async.md) | `historical` | Background workers, outbox, QStash, advisory locks. |
| [`../.audit-2026-05-03/05-observability.md`](../.audit-2026-05-03/05-observability.md) | `historical` | Logging, Sentry, Cronitor, Axiom, requestId propagation. Closure-confirmed; do not edit. |
| [`../.audit-2026-05-03/06-scalability.md`](../.audit-2026-05-03/06-scalability.md) | `historical` | Scaling shape — workers, read-replicas, Unleash, Better Auth secondary storage. |
| [`../.audit-2026-05-03/MARKET-SCAN.md`](../.audit-2026-05-03/MARKET-SCAN.md) | `historical` | Competitive / market-positioning scan that seeded NEXT-PHASE-PLAN. |
| [`../.audit-2026-05-03/NEXT-PHASE-PLAN.md`](../.audit-2026-05-03/NEXT-PHASE-PLAN.md) | `historical` | Planning artifact that triaged the synthesis into actionable phases. |
| [`../.audit-2026-05-03/REVIEW-R1-SECURITY.md`](../.audit-2026-05-03/REVIEW-R1-SECURITY.md) | `historical` | Reviewer 1 (Security) raw findings. |
| [`../.audit-2026-05-03/REVIEW-R2-CONSISTENCY.md`](../.audit-2026-05-03/REVIEW-R2-CONSISTENCY.md) | `historical` | Reviewer 2 (Consistency) raw findings. |
| [`../.audit-2026-05-03/REVIEW-R3-ARCHITECTURE.md`](../.audit-2026-05-03/REVIEW-R3-ARCHITECTURE.md) | `historical` | Reviewer 3 (Architecture) raw findings. |
| [`../.audit-2026-05-03/REVIEW-R4-RUNBOOK.md`](../.audit-2026-05-03/REVIEW-R4-RUNBOOK.md) | `historical` | Reviewer 4 (Runbook) raw findings. |
| [`../.audit-2026-05-03/REVIEW-R5-TEST-DEBT.md`](../.audit-2026-05-03/REVIEW-R5-TEST-DEBT.md) | `historical` | Reviewer 5 (Test Debt) raw findings. |
| [`../.audit-2026-05-03/REVIEW-SYNTHESIS.md`](../.audit-2026-05-03/REVIEW-SYNTHESIS.md) | `historical` | Triaged action list — the spec the 2026-05-11 closure worked against. |

## 2026-05-15 supplemental audit

| Document | Status | One-line summary |
|---|---|---|
| [`../.audit-2026-05-15/DROPDOWN-LABEL-AUDIT.md`](../.audit-2026-05-15/DROPDOWN-LABEL-AUDIT.md) | `current` | One-off UI audit of dropdown labels (typed-i18n migration adjacency). |

---

## Reconciliation cadence

Update `docs/PRODUCTION-CHECKLIST.md` (and this index) whenever a closure-style artifact lands. Never edit the `.audit-*` directories in place — they are immutable historical record. New audit work goes into a new dated `.audit-YYYY-MM-DD/` folder + a closure doc that points back here.
