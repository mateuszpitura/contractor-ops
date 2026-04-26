# Phase 76: F2 IdP — Capability Mixin + Saga Schema + Cooldown Gate + GWS Scope Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 76-f2-idp-capability-mixin-saga-schema-cooldown-gate-gws-scope-
**Areas discussed:** Saga schema + QStash topology + retry/audit semantics, 14-day cooldown gate, IdpChangeProvenance self-trigger filter, Deprovisionable interface + minimum-privilege OAuth scope registry

---

## Saga schema + QStash topology + retry/audit semantics

### DeprovisioningRun / DeprovisioningStep schema shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Two-table parent/child | Run + N steps; aggregate-status derived | ✓ |
| Single table with JSONB steps array | Smaller schema; UPDATE races on JSONB | |
| Two-table + separate event/outbox log | Strongest audit trail; over-engineering vs existing audit_log | |

**User's choice:** Two-table parent/child

### Aggregate run status computation?
| Option | Description | Selected |
|--------|-------------|----------|
| Derived in code (recomputeRunStatus), stored in column for query | Single source of truth for the rule | ✓ |
| Pure derived view (no `status` column) | Cleaner schema; every list query recomputes | |
| Event-sourced from transition log | Pure functional; needs event-log table | |

**User's choice:** Derived in code; stored for query

### QStash topology?
| Option | Description | Selected |
|--------|-------------|----------|
| Fan-out at saga-start, independent jobs, recompute on completion | Per Pitfall 10 — no Promise.allSettled aggregation | ✓ |
| Sequential chained jobs | Blocks the whole run on a slow provider | |
| One QStash job orchestrating all steps internally | Direct violation of SC#8 + Pitfall 10 | |

**User's choice:** Fan-out + independent jobs + recompute

### Manual-retry-per-provider button wiring?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-step button enqueues fresh QStash job for only that step (idempotent via attempts reset) | Mirrors v5 idempotency-via-precondition pattern | ✓ |
| Synchronous tRPC mutation calling adapter inline | Blocks tRPC on adapter latency | |
| Run-level retry only (re-runs ALL failed) | Loses per-provider granularity from SC#2 | |

**User's choice:** Per-step button + fresh QStash job

---

## 14-day cooldown gate

### Where does the gate fire?
| Option | Description | Selected |
|--------|-------------|----------|
| Single helper called from BOTH server-side mutation AND UI button-disabled check | One rule, two consumers | ✓ |
| Server-side check only | UX worse; can't pre-show earliestDate | |
| UI-side check only | Trivially bypassable | |

**User's choice:** Single source-of-truth helper

### Calendar vs business days; which TZ?
| Option | Description | Selected |
|--------|-------------|----------|
| 14 calendar days in contractor's jurisdiction TZ | Final-invoice statutes are calendar-day-defined; TZ-correctness symmetric with Phase 71 D-07 | ✓ |
| 14 business days | Adds business-calendar lookups per jurisdiction | |
| 14 calendar days in UTC | Contradicts Phase 71's TZ-correctness principle | |

**User's choice:** 14 calendar days, jurisdiction TZ

### How does magic-link portal stay alive during cooldown?
| Option | Description | Selected |
|--------|-------------|----------|
| Portal magic-link auth has no IdP dependency — verify in research | Simplest; existing v2.0 separation | ✓ |
| Add explicit `bypassMagicLink: true` flag | Defensive; redundant if option A holds | |
| Block portal magic-link too | Contradicts SC#1 directly | |

**User's choice:** Verify portal independence in research

### Admin override?
| Option | Description | Selected |
|--------|-------------|----------|
| No override — gate is hard. Admin must edit assignment.endedAt | Pitfall 7 framing — strict gate | ✓ |
| Override flag with second-admin approval (4-eyes) | Strongest control; complex flow | |
| Single-click override with `reason` audit | Erodes the protection over time | |

**User's choice:** No override

---

## IdpChangeProvenance self-trigger filter

### Schema shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Standalone IdpChangeProvenance Prisma table | Indexable, queryable, auditable | ✓ |
| Inline column on DeprovisioningStep | Pollutes saga schema with webhook concerns | |
| Redis key with TTL, no DB row | Loses audit trail, single point of failure | |

**User's choice:** Standalone Prisma table

### Matching algorithm precision?
| Option | Description | Selected |
|--------|-------------|----------|
| Exact match (provider, externalUserId, actionKind) + 1-hour window | Tight enough; absorbs provider delay | ✓ |
| Exact match + request-content SHA-256 | Webhook payload != request payload — won't match | |
| Loose match (user only, 24-hour window) | Catches lagging webhooks; conflates events | |

**User's choice:** (provider, externalUserId, actionKind) + 1-hour window

### Non-matching webhook events?
| Option | Description | Selected |
|--------|-------------|----------|
| Treat as legitimate external event — fire v3.0 user-departed notification | Default to delivery; preserves directory-import value | ✓ |
| Hold 5 min, recheck, deliver | Adds delay on every legit event | |
| Quarantine for admin review | Floods admin queue | |

**User's choice:** Default to delivery on non-match

### TTL / retention?
| Option | Description | Selected |
|--------|-------------|----------|
| 1-hour match window + 90-day retention with background GC | Balances active-table size with SOC2 audit needs | ✓ |
| Hard delete after 1 hour | Loses audit trail | |
| Never GC | Unbounded growth | |

**User's choice:** 1-hour match + 90-day retention + GC

---

## Deprovisionable interface + minimum-privilege OAuth scope registry

### Deprovisionable interface shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Standalone interface; adapters extend BaseAdapter + implement Deprovisionable | Strongest TS enforcement; compile-error-driven | ✓ |
| Mixin pattern (`withDeprovisionable<T>(Base: T)`) | Obscure pattern; not in codebase | |
| Optional methods on existing IntegrationProviderAdapter | Contradicts SC#5's compile-time enforcement | |

**User's choice:** Standalone interface + implements

### Per-provider scope registry location?
| Option | Description | Selected |
|--------|-------------|----------|
| Typed TS const per provider in packages/integrations/src/scopes/{provider}-deprovision-scopes.ts | Mirrors Phase 70 D-02 + D-09 patterns | ✓ |
| Single global registry (record-of-records) | Increases coupling | |
| DB-stored ScopeRegistry rows | Same downsides as Phase 71 D-01 | |

**User's choice:** Typed TS const per provider

### CI lint guard?
| Option | Description | Selected |
|--------|-------------|----------|
| New `pnpm lint:scopes` in @contractor-ops/lint-guards | Mirrors Phase 70 three-guard topology | ✓ |
| GitHub branch protection + CODEOWNERS only | Doesn't catch typed-constant drift | |
| No CI guard | Contradicts SC#6 | |

**User's choice:** New lint:scopes guard

### Per-provider integration-test stub?
| Option | Description | Selected |
|--------|-------------|----------|
| MSW-mocked test with mock-clock + verifyDeprovisioned() within 5 min | Matches existing infra; LOCAL-ONLY honored | ✓ |
| Live integration tests against sandbox accounts | Requires CI sandbox secrets; flaky | |
| Contract test only (no behaviour) | Misses 'method exists but does nothing' bugs | |

**User's choice:** MSW-mocked + mock-clock template

---

## Claude's Discretion
- Exact `DeprovisionResult` type shape (Researcher drafts against Phase 70 D-15 audit-fields)
- `MAX_ATTEMPTS` value (3? 5?) — pick based on QStash backoff economics
- Which provider gets the example test stub (likely GWS for SC#3 consolidation)
- Exact tRPC mutation surface (match v5 `recreateDraftAfterDrift` conventions)
- UI copy for GWS write-access banner (Phase 73 owns dashboard polish)
- Background GC schedule for D-12 (daily? weekly?)

## Deferred Ideas
- Run-level retry button (revisit if per-step UX too clicky)
- Admin override / 4-eyes flow for cooldown (revisit if real edge case appears)
- Live integration tests against sandbox (revisit when LOCAL-ONLY lifts)
- CODEOWNERS on scope files (recommended in SUMMARY, not in scope)
- Loose-window provenance match (revisit if 1-hour window misses events)
- Redis-backed provenance lookup (revisit if DB latency becomes bottleneck)
