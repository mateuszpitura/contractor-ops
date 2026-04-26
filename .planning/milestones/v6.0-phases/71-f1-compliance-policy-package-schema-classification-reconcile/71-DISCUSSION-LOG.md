# Phase 71: F1 Compliance — Policy Package + Schema + Classification Reconcile - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 71-f1-compliance-policy-package-schema-classification-reconcile
**Areas discussed:** Policy registry shape & versioning, ContractorComplianceItem schema additions, Policy rotation / supersession semantics, Admin drift recompute UX

---

## Policy registry shape & versioning

### Where does the per-jurisdiction policy registry live?
| Option | Description | Selected |
|--------|-------------|----------|
| New `@contractor-ops/compliance-policy` workspace package, typed TS const tree | Matches Phase 70 D-02 + D-09 patterns | ✓ |
| JSON seed data + PolicyRule Prisma table | Runtime-mutable but loses type safety | |
| Mixed: TS source + build-time DB snapshot | Doubled source-of-truth surface | |

**User's choice:** Workspace package, typed TS const tree (one sub-module per jurisdiction)

### How is `policyRuleId` versioned?
| Option | Description | Selected |
|--------|-------------|----------|
| Stable semantic ID + monotonic version: `uk.right_to_work@v3` | Stable namespace + monotonic version, single string column | ✓ |
| Opaque hash | Auto-generated, but unreadable | |
| Two columns (namespace + version) | Most queryable, but doubles join surface | |

**User's choice:** Stable semantic ID + monotonic version

### How does the registry track its `RULE_SET_VERSION`?
| Option | Description | Selected |
|--------|-------------|----------|
| Single exported `POLICY_RULE_SET_VERSION = 'v6.0.0'` const | Manual semver bump on legal-sign-off PR | ✓ |
| Auto-derived hash of registry tree | Zero manual bumps but unreadable | |
| No global version — per-rule versions only | Loses O(1) drift check | |

**User's choice:** Manual semver const (mirrors v5 RULE_SET_VERSION pattern)

### Legal sign-off path for the initial registry seed?
| Option | Description | Selected |
|--------|-------------|----------|
| All entries ship PENDING; `compliance-policy-engine` flag stays PENDING until post-deploy | Honors LOCAL-ONLY Standing Constraint | ✓ |
| Block merge until each jurisdiction has a real `legalTicketRef` | Strictest, contradicts Standing Constraint | |
| Mixed — some markets approved internally | Asymmetric, complicates testing | |

**User's choice:** All PENDING; flag PENDING until post-deploy legal review

---

## ContractorComplianceItem schema additions

### What does the new `severity` enum look like?
| Option | Description | Selected |
|--------|-------------|----------|
| 3-tier: BLOCKING / WARNING / INFO | Maps cleanly to Phase 72 payment-block + Phase 73 dashboard | ✓ |
| 5-tier (CRITICAL/HIGH/MEDIUM/LOW/INFO) | Granularity we can't currently distinguish | |
| Boolean `isBlocking` | Loses WARNING tier for dashboard | |

**User's choice:** 3-tier BLOCKING / WARNING / INFO

### How is `policyRuleId` typed at the column level?
| Option | Description | Selected |
|--------|-------------|----------|
| String column, value-checked at write time | No DB FK; registry is in TS code, not DB | ✓ |
| Foreign key to a `PolicyRule` Prisma table | Strongest referential integrity but conflicts with D-01 | |
| Tagged-union JSONB | Captures rule text per row but duplicates registry data | |

**User's choice:** String column + write-time validation

### How does `expiry_jurisdiction_tz` resolve "expires today"?
| Option | Description | Selected |
|--------|-------------|----------|
| Store IANA TZ string per row; compute boundary at read time | Locked snapshot, no retroactive rewrite | ✓ |
| Resolve dynamically from contractor's current jurisdiction | Cleanest schema but loses audit trail | |
| Store `expiresAtUtc` instead of `expiresAt` + tz | Contradicts success criterion #2 | |

**User's choice:** Store IANA TZ string per row

### Migration safety story for the three new columns?
| Option | Description | Selected |
|--------|-------------|----------|
| All three nullable; backfill in a follow-up plan once registry seeds land | Schema lands safely, idempotent backfill | ✓ |
| All nullable; legacy rows stay null forever | Compounding tech debt | |
| NOT NULL with hardcoded defaults | Hides legacy distinction; UTC default is wrong for non-London | |

**User's choice:** All nullable + follow-up backfill plan

---

## Policy rotation / supersession semantics

### When the policy registry version bumps, what happens to existing rows?
| Option | Description | Selected |
|--------|-------------|----------|
| WAIVED with `waivedReason='superseded_by_policy_version'` + new row | Preserves audit trail; aligns with success criterion #1 | ✓ |
| DELETE old row + INSERT new row | Loses audit trail; contradicts ROADMAP | |
| Update old row in-place | Silently rewrites history | |

**User's choice:** WAIVED + new row, never DELETE

### On classification_outcome_change, what's the supersession trigger?
| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous on classification submit, in same transaction | Atomic; mirrors v5 `recreateDraftAfterDrift` | ✓ |
| Background job triggered by event | Fast response but inconsistency window | |
| Manual admin trigger only | Contradicts success criterion #1 | |

**User's choice:** Synchronous in same transaction

### How is `waivedReason` taxonomy structured?
| Option | Description | Selected |
|--------|-------------|----------|
| New closed enum on ContractorComplianceItem | Strong type at DB level, greppable | ✓ |
| Reuse existing `notes` column with structured prefix | Mixes structured/free-text | |
| Separate `WaiverEvent` audit-log table linked by FK | Doubles schema surface for "latest" queries | |

**User's choice:** New closed enum (`superseded_by_policy_version` / `classification_outcome_change` / `admin_manual_waive` / `contractor_offboarded`)

### What if an old row was SATISFIED when supersession fires?
| Option | Description | Selected |
|--------|-------------|----------|
| WAIVED old; carry document forward to new row IF documentType matches | Avoids re-upload for cosmetic version bumps | ✓ |
| WAIVED old; new row always starts as MISSING | Forces re-upload of identical docs | |
| WAIVED old; new row PENDING with auto-link attempt | Adds background-job complexity | |

**User's choice:** Carry document forward when documentType matches

---

## Admin drift recompute UX

### Trigger surface for `recreateComplianceAssessment`?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-contractor button + bulk action on contractors-list | Two trigger points, same mutation, no org-wide button | ✓ |
| Per-contractor only | Smallest blast radius but slow for bulk policy bumps | |
| Org-wide + per-contractor with confirm | Maximum power but accidental-mass-recompute risk | |

**User's choice:** Per-contractor + bulk (no org-wide)

### Reason taxonomy?
| Option | Description | Selected |
|--------|-------------|----------|
| Closed enum: `policy_version_bump` / `classification_outcome_change` / `admin_correction` | Required field, mirrors waivedReason discipline | ✓ |
| Free-text string | Loses queryability | |
| Optional reason | Loses "why" for half the entries | |

**User's choice:** Closed enum, required

### Audit-log shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Single AuditLog entry per recompute invocation, structured payload | Clean replay, reuses existing audit_log table | ✓ |
| One AuditLog entry per affected row | Floods log on bulk ops | |
| No audit entry — rely on WAIVED rows + createdAt | Fails success criterion #4 | |

**User's choice:** Single entry per invocation with structured payload

### Idempotency / retry safety?
| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent via precondition guard (skip if version already matches) | Mirrors v5 `recreateDraftAfterDrift PRECONDITION_FAILED` | ✓ |
| Always recompute regardless | Noisy audit trail on retries | |
| Distributed Redis lock | Over-engineering for manual admin action | |

**User's choice:** Idempotent via precondition guard

---

## Claude's Discretion
- Exact IANA TZ strings per jurisdiction (Researcher pins from authoritative sources)
- Exact policy text wording — DEFERRED to legal review post-deploy
- UI copy for "Recompute compliance" button + confirm dialog (Phase 73 owns dashboard polish)
- Bulk-action interaction model on contractors-list page (match existing patterns)
- Date-with-TZ library choice — Researcher pins against existing codebase patterns

## Deferred Ideas
- Org-wide "recompute everyone" button (revisit as maintenance script later)
- Distributed lock for concurrent recomputes (revisit if production telemetry shows races)
- DB-snapshotted policy registry (revisit if v7+ needs runtime policy editing in admin UI)
- Free-text reason for recompute (revisit if closed enum proves rigid)
- One audit-log entry per affected row (revisit if compliance audits demand row-level granularity)
