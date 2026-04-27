# Phase 73: F1 Compliance — Admin Dashboard + Portal Self-Service + i18n — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 73-CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-27
**Phase:** 73-f1-compliance-admin-dashboard-portal-self-service-i18n
**Mode:** discuss (default mode, no flags)
**Areas discussed:** Dashboard composition & at-risk semantics, Portal one-click upload-replacement flow, Manual admin override → WAIVED flow, Locked-phrase registry additions for COMPL doc names

---

## Area selection

User selected ALL FOUR proposed areas via multiSelect — full coverage of the four ROADMAP success criteria.

| Option | Selected? |
|--------|-----------|
| Dashboard composition & at-risk semantics | ✓ |
| Portal one-click upload-replacement flow | ✓ |
| Manual admin override → WAIVED flow | ✓ |
| Locked-phrase registry additions for COMPL doc names | ✓ |

---

## Area 1 — Dashboard composition & at-risk semantics

### Q1: Three-widget dashboard layout

| Option | Selected |
|--------|----------|
| 3-up summary cards + scrollable table below | ✓ |
| Three side-by-side queues, no summary cards | — |
| Summary cards + three separate scrollable sections | — |

→ **D-01.** Decision: 3-up KPI summary cards + tabbed table region. Card click switches active tab. Default tab = "At risk". Reuses v1.0 dashboard KPI-card + v3.0 tabbed-table idiom.

### Q2: At-risk filter semantics

| Option | Selected |
|--------|----------|
| Any BLOCKING item in MISSING/EXPIRED OR within 30 days of expiry | ✓ |
| Only BLOCKING items currently MISSING/EXPIRED | — |
| All severities approaching expiry within 30 days | — |

→ **D-02.** Decision: BLOCKING + (MISSING/EXPIRED OR ≤30 days from expiry), exclude WAIVED. Index `(severity, status, expiresAt)` required.

### Q3: Drilldown pattern from KPI cards

| Option | Selected |
|--------|----------|
| Row links to contractor profile Compliance tab | ✓ |
| Row expands inline with item details | — |
| Row opens a side-panel drawer | — |

→ **D-05.** Decision: navigate to `/contractors/{id}/compliance#item-{itemId}`. Compliance tab is canonical per-contractor surface. Per-row hover affordances: Recompute + Override.

### Q4: Blocked-payments queue data source

| Option | Selected |
|--------|----------|
| Live eligibility re-check + recent FAIL `PaymentRunComplianceCheck` rows | ✓ |
| Only `PaymentRunComplianceCheck WHERE verdict = FAIL` | — |
| Only live eligibility re-check over DRAFT PaymentRuns | — |

→ **D-04.** Decision: TWO sources merged (live + 7-day historical FAIL rows), deduped by paymentRunId, 60s polling. Reuses Phase 72 D-10 contractorReasons[] payload shape.

---

## Area 2 — Portal one-click upload-replacement flow

### Q1: Upload validation

| Option | Selected |
|--------|----------|
| MIME/size check + admin review queue (skip OCR for v6.0) | ✓ |
| OCR pre-parse via Claude Vision, auto-classify documentType | — |
| Admin-only flip — contractor uploads, admin clicks Mark satisfied | — |

→ **D-06.** Decision: MIME whitelist (PDF/PNG/JPG, ≤10MB) + virus scan (existing pipeline) + Document `PENDING_REVIEW` + admin reviews/approves. No AI verdict on COMPL surfaces (Standing Constraint).

### Q2: `expiresAt` source on upload

| Option | Selected |
|--------|----------|
| Auto-derived from policy template, contractor confirms | ✓ |
| Contractor enters manually, no template fallback | — |
| Pure template, no contractor input | — |

→ **D-07.** Decision: pre-fill from policy template (uploadDate + maxValidity per `policyRule`); contractor confirms or overrides; admin can adjust during review. New `defaultExpiryFromUploadDate` helper in `@contractor-ops/compliance-policy`.

### Q3: Failure handling — admin rejection flow

| Option | Selected |
|--------|----------|
| Admin rejects with structured reason → contractor re-prompted | ✓ |
| Admin rejects with free-text only, contractor re-prompted | — |
| Auto-purge rejected uploads after N days | — |

→ **D-08.** Decision: closed-enum reject category (`wrong_document_type`, `illegible`, `already_expired`, `forged_or_altered`, `other`) + optional free-text. Contractor re-notified. Audit log entry `compliance.upload.rejected`.

### Q4: Portal notification trigger hook

| Option | Selected |
|--------|----------|
| Phase 72 cron emits the in-app notification, Phase 73 renders the surface | ✓ |
| Phase 73 adds a separate portal cron alongside the admin cron | — |
| On-demand notification at portal page load | — |

→ **D-09.** Decision: Phase 73 = pure surface layer. New in-app notification template renders Phase 72's digest payload contractor-side; new portal route `/portal/compliance/upload-replacement?itemId=...` opens from deep-link; portal-home banner if any item is MISSING/EXPIRED or in 30-day band. No duplicate cron.

---

## Area 3 — Manual admin override → WAIVED flow

### Q1: Permission scope for override

| Option | Selected |
|--------|----------|
| New `compliance:override` permission, default-granted to OWNER + ADMIN roles | ✓ |
| Reuse existing `contractor:write` permission | — |
| OWNER-only (mirrors Phase 74 D-03 IP-verification override) | — |

→ **D-10.** Decision: new permission `compliance:override` registered in `packages/auth/src/permissions.ts` (mirrors Phase 74 D-03 pattern). Default-granted OWNER + ADMIN. Per-org admins can re-scope.

### Q2: Reason text validation

| Option | Selected |
|--------|----------|
| Closed enum + free-text required | ✓ |
| Free-text only, min 20 chars | — |
| Structured form per jurisdiction | — |

→ **D-11.** Decision: closed-enum `WaivedReasonCategory` (`contractor_offboarded`, `engagement_changed`, `regulatory_exemption`, `temporary_grace_period`, `admin_correction`, `other`) + free-text rationale (min 20 chars). Two new nullable columns on `ContractorComplianceItem`.

### Q3: Override button placement

| Option | Selected |
|--------|----------|
| Both: Compliance tab inline + dashboard table row hover | ✓ |
| Compliance tab only | — |
| Dashboard tables only | — |

→ **D-12.** Decision: TWO surfaces, ONE shared `<OverrideComplianceItemDialog>` modal. Tab inline + dashboard hover both call same `compliance.overrideItem` mutation.

### Q4: Override history surface

| Option | Selected |
|--------|----------|
| Inline timeline on the Compliance tab + AuditLog grep | ✓ |
| Separate "Override history" page per contractor | — |
| Just the audit log — no inline UI | — |

→ **D-13.** Decision: Compliance tab item row gets a "History" expand-arrow timeline rendering audit-log entries filtered by `target = itemId`. Inline WAIVED badge with category icon + tooltip. No new audit-log table.

---

## Area 4 — Locked-phrase registry additions for COMPL doc names

### Q1: Registry location

| Option | Selected |
|--------|----------|
| New per-jurisdiction module: `legal/compliance-uk.ts`, `compliance-de.ts`, etc. | ✓ |
| Extend existing per-jurisdiction `legal/de.ts`/`gb.ts` modules | — |
| Single flat global `LOCKED_COMPL_DOC_NAMES` map | — |

→ **D-14.** Decision: five new modules `legal/compliance-{uk,de,pl,uae,ksa}.ts`, each exporting `LOCKED_COMPL_NAMES_<jurisdiction>` + `RESERVED_COMPL_KEYS_<jurisdiction>`. `legal/index.ts` aggregator re-exports. Per-jurisdiction legal review can land per-file.

### Q2: Entry schema

| Option | Selected |
|--------|----------|
| Keyed by `policyRuleId`, value = per-locale phrase map | ✓ |
| Keyed by i18n message-key, value = per-locale phrase map | — |
| Flat per-locale arrays without per-rule keying | — |

→ **D-15.** Decision: `policyRuleId`-keyed (e.g. `'uk.right_to_work@v3'`) → `{ en, pl, de }` phrase maps. i18n keys derived mechanically: `compliance.docName.<jurisdiction>.<stable-namespace>`. New `useComplDocName(policyRuleId)` hook.

### Q3: Signoff posture

| Option | Selected |
|--------|----------|
| All PENDING, unblocked per-jurisdiction by post-deploy legal review | ✓ |
| PENDING but no UI footnote | — |
| APPROVED on first commit, owner = developer | — |

→ **D-16.** Decision: every entry lands PENDING in `signoff-registry.json`. UI renders subscript flag "Right-to-Work share code¹" with footer "¹ phrasing pending legal review" while PENDING. `FLAG_SIGNOFF_BYPASS=local` bypass for engineers. Production-deploy gate: zero PENDING in scope.

### Q4: Parity validation

| Option | Selected |
|--------|----------|
| New dedicated `compl-doc-names-parity` test | ✓ |
| Fold into existing `locked-phrases-guard.test.ts` | — |
| Fold into existing `i18n:parity` CI guard | — |

→ **D-17.** Decision: new test file `packages/validators/src/__tests__/compl-doc-names-parity.test.ts` mirroring `locked-phrases-guard.test.ts` shape. Asserts policyRuleId↔phrase coverage + en/pl/de presence + signoff entry presence.

---

## Wrap-up question

| Option | Selected |
|--------|----------|
| Write CONTEXT.md now | ✓ |
| Add one more clarification | — |

→ Proceeded to write CONTEXT.md.

---

## Claude's discretion (deferred to Researcher / Planner)

- Exact dashboard KPI-card visual + table column order + responsive collapse — match v1.0/v3.0 patterns.
- Whether `Document.rejectionReason` is a new column or audit-log-only (recommend audit-log-only).
- Exact contractor portal home banner placement (top-of-page vs floating chip).
- Polling cadence for "Blocked payments" tab (recommend 60s).
- Final wording of override modal + reject modal (placeholder English; Phase 73 i18n locked-phrase pass for admin-facing copy).
- Whether `WaivedReasonCategory` lives in Prisma enum vs `@contractor-ops/compliance-policy` const-mapped Zod literal — recommend Prisma enum.
- Exact font/icon for "pending legal review" subscript flag.

## Deferred ideas (for future phases or backlog)

See `<deferred>` section of 73-CONTEXT.md — 14 ideas captured.

## Background events during the discussion

- Phase 72 planner (background agent) completed mid-discussion: 8 plans across 4 waves, RESEARCH.md + VALIDATION.md + PATTERNS.md written, all 19 Phase 72 CONTEXT decisions addressed. Pinned cron schedule (09:00 UTC piggyback on existing route, NOT 02:00 as Phase 72 CONTEXT mentioned), GIN index syntax (`jsonb_path_ops`), and date library (`@date-fns/tz` not dayjs) — minor refinements to Phase 72's "Claude's Discretion" items. None of these refinements affect Phase 73 decisions, which consume Phase 72 surfaces (PaymentRunComplianceCheck, dispatch payload) at the API contract level.

---

*Mode: discuss (default)*
*Discussion completed: 2026-04-27*
