# Phase 6: Approval Workflow - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Configurable approval chains that route invoices through multi-level approvals (1-3 levels) with SLA enforcement, delegation, and full audit trail. Admin configures chain templates with amount-based routing conditions. Approvers act from a dedicated queue with inline actions. Every decision is recorded with actor, timestamp, and comment. This phase does NOT include email/Slack notifications (Phase 7) — escalation events are emitted for Phase 7 to consume.

</domain>

<decisions>
## Implementation Decisions

### Chain configuration UX
- **D-01:** Stacked level cards — vertical stack of 1-3 level cards (consistent with workflow task cards from Phase 4). Each card: level name, approver (user picker or role dropdown), SLA hours, required toggle. Add/remove level buttons
- **D-02:** Threshold conditions on chain — each chain has optional conditions (e.g., "amount > 10,000 PLN"). System picks the first matching chain at submission time. Default chain as fallback. Stored in conditionsJson
- **D-03:** Chain management lives in Settings > Approvals tab — new tab alongside existing org/users/workflows tabs. Chain list with create/edit/delete
- **D-04:** Visual chain tracker on invoice detail — horizontal stepper showing each level: who approves, status (pending/approved/rejected), SLA countdown. Chain is snapshot at submission time (changes don't affect in-flight approvals)

### Approver queue & actions
- **D-05:** Dedicated /approvals page with TanStack Table — columns: Invoice #, Contractor, Amount, Submitted, SLA remaining, Priority. Sorted overdue-first, then by due date. Two tabs: "My Approvals" (default) and "All" (admin only)
- **D-06:** Inline approve/reject actions on row hover — Approve is one-click, Reject opens popover for mandatory comment. "Request clarification" and "Delegate" as secondary actions in a "More" dropdown menu
- **D-07:** Bulk approve/reject via checkbox select + floating toolbar — select multiple items, toolbar shows "Approve (N)" / "Reject (N)". Bulk reject requires one shared comment. Same pattern as contractor bulk actions from Phase 2

### SLA timers & escalation
- **D-08:** Countdown badge with color coding — green (>50% SLA left), yellow (25-50%), red (<25% or overdue). Shows "22h left" or "OVERDUE 3h". Appears in queue table, chain tracker on detail, and side panel
- **D-09:** SLA breach = visual flag + notification event — step marked OVERDUE (red badge), queue row gets warning icon, system emits `approval.sla_breached` event for Phase 7 to consume. No auto-escalation or auto-approve in v1
- **D-10:** Calendar hours in v1 — simple countdown from submission. Business hours deferred to v1.5 if needed

### Audit trail display
- **D-11:** Vertical timeline on invoice detail — chronological, most recent at top. Each entry: actor avatar, action (Approved/Rejected/Delegated/Clarification requested), comment, timestamp
- **D-12:** Both system + human events in timeline — system events: "Submitted for approval", "Routed to chain: Standard Invoice", "SLA breached at Level 2", "Delegated from Jan to Anna". System events styled differently (lighter, no avatar)
- **D-13:** Audit trail visible to anyone who can view the invoice — transparency, controlled by existing invoice view permission via RBAC

### Claude's Discretion
- Chain form field layout and validation rules
- Condition builder UI implementation (simple form vs drag-and-drop)
- Exact queue table column widths and responsive behavior
- Side panel content for approval queue rows
- Chain tracker exact sizing and animation
- Empty states for approvals page
- Timeline entry spacing and styling
- How "Request clarification" notifies the submitter (in-app vs just status change)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with approval workflow requirements (section 11.5), API contracts (section 15), UI views
- `db-schema.md` — Complete database schema including ApprovalChainConfig, ApprovalFlow, ApprovalStep, ApprovalDecision models

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 6 requirements: APPR-01 through APPR-09, ORG-08
- `.planning/ROADMAP.md` — Phase 6 plans: chain config, routing/state machine, approver actions/queue, SLA/escalation, audit trail

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, RBAC with 8 roles, hidden unauthorized items, Settings page structure
- `.planning/phases/02-contractor-registry/02-CONTEXT.md` — TanStack Table patterns, side panel, bulk actions with floating toolbar
- `.planning/phases/04-workflow-engine/04-CONTEXT.md` — Stacked card pattern for levels/tasks, inline expandable cards, checklist-style progress
- `.planning/phases/05-invoice-intake-matching/05-CONTEXT.md` — Invoice status flow (PENDING_APPROVAL → APPROVED/REJECTED), invoice detail page layout, match card

### Prisma schema
- `packages/db/prisma/schema/approval.prisma` — ApprovalChainConfig (stepsJson, conditionsJson), ApprovalFlow (status, currentStepOrder), ApprovalStep (slaDeadline, approverUserId/Role), ApprovalDecision (decision, comment, actor)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/prisma/schema/approval.prisma` — Full ApprovalChainConfig, ApprovalFlow, ApprovalStep, ApprovalDecision models with all fields, enums, indexes, and relationships already defined
- `apps/web/src/components/contracts/contract-table/` — Full TanStack Table pattern to follow for approval queue
- `apps/web/src/components/contractors/contractor-table/data-table-toolbar.tsx` — Bulk action toolbar pattern to reuse for bulk approve/reject
- `apps/web/src/components/invoices/invoice-detail/` — Invoice detail page with match card, metadata form — chain tracker and audit timeline integrate here
- `apps/web/src/components/invoices/status-chip-bar.tsx` — Status chip pattern reusable for approval status filtering
- `apps/web/src/components/settings/` — Existing settings page structure to extend with Approvals tab

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with `tenantProcedure` + `requirePermission()` middleware chain
- Validators in `packages/validators/src/` with Zod schemas
- `plain()` helper to strip Prisma class prototypes from tRPC returns
- React Hook Form + Zod resolver for all forms
- `useTranslations()` from next-intl for all UI text
- URL query params via nuqs for page state
- `prisma.$transaction()` for atomic multi-step operations (critical for approval state machine)
- Popover pattern used throughout for inline forms (reject comment, delegation picker)

### Integration Points
- Sidebar nav "Approvals" already configured in `apps/web/src/lib/navigation.ts` with route /approvals and approval permission
- Invoice detail page — chain tracker and audit timeline integrate alongside existing match card
- Invoice status transitions — `submitForApproval` procedure in invoice router needs to create ApprovalFlow and route to correct chain
- Invoice router `transitionStatus` — needs to accept approval decisions and update invoice status accordingly
- Root tRPC router in `packages/api/src/root.ts` — needs approval router registration
- Auth permissions — approval resource with CRUD + approve/reject actions
- Settings page — needs new Approvals tab for chain management
- Organization `settingsJson` — extend for default approval chain config

</code_context>

<specifics>
## Specific Ideas

- Chain tracker as horizontal stepper is the key UX differentiator — user sees exactly where their invoice is in the approval pipeline at a glance
- Inline approve/reject on queue rows keeps the flow fast for approvers processing 10-20 invoices daily
- Amount-based routing (threshold conditions) handles the real-world pattern: small invoices need 1 approval, large ones need 3
- System events in audit timeline provide complete compliance trail — auditors can see not just who decided but how the invoice got routed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-approval-workflow*
*Context gathered: 2026-03-21*
