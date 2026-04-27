# Phase 77: F2 IdP — GWS + Slack Adapters (the wedge) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 77-CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-27
**Phase:** 77-f2-idp-gws-slack-adapters-the-wedge
**Mode:** discuss (default mode, no flags)
**Areas discussed:** describeImpact preview · Per-step API execution + LIKELY_GONE · MANUAL_ESCALATION override · Slack SCIM org-token + per-flag gating

---

## Area selection

User selected ALL FOUR proposed areas via multiSelect — full coverage of Phase 77's five ROADMAP success criteria.

| Option | Selected? |
|--------|-----------|
| `describeImpact` preview — data, performance, freshness | ✓ |
| Per-step API execution + error handling + LIKELY_GONE detection | ✓ |
| MANUAL_ESCALATION override after retry exhaustion | ✓ |
| Slack SCIM org-token + per-flag gating | ✓ |

---

## Area 1 — describeImpact preview

### Q1: Preview data shape

| Option | Selected |
|--------|----------|
| Rich per-provider preview with concrete counts | ✓ |
| Generic count-only preview | — |
| Free-form description string per provider | — |

→ **D-01 / D-04.** Discriminated-union `ImpactPreview` with provider-specific custom metrics. GWS = OAuth grants by app name, isSuperAdmin, drives owned. Slack = channels, owned channels, app installs, admin booleans, NOT_ON_ENTERPRISE_GRID error flag.

### Q2: Cache strategy

| Option | Selected |
|--------|----------|
| Cache 5min in Upstash Redis, force-refresh button | ✓ |
| Live every click, no cache | — |
| Cache 1h, no force-refresh | — |

→ **D-02.** Cache key `co:idp:preview:{provider}:{externalUserId}` (5min TTL). "Last refreshed: Nmin ago" + Refresh button. Reuses `packages/api/src/services/cache.ts`.

### Q3: Fetch failure handling

| Option | Selected |
|--------|----------|
| Show error banner + allow deprovision to proceed without preview | ✓ |
| Hard-block deprovision until preview succeeds | — |
| Silent skip + auto-proceed | — |

→ **D-03.** "Continue without preview" / "Cancel" buttons. AuditLog `idp.preview.failed_proceed`. 401 → reconnect-required banner instead.

### Q4: Type extensibility

| Option | Selected |
|--------|----------|
| Discriminated union keyed by provider | ✓ |
| Generic `customMetrics: Record<string, unknown>` | — |
| Separate `ImpactPreviewable` interface | — |

→ **D-01.** Discriminated union; saga UI narrows on `provider` field with exhaustive switch. Phase 78 adds new union members without modifying existing ones.

---

## Area 2 — Per-step API execution + error handling + LIKELY_GONE

### Q1: GWS step-method distribution

| Option | Selected |
|--------|----------|
| `suspendAccount` = users.update; `revokeAllSessions` = tokens.delete + users.signOut | ✓ |
| Three independent step methods | — |
| `suspendAccount` does everything | — |

→ **D-05.** GWS three-step audit captured via sub-action SHA-256 hashes inside `revokeAllSessions` (1 row from `suspendAccount` + 2 sub-action audit rows = 3 audit rows total per ROADMAP SC#2).

### Q2: Idempotency + LIKELY_GONE detection

| Option | Selected |
|--------|----------|
| Per-step `verifyDeprovisioned()` short-circuit + GONE result enum | ✓ |
| Catch-and-ignore 404 only | — |
| Saga-layer dedup based on previous run status | — |

→ **D-06.** New `LIKELY_GONE` result enum value. GWS verify: `users.get → suspended === true || 404`. Slack verify: `users.info → user.deleted === true || users_not_found`. Aggregate `recomputeRunStatus` treats LIKELY_GONE as terminal-success-equivalent.

### Q3: Error classification

| Option | Selected |
|--------|----------|
| Closed-enum classifier per HTTP status + provider error code | ✓ |
| Generic transient/permanent split by HTTP status only | — |
| Retry everything until MAX_ATTEMPTS | — |

→ **D-07.** Six classes: TRANSIENT_RATE_LIMIT, TRANSIENT_NETWORK, PERMANENT_NOT_FOUND (→LIKELY_GONE), PERMANENT_AUTH_EXPIRED (→reconnect banner), PERMANENT_FORBIDDEN (→lint:scopes hint), PERMANENT_OTHER. New file `packages/integrations/src/idp/error-classifier.ts`.

### Q4: Slack step-method distribution

| Option | Selected |
|--------|----------|
| Slack `revokeAllSessions` = `admin.users.session.invalidate`; `suspendAccount` = SCIM PATCH | ✓ |
| Both Slack actions in `revokeAllSessions`; `suspendAccount` no-op | — |
| Single Slack step that does both internally | — |

→ **D-05.** Each runs as independent QStash job per Phase 76 D-03 fan-out. SCIM via raw `fetch` with org-grid token.

---

## Area 3 — MANUAL_ESCALATION override after retry exhaustion

### Q1: Permission scope

| Option | Selected |
|--------|----------|
| New `idp:override_step_failure` permission, default OWNER + ADMIN | ✓ |
| Reuse Phase 74 `workflow:override_blocking_task` (OWNER-only) | — |
| Reuse Phase 73 `compliance:override` | — |

→ **D-09.** Three separate audit-grep namespaces / three separate signoff conversations. Phase 74 D-09 pattern.

### Q2: Override reason input + step-status semantics

| Option | Selected |
|--------|----------|
| New step status `MANUAL_COMPLETED` + closed-enum reason category + free-text | ✓ |
| Keep status `FAILED` + add boolean `manuallyOverridden` | — |
| Free-text reason only, no enum category | — |

→ **D-10 / D-11.** Additive enum extension. Closed-enum `ManualOverrideCategory`: `verified_via_vendor_console`, `user_already_inactive`, `provider_endpoint_deprecated`, `transient_provider_issue_resolved`, `other`. Zod min(20) free-text. `recomputeRunStatus` treats MANUAL_COMPLETED equivalent to SUCCEEDED.

### Q3: Override button placement

| Option | Selected |
|--------|----------|
| Per-failed-step button in saga UI + offboarding ACCESS_REVOKE auto-completes | ✓ |
| Single "Mark whole run complete" button at run level | — |
| Override button on offboarding workflow task | — |

→ **D-12.** Per-step granularity preserved. Parent task auto-completes on terminal run-status. Both writes audited as separate timestamped entries.

### Q4: Permanent-failure badge surface

| Option | Selected |
|--------|----------|
| Inline badge on saga UI step row + offboarding-record audit timeline + AuditLog grep | ✓ |
| Saga UI badge only | — |
| Audit-log entry only, no inline UI | — |

→ **D-13.** Three-surface pattern matching Phase 74 D-11. Reuses existing audit_log table.

---

## Area 4 — Slack SCIM org-token + per-flag gating

### Q1: SCIM org-token plumbing

| Option | Selected |
|--------|----------|
| Separate Slack-Org Connection with org-grid OAuth flow + per-feature scope opt-in | ✓ |
| Extend existing Slack connection with `prompt=consent` re-OAuth | — |
| Personal `xoxp-` token + impersonation | — |

→ **D-14.** New `IntegrationConnection` row of `subKind: 'SLACK_ORG_GRID'` with org-level scopes from Phase 76 D-14 typed-const registry. Two cards in Settings > Integrations > Slack.

### Q2: Per-flag gating

| Option | Selected |
|--------|----------|
| Per-provider flag check at saga-start + UI per-provider opt-in toggle | ✓ |
| Single feature flag for whole IdP-deprovisioning | — |
| Per-provider + master flag (both required) | — |

→ **D-15.** Two PENDING entries `idp-deprovisioning-gws` / `idp-deprovisioning-slack`. Saga `startDeprovisioningRun` filters to APPROVED-flag providers. Settings table per-provider toggle persists `Setting.idpDeprovisioningEnabled.{provider}`.

### Q3: Pre-flight Enterprise-Grid detection

| Option | Selected |
|--------|----------|
| At Settings + describeImpact + saga-start (three layers) | ✓ |
| Surface only at saga-start | — |
| Hide Slack option entirely if not on Enterprise Grid | — |

→ **D-16.** Defense-in-depth. `users.lookupByEmail` returning `cannot_perform_operation` is the canonical signal. AuditLog `idp.slack.org_grid_unavailable` for forensics.

---

## Wrap-up question

| Option | Selected |
|--------|----------|
| Write CONTEXT.md now | ✓ |
| Add one more clarification | — |

→ Proceeded to write CONTEXT.md.

---

## Claude's discretion (deferred to Researcher / Planner)

- Google Admin SDK exact method signatures (`users.signOut` + live-session-count read sibling; `tokens.delete` rate limits) — Researcher pins via Context7 `googleapis@latest` admin SDK docs.
- Slack `users.conversations` pagination cap behaviour for high-channel users.
- Slack `apps.permissions.users.list` shape / fallback to `users.info`.
- Per-error-class custom retry budgets (Phase 76 D-03 capped attempts; Phase 77 may want differential budgets).
- Override-modal UI copy (placeholder English; admin-facing, no signoff).
- Per-org "preview-only" mode — out of scope, future enhancement.
- Pino log structure for new `idp.preview.failed_proceed` and `idp.deprovisioning.step.manual_completed` events.

## Deferred ideas (for future phases or backlog)

See `<deferred>` section of 77-CONTEXT.md — 27 ideas captured across all four areas.

## Background events during the discussion

- Phase 75 planner (background agent) completed mid-discussion: 8 plans across 4 waves, all 16 Phase 75 decisions covered, 17 PENDING signoff entries seeded for IP-clause phrases. Plan 75-02 schema migration is `autonomous: false` — multi-region apply manual post-merge. Phase 75 planner explicitly flagged that the same dirty-tree blocker (279 uncommitted files) that aborted Phase 72 execute will also block Phase 75 execute — user resolution of the working-tree state required before either runs. None of this affects Phase 77 decisions, which target the Phase 76-locked saga interface + Phase 77's own adapter implementations.
- Phase 72 executor remains BLOCKED in STATE.md (commit `c4e181b8`) on the 279-uncommitted-files collision; user has not yet resolved.

---

*Mode: discuss (default)*
*Discussion completed: 2026-04-27*
