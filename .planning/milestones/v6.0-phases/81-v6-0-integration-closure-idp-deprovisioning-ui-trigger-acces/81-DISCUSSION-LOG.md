# Phase 81: v6.0 Integration Closure — IdP deprovisioning UI trigger + multi-provider run steps + compliance payment-block recovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
**Areas discussed:** Trigger placement & flow, Provider scope for runs, Compliance recovery scope, Run guards & idempotency

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Trigger placement & flow | INT-01 UI: where/how an admin starts a run; pre-flight; task linkage | ✓ |
| Provider scope for runs | Un-hardcode PROVIDERS_FOR_RUN; resolver-backed reality | ✓ |
| Compliance recovery scope | INT-02: wire onComplianceItemSatisfied into approveUploadReplacement | ✓ |
| Run guards & idempotency | idempotencyKey, permission gate, cooldown UX | ✓ |

**User's choice:** All four areas selected.

---

## Trigger placement & flow (INT-01 UI)

### Entry point — where does the admin start a run?
| Option | Description | Selected |
|--------|-------------|----------|
| ACCESS_REVOKE task | Inline action on the offboarding workflow-run task; the audit's named seam. Needs WorkflowRun.contractorId → assignment resolution. | |
| Assignment detail | Button on contractor/assignment detail; assignmentId unambiguous; less discoverable. | |
| Both | Task-card action + detail-page button, one shared hook. Most discoverable; widest surface. | ✓ |

**User's choice:** Both.
**Notes:** Task-card path must resolve `WorkflowRun.contractorId → offboarded ContractorAssignment` because WorkflowRun has no assignmentId FK.

### Pre-flight — what does the admin see before the run fires?
| Option | Description | Selected |
|--------|-------------|----------|
| Preview + confirm (Recommended) | Show impact-preview-panel + confirm dialog, then start. | ✓ |
| One-click + toast | Start immediately, toast the result. | |

**User's choice:** Preview + confirm.

### Task link — what happens to the ACCESS_REVOKE task on run SUCCEEDED?
| Option | Description | Selected |
|--------|-------------|----------|
| Stay independent (Recommended) | Manual task completion; run + task separate; run-view link. | ✓ |
| Auto-complete task | Run success marks task DONE; needs saga→workflow callback. | |

**User's choice:** Stay independent.

---

## Provider scope for runs (PROVIDERS_FOR_RUN)

### How is a run's provider set chosen?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-org toggles ∩ resolver (Recommended) | enabled ∩ signoff-approved ∩ resolver-backed {GWS, SLACK}. | ✓ |
| Static ['GWS','SLACK'] | Expand const, ignore per-org toggles. | |
| All 5 enabled providers | Rejected: step-runner fails closed for Entra/Okta/GitHub → fake failing steps. | |

**User's choice:** Per-org toggles ∩ resolver.

### Empty provider set behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Throw precondition error (Recommended) | Reject with DEPROVISIONING_INTEGRATION_NOT_CONFIGURED; no zero-step run. | ✓ |
| Create empty run | Zero-step run that immediately resolves. | |

**User's choice:** Throw precondition error.

### Entra / Okta / GitHub disposition
| Option | Description | Selected |
|--------|-------------|----------|
| Stay deferred (Recommended) | Registered but excluded from runs until enum + connection storage + resolver land. | ✓ |
| Pull into this phase | Build credential storage + resolvers now (large surface). | |

**User's choice:** Stay deferred.

---

## Compliance recovery scope (INT-02)

### Recovery scope in approveUploadReplacement
| Option | Description | Selected |
|--------|-------------|----------|
| Approved item only (Recommended) | onComplianceItemSatisfied for input.itemId; re-asserts full eligibility per held flow. | ✓ |
| All SATISFIED BLOCKING items | Mirror classification's loop; redundant for single-item approval. | |

**User's choice:** Approved item only.

### Notification on flow resume
| Option | Description | Selected |
|--------|-------------|----------|
| No new notification (Recommended) | Existing audit row + PENDING queue surfacing. | ✓ |
| Notify approver on resume | New notification type + dispatch. | |

**User's choice:** No new notification.

---

## Run guards & idempotency

### idempotencyKey generation
| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic per-assignment (Recommended) | Stable key; re-trigger returns existing run; failed steps via retryDeprovisioningStep. | ✓ |
| Random per click | Fresh UUID each click; duplicates possible. | |

**User's choice:** Deterministic per-assignment.

### Permission gate (mutation currently ungated)
| Option | Description | Selected |
|--------|-------------|----------|
| New idp:start_run perm (Recommended) | Dedicated action in idp group; gate mutation + eligibility query + UI. | ✓ |
| Reuse integration:update | Existing permission; coarser. | |
| Leave ungated | Tenant-scope + task-assignment only. | |

**User's choice:** New idp:start_run permission.

### Cooldown UX
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-check + disable (Recommended) | getDeprovisioningEligibility on render; disable button + earliest-date tooltip. | ✓ |
| Let mutation throw | No pre-check; COOLDOWN error toast on click. | |

**User's choice:** Pre-check + disable.

---

## Claude's Discretion
- i18n key namespace for the new trigger UI (follow `Idp.*` conventions; en/de/pl/ar parity mandatory).
- Layer placement of the `contractorId → assignmentId` resolution helper (keep `check:web-vite-data-layer` green).
- Test/Nyquist structure (coverage of both E2E flows is mandatory).

## Deferred Ideas
- Auto-complete the ACCESS_REVOKE task on run SUCCEEDED (saga→workflow callback).
- Entra/Okta/GitHub deprovisioning execution (enum migration + connection storage + token resolvers).
- 78 WR-1 DRY refactor (consolidate per-provider connection routers).
- Approver-notification-on-flow-resume.
- Goal-backward verification of phases 70/71/75 (audit-flagged; track with milestone closure).
