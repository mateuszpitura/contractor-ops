# Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 74-f4-offboarding-workflow-foundation-kt-templates-override-per
**Areas discussed:** Role taxonomy + KT template seed shape, PTO-aware manager fallback semantics, Override permission registration + dialog UX, i18n strategy for ops-extensible templates

---

## Role taxonomy + KT template seed shape

### Where do role definitions + KT seeds live, given SC#3 ops-extensibility?
| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: typed-const seeds + WorkflowRoleTemplate Prisma table for ops additions | Single read path; mirrors Phase 70/71 patterns | ✓ |
| All in DB: seeds via migration | Loses authoring ergonomics | |
| All in code: ops-added via privileged TS write | Violates SC#3 'no engineering involvement' | |

**User's choice:** Hybrid (typed-const seeds + DB for ops additions)

### How does the system know a contractor's role?
| Option | Description | Selected |
|--------|-------------|----------|
| New Contractor.workflowRoleId FK | Strong typing, queryable | ✓ |
| Reuse free-text Contractor.role + fuzzy match | Brittle, non-deterministic | |
| Tag-based runtime inference | Indeterministic for multi-tag | |

**User's choice:** FK to WorkflowRoleTemplate

### Manual override mechanism (SC#1)?
| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown at offboarding-start | Single decision point, no mid-workflow corruption | ✓ |
| Mid-workflow swap with task regeneration | Data-migration risk | |
| Multi-select with task merging | Dedup complexity | |

**User's choice:** Start-time dropdown only

### Seed template content shape?
| Option | Description | Selected |
|--------|-------------|----------|
| { role, displayNameI18nKey, taskItems: [{titleI18nKey, descriptionI18nKey, dueDayOffset, requiredDocs?}] } | Structured + i18n-key aware | ✓ |
| Pre-rendered English inline | Loses i18n:parity protection | |
| Separate localization registry table per task | Triple-table coordination | |

**User's choice:** Structured with i18n keys + dueDayOffset + requiredDocs

---

## PTO-aware manager fallback (Pitfall 26)

### How does the system check if a manager is on PTO?
| Option | Description | Selected |
|--------|-------------|----------|
| Calendar free-busy lookup primary, explicit OOO setting fallback | SC#2 specifies calendar; manual OOO covers no-calendar orgs | ✓ |
| Explicit OOO setting only | Contradicts SC#2 calendar wording | |
| Calendar-only (no manual OOO) | Excludes no-calendar orgs | |

**User's choice:** Calendar primary + explicit OOO secondary

### Fallback chain shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-team `Team.fallbackApproverId` + per-user override | Reasonable granularity | ✓ |
| Org-wide single fallback | Bottleneck | |
| Skip-level (manager's manager) | No org-chart hierarchy field exists | |

**User's choice:** Per-team with per-user override

### Behavior when no calendar integration?
| Option | Description | Selected |
|--------|-------------|----------|
| Skip PTO check; route normally; manual OOO still applies | Zero-config friendly | ✓ |
| Block until admin acknowledges | Over-engineering | |
| Auto-route to OWNER until calendar connects | Bottleneck | |

**User's choice:** Skip PTO check (no-config-friendly)

### PTO match rule (locale-aware)?
| Option | Description | Selected |
|--------|-------------|----------|
| Curated PTO_KEYWORDS per locale + all-day-busy heuristic + ops-extensible | Handles 'Urlaub' / 'Urlop' / etc. | ✓ |
| All-day-busy only | Falsely flags recurring all-day events | |
| Title-keyword match only | Misses untitled busy blocks | |

**User's choice:** Hybrid keyword + all-day-busy + ops extension

---

## Override permission registration + dialog UX

### Permission registry?
| Option | Description | Selected |
|--------|-------------|----------|
| Add to Better Auth `statements` array; OWNER role only; CI test | Mirrors v1.0 RBAC; SC#5 enforced | ✓ |
| Per-org configurable | Contradicts SC#5 | |
| Hard-coded in mutation only | Bypasses central RBAC | |

**User's choice:** Better Auth statements registration + CI test

### Dialog shape?
| Option | Description | Selected |
|--------|-------------|----------|
| Modal: reason ≥20 chars + ack checkbox + dual-validated submit | Weighty but single-screen | ✓ |
| Inline form | Too casual for permanent-badge action | |
| Two-step modal | Annoying for high-trust action | |

**User's choice:** Single modal with both fields

### Audit shape + permanent badge?
| Option | Description | Selected |
|--------|-------------|----------|
| Single AuditLog entry + OffboardingRecord.overrideMetadata JSONB | Mirrors Phase 71/76 patterns; performant render | ✓ |
| AuditLog only; badge derived at render time | Per-render audit query cost | |
| Dedicated OffboardingOverride table | Single-row-only; JSONB column equivalent | |

**User's choice:** AuditLog entry + JSONB column

### UI gating?
| Option | Description | Selected |
|--------|-------------|----------|
| `getCurrentUserPermissions` at page load + conditional render + server re-check | Belt-and-suspenders | ✓ |
| Server-only payload omission | Inconsistent with codebase patterns | |
| Client-only check | Trivially bypassable | |

**User's choice:** UI hide + server re-check

---

## i18n strategy for ops-extensible templates (SC#3 + SC#6 collision)

### How are seed templates' role-specific items localized?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-task i18n keys in messages/{en,de,pl}.json under Offboarding.Templates.{role}.{itemKey} | i18n:parity guard catches drift atomically | ✓ |
| Hardcoded English in typed-const | Contradicts SC#6 | |
| Inline {en,pl,de} on each item | Loses guard protection | |

**User's choice:** Per-task i18n keys (en/de/pl, ar excluded for OFFB scope)

### How are ops-added templates localized?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-template DB columns: titleEn/Pl/De + same on tasks; UI shows 3 input fields per item | LOCAL-ONLY-friendly; no translation services | ✓ |
| English-only with no per-locale fields | UX regression for non-English admins | |
| English-only + later translation queue | Adds queue state; per-template columns achieve same | |

**User's choice:** Per-locale DB columns + 3-input inline form

### Locale-fallback rule for ops templates?
| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to English with `(English)` visual indicator | Explicit signal; no silent fallback | ✓ |
| Silent fallback to English | Hides translation gaps | |
| Block render with error | UX-hostile for soft missing-data | |

**User's choice:** Fallback to English + visible indicator

### i18n:parity guard scope handling?
| Option | Description | Selected |
|--------|-------------|----------|
| Guard scope unchanged; ops DB rows are runtime data, signal via UI indicator | Keeps Phase 70 guard simple; LOCAL-ONLY-friendly | ✓ |
| Extend guard with DB-row completeness check | Introduces DB state into CI; complicates LOCAL-ONLY | |
| Separate `lint:ops-templates` guard for deploy envs | Visual indicator already covers user need | |

**User's choice:** Guard scope unchanged

---

## Claude's Discretion
- Exact 6-9 task items per seed (Researcher drafts)
- Acknowledgement checkbox copy (D-10)
- `(English)` indicator visual treatment
- Settings > Calendar PTO Keywords UI shape
- Whether to repurpose existing free-text role field or add new FK
- Permission-registry test exact shape
- No-team-no-OOO fallback admin-attention badge UI

## Deferred Ideas
- Skip-level fallback (manager's manager)
- On-the-fly translation service for ops templates
- Translation queue for ops templates
- Mid-workflow template swap
- Org-wide single fallback approver
- DB-row completeness check in i18n:parity guard
- Werkvertrag locked-phrase entries (deferred by ROADMAP itself to Phase 75)
- Arabic (ar) localization for OFFB (out of scope; Phase 79 covers AR for Gulf only)
