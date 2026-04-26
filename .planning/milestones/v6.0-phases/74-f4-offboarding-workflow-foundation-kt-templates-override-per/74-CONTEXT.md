# Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins running an offboarding workflow auto-receive a role-typed knowledge-transfer checklist routed to the correct manager (PTO-aware fallback); OWNER-role admins can override the IP-verification block with a recorded reason, but no other role can; ops can extend role taxonomy without engineering involvement. This phase ships the workflow foundation, role-template engine, override permission, PTO-aware routing, and en/pl/de message-key parity for OFFB surfaces.

Out of scope for Phase 74: IP verification UI + credential vault (Phase 75); Werkvertrag-locked-phrase wording (Phase 75); Arabic localization for OFFB (not in v6.0 scope per ROADMAP).

</domain>

<decisions>
## Implementation Decisions

### Role taxonomy + KT template seed shape
- **D-01:** **Hybrid storage**: 4 seeds ship as typed constants in a new `@contractor-ops/offboarding-templates` workspace package (mirrors Phase 70 D-02 / Phase 71 D-01 patterns). On first boot per org, seeds are upserted into a `WorkflowRoleTemplate` Prisma table with `isSeed: true`. Ops-added templates land in the same table with `isSeed: false`. Single read path for the workflow engine; SC#3 satisfied via Settings UI; SC#1 auditability satisfied via code.
- **D-02:** **Contractor role tag**: new `Contractor.workflowRoleId` FK to `WorkflowRoleTemplate`. Set in the contractor wizard (likely converting the existing free-text 'Role / Position' field — Researcher confirms). Backfill maps existing free-text role to the closest seed (SE / Designer / PM / Generic Consultant) with manual review for ambiguous cases; default fallback = `Generic Consultant`.
- **D-03:** **Manual override** at offboarding-start: dropdown showing all `WorkflowRoleTemplate`s for the org. Default = auto-selected by `Contractor.workflowRoleId`. Admin's selection (if different from auto) is recorded on the workflow-run row: `overriddenTemplateId`, `overriddenByUserId`, `overriddenAt`. **No mid-workflow swap** (would corrupt task state).
- **D-04:** **Seed shape (typed-const)**:
  ```ts
  type Seed = {
    role: 'software_engineer' | 'designer' | 'product_manager' | 'generic_consultant';
    displayNameI18nKey: string;       // e.g. 'Offboarding.Templates.SoftwareEngineer.displayName'
    taskItems: TaskItem[];            // 6-9 items per seed (per SC#1)
  };
  type TaskItem = {
    titleI18nKey: string;
    descriptionI18nKey: string;
    dueDayOffset: number;             // days from offboarding-start
    requiredDocs?: DocumentType[];    // e.g. SE seed includes IP_ASSIGNMENT (Phase 75 hook)
  };
  ```
  i18n keys reference message catalog entries so Phase 70's `pnpm i18n:parity` guard catches drift on seed adds.

### PTO-aware manager fallback (Pitfall 26)
- **D-05:** **PTO source layered**: primary = calendar free-busy lookup via existing v2.0 calendar adapter (`packages/integrations/src/adapters/google-calendar-adapter.ts`); secondary = explicit per-user `User.outOfOffice: { from, until, fallbackUserId }` setting that admins can fill manually. Either source triggers fallback routing.
- **D-06:** **Fallback chain (per-team)**:
  - Default: manager → their team's `Team.fallbackApproverId` (configured in Settings > Teams) → OWNER role users.
  - Per-user override: `User.outOfOffice.fallbackUserId` takes precedence over team default if set (manager configures their own backup before going on PTO).
  - If team has no fallback configured, falls through to OWNER role users + raises an admin-attention badge.
- **D-07:** **No-calendar behavior**: if the org has no calendar integration connected, **skip the PTO check entirely** and route to manager normally. The manual `User.outOfOffice` setting still applies. Zero-config-friendly. Calendar-connected orgs get the PTO-aware path.
- **D-08:** **PTO match rule**: a manager is considered on PTO TODAY if either:
  - An all-day busy event exists on their primary calendar today (regardless of title); OR
  - A timed busy event exists today whose title matches a curated keyword list per locale.
  - Curated list ships as typed const: `PTO_KEYWORDS = { en: ['PTO', 'OOO', 'Out of Office', 'Vacation'], de: ['Urlaub', 'Krank'], pl: ['Urlop', 'Wakacje'] }`. Ops can extend via Settings > Calendar PTO Keywords (mirrors SC#3's ops-extensible pattern).
  - Either signal triggers fallback routing per D-06.

### Override permission registration + dialog UX
- **D-09:** **Permission registration**: add `workflow:override_blocking_task` to Better Auth's `statements` array in `packages/auth/src/permissions.ts`. Map to OWNER role only. CI test (per SC#5) iterates non-OWNER roles (admin, manager, finance, viewer, contractor) and asserts `hasPermission({ workflow: ['override_blocking_task'] })` returns false for each. The existing `requirePermission()` middleware factory at `packages/api/src/middleware/rbac.ts` is the gate on the mutation.
- **D-10:** **Override dialog**: modal dialog with:
  - Reason textarea (min 20 chars, validated client-side AND re-validated server-side per PROJECT.md "Never trust client input").
  - Acknowledgement checkbox: text "I confirm IP verification is being intentionally bypassed and accept responsibility for any compliance gap" (Researcher finalizes copy).
  - "Override" button disabled until BOTH validations pass.
  - "Cancel" button always enabled.
  - On submit: writes the override record (D-11) and AuditLog entry, then completes the offboarding in the same transaction.
- **D-11:** **Audit shape + permanent badge**:
  - Single `AuditLog` entry per override invocation (mirrors Phase 71 D-15 / Phase 76 D-04 patterns):
    - `actor` = OWNER user id
    - `action` = `workflow.offboarding.override_blocking_task`
    - `target` = offboarding-record id
    - `payload` = `{ reason, blockedTaskKind: 'IP_VERIFICATION', acknowledgedAt, ipAddress, userAgent }`
  - Permanent badge data: new `OffboardingRecord.overrideMetadata` JSONB column storing `{ reason, overriddenByUserId, overriddenAt, blockedTaskKind }`. Always-rendered red badge above the offboarding header. Both writes (audit + record column) in the same transaction.
- **D-12:** **UI gating**: `getCurrentUserPermissions` tRPC query at page load + conditional render of the override button based on `permissions.workflow.includes('override_blocking_task')`. Server `requirePermission()` re-checks on every mutation invocation regardless of UI gating. Belt-and-suspenders.

### i18n strategy for ops-extensible templates (SC#3 + SC#6 collision)
- **D-13:** **Seed templates' role-specific items localized via per-task-item i18n keys** under `Offboarding.Templates.{role}.{itemKey}` in `messages/{en,de,pl}.json`. (Note: Arabic excluded for OFFB per ROADMAP scope — Phase 79 covers AR for Gulf surfaces only.) Phase 70's `pnpm i18n:parity` guard catches drift atomically. **Werkvertrag-related copy is NOT shipped this phase** — that lands in Phase 75 per SC#6.
- **D-14:** **Ops-added templates carry per-locale fields directly on the DB row**:
  - `WorkflowRoleTemplate` columns: `titleEn`, `titlePl`, `titleDe` (and `displayNameEn` / `Pl` / `De` for the role label).
  - Per-task `WorkflowTaskTemplate` columns: `titleEn`, `titlePl`, `titleDe`, `descriptionEn`, `descriptionPl`, `descriptionDe`.
  - The Settings UI for adding a new role template surfaces 3 input fields per task item (en/pl/de), with a "Copy from English" helper button to seed pl/de from en. No on-the-fly translation services (LOCAL-ONLY).
- **D-15:** **Locale-fallback rule**: when a key is missing for the active locale on an ops-added template, render the English value with a small visual `(English)` indicator (muted suffix or info icon). Seed templates always have all locales (i18n:parity guard enforces). Ops templates may have gaps but they're visibly signaled — no silent fallback.
- **D-16:** **i18n:parity guard scope unchanged**: Phase 70's `pnpm i18n:parity` continues to enforce json-file parity for SEED templates and the rest of the app surfaces (override dialog, settings UI, badge copy). Ops-added DB rows are intentionally **out of scope** for the guard (they're runtime data, not source). The `(English)` visual indicator (D-15) is the user-facing signal mechanism. SC#6 reads naturally as "all OFFB **surfaces** ship en/pl/de parity" — surfaces ship parity; runtime user-content doesn't.

### Claude's Discretion
- The exact 6-9 task items per seed (Researcher drafts the SE / Designer / PM / Generic Consultant baselines; production wording is reviewable in code).
- Acknowledgement checkbox copy (D-10) — Researcher finalizes.
- The `(English)` indicator visual treatment (suffix vs info icon vs both) — match existing design-system conventions; UI-SPEC determines.
- The Settings > Calendar PTO Keywords UI shape (D-08 ops-extension) — Phase 73 owns broader admin dashboard polish; this phase ships functional UI only.
- Whether the `Contractor.workflowRoleId` migration creates a new column or repurposes the existing free-text 'Role / Position' field — Researcher confirms current schema; if the existing field is `String?` and lightly used, repurpose; if heavily used, add a new FK and deprecate the free-text in a follow-up.
- The exact permission-registry test shape (D-09 SC#5) — match existing `rbac.test.ts` patterns.
- The fallback when no team-level `fallbackApproverId` AND no per-user OOO setting exist — D-06 says "fall through to OWNER role users + raise admin-attention badge"; the badge UI shape is at planner discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workflow engine baseline (extension target for D-01..D-04)
- `packages/db/prisma/schema/workflow.prisma` — existing `WorkflowTemplate`, `WorkflowTaskTemplate`, `WorkflowTemplateType` enum, `WorkflowTemplateStatus` enum. New `WorkflowRoleTemplate` plugs in here.
- `packages/api/src/routers/workflow-templates.ts` — existing v1.0 template CRUD; Phase 74 extends with role-template endpoints.
- `packages/api/src/routers/workflow-shared.ts` — workflow shared utilities; Phase 74 plugs the auto-selection logic here.

### RBAC baseline (D-09)
- `packages/auth/src/permissions.ts` — Better Auth `statements` registry; Phase 74 adds `workflow:override_blocking_task` here, OWNER-role only.
- `packages/api/src/middleware/rbac.ts` — `requirePermission()` middleware factory; D-09 plugs the new permission in.
- `packages/api/src/middleware/__tests__/rbac.test.ts` — existing RBAC test patterns; D-09 test mirrors these.

### Calendar adapter baseline (D-05, D-08)
- `packages/integrations/src/adapters/google-calendar-adapter.ts` — v2.0 Google Calendar adapter; needs free-busy lookup method (Researcher confirms whether one already exists or must be added).
- v2.0 Outlook calendar adapter (locate during research) — same free-busy lookup method.

### Contractor schema baseline (D-02)
- `packages/db/prisma/schema/contractor.prisma` — existing `Contractor` model; D-02 adds `workflowRoleId` FK.

### Audit log infrastructure (D-11)
- Existing `audit_log` Prisma table — D-11 emits a single entry per override invocation; reuses Phase 71 D-15 / Phase 76 D-04 patterns. No new audit table.

### i18n infrastructure (D-13..D-16)
- `apps/web/messages/{en,de,pl,ar}.json` — message catalog. D-13 adds `Offboarding.Templates.*` keys to en/de/pl (NOT ar — OFFB scope excludes Arabic).
- `packages/lint-guards/src/lint-i18n-parity.ts` (Phase 70 Plan 70-04) — the `pnpm i18n:parity` guard. D-16: scope unchanged; ops-added DB rows are OUT of guard scope.
- `packages/validators/src/legal/{en,de,pl}.ts` — locked-phrase registry. **Werkvertrag-related entries are NOT extended this phase** (Phase 75 owns Werkvertrag wording). Phase 74 extends with non-locked-phrase OFFB copy only.

### Phase 70 dependencies
- `packages/feature-flags/src/signoff-registry-flags.ts` — Phase 70 D-09..12 parallel signoff registry. Phase 74 ships `offboarding-hardening-foundation` flag PENDING entry here. The flag falls under the `offboarding-ip-*` gated namespace per Phase 70 D-11 (planner verifies the exact namespace mapping; if `offboarding-hardening-foundation` doesn't match `offboarding-ip-*`, rename to `offboarding-ip-foundation` for namespace consistency).
- `packages/lint-guards/src/lint-i18n-parity.ts` — i18n:parity guard catches en/pl/de drift on the seed-template keys.

### Cross-phase dependencies
- **Phase 70 (shipped)**: i18n:parity guard, signoff-registry-flags, gated namespace, typed-constants pattern.
- **Phase 71 (planned, in progress)**: TZ library pin (`date-fns-tz` or `dayjs/plugin/timezone`) — Phase 74 may need same library for `User.outOfOffice.from/until` boundary computation; align with Phase 71's choice.
- **Phase 75 (not yet built)**: IP_VERIFICATION task implementation, Werkvertrag locked-phrase wording. Phase 74 ships the override mechanism; Phase 75 fills in the blocked-task definition + Werkvertrag entries.
- **Phase 76 (planned, in progress)**: workflow `ACCESS_REVOKE` task hook (Phase 76's saga consumer) — Phase 74's KT templates DO NOT include access-revoke tasks; that's Phase 75/76 territory.
- **v2.0 calendar integration** — D-05 leans on this; if research uncovers gaps, plan should include adapter extensions.

### ROADMAP entry (success criteria source-of-truth)
- `.planning/ROADMAP.md` "Phase 74: F4 Offboarding — Workflow Foundation + KT Templates + Override Permission" — 6 numbered success criteria.
- ROADMAP marks `**UI hint:** yes` — recommend running `/gsd-ui-phase 74` before `/gsd-plan-phase 74` to produce a UI-SPEC.md design contract for the override dialog, settings UI, badge, and template-selection dropdown.

### Standing constraints
- `.planning/STATE.md` "Standing Project Constraints" — LOCAL-ONLY deploy, legal review DEFERRED. Werkvertrag wording (locked-phrase) is intentionally Phase 75; this phase doesn't write any locked-phrase entries.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WorkflowTemplate` + `WorkflowTaskTemplate`** (packages/db/prisma/schema/workflow.prisma) — v1.0 template engine; Phase 74 layers role-template metadata on top, doesn't replace.
- **`requirePermission()` middleware** (packages/api/src/middleware/rbac.ts) — D-09's permission gate plugs in directly.
- **Better Auth `statements`** (packages/auth/src/permissions.ts) — D-09 registration target.
- **Existing audit_log table** — D-11 single-entry-per-event pattern (Phase 71 D-15 / Phase 76 D-04 precedent).
- **`google-calendar-adapter.ts`** (packages/integrations/src/adapters/) — D-05 free-busy lookup target. Researcher confirms whether free-busy method already exists.
- **`pnpm i18n:parity` guard** (Phase 70 Plan 70-04) — D-13 enforces seed-template parity automatically.
- **`signoff-registry-flags.ts`** (Phase 70) — `offboarding-hardening-foundation` PENDING entry plugs in here.

### Established Patterns
- **Typed-constants over runtime config** (Phase 70 D-02; Phase 71 D-01; Phase 76 D-14) — D-01 follows this for the 4 seeds; D-08 follows this for `PTO_KEYWORDS`.
- **Hybrid TS-source + DB-runtime when ops-extensibility is required** (NEW for this phase, but parallel to Phase 71 D-01's "TS source-of-truth + classification engine consumer" decision tree) — D-01 ships this hybrid. Worth recording as an established-from-now pattern.
- **Single audit-log entry per state-changing event** (Phase 71 D-15; Phase 76 D-04) — D-11 follows.
- **WAIVED preserved, never deleted** (Phase 71 D-09) — applies in spirit: override records are append-only on `OffboardingRecord.overrideMetadata`; never null-out.
- **Belt-and-suspenders permission gating** (UI hide + server enforce) — D-12 follows existing codebase conventions.
- **Locale-fallback with explicit signal** (NEW for ops content; matches Phase 70's locked-phrases-guard "explicit signaling rather than silent fallback" sentiment).

### Integration Points
- **`packages/db/prisma/schema/workflow.prisma`** — new `WorkflowRoleTemplate` model + per-locale columns on `WorkflowTaskTemplate` per D-14. Multi-region migration per Standing Constraint.
- **`packages/db/prisma/schema/contractor.prisma`** — `Contractor.workflowRoleId` FK (D-02).
- **`packages/db/prisma/schema/organization.prisma`** — `Team.fallbackApproverId` (D-06) and `User.outOfOffice` JSONB (D-05) — Researcher confirms whether `Team` model exists or must be introduced.
- **`packages/auth/src/permissions.ts`** — D-09 `workflow:override_blocking_task`.
- **`packages/api/src/routers/workflow-templates.ts`** — extend with role-template CRUD (`createRoleTemplate`, `listRoleTemplates`, `updateRoleTemplate`).
- **`packages/api/src/routers/workflow-shared.ts`** OR new `packages/api/src/routers/offboarding.ts`** — auto-selection logic (D-02, D-03), PTO check (D-05..D-08), override mutation (D-10, D-11, D-12). Researcher chooses split.
- **`packages/integrations/src/adapters/google-calendar-adapter.ts`** + Outlook adapter — free-busy lookup method (D-05); add if missing.
- **New `@contractor-ops/offboarding-templates` workspace package** — host for the 4 typed-const seeds + `PTO_KEYWORDS` typed const.
- **`apps/web/src/components/offboarding/`** (likely path) — override modal, settings UI for role templates, settings UI for PTO keywords.
- **`apps/web/messages/{en,de,pl}.json`** — D-13 adds `Offboarding.Templates.*`, override dialog copy, settings copy, badge copy.
- **`packages/feature-flags/src/signoff-registry-flags.ts`** — `offboarding-hardening-foundation` (or `offboarding-ip-foundation`) PENDING entry.

</code_context>

<specifics>
## Specific Ideas

- The 4 seed roles (Software Engineer / Designer / Product Manager / Generic Consultant) come straight from SC#1; Researcher pins the 6-9 task items per seed against contractor-ops industry-standard handover checklists.
- The `PTO_KEYWORDS` per-locale typed const should be small enough (~5 keywords per locale) to be reasonable to hand-curate; ops extension at runtime catches edge cases (e.g. internal company codenames).
- The override dialog modal should feel weighty but not punishing — single screen, two clear inputs, explicit responsibility-acceptance text.
- The permanent red badge above an overridden offboarding record is the primary UX signal that compliance was bypassed; should remain visible regardless of subsequent edits.
- The hybrid storage pattern (TS-source seeds + DB-runtime extensions) is worth documenting as a reusable pattern — future phases that need ops-extensible config can follow this template.
- The `(English)` fallback indicator should NOT use a parenthetical for keys that legitimately don't exist in pl/de yet — only ops-added templates with empty per-locale columns. Seed templates should never trigger this (i18n:parity guard ensures).

</specifics>

<deferred>
## Deferred Ideas

- **Skip-level fallback (route to manager's manager)** — rejected in D-06 (no manager-of-manager hierarchy field exists). Revisit if v7+ adds an org-chart hierarchy.
- **On-the-fly translation service for ops-added templates** — rejected in D-14 (LOCAL-ONLY constraint). Revisit when LOCAL-ONLY lifts; could integrate with DeepL or similar.
- **Translation queue for ops templates** — rejected in D-14 in favor of inline 3-locale form. Revisit if ops report the inline approach is too friction-heavy.
- **Mid-workflow template swap with task regeneration** — rejected in D-03 (data-migration risk). Could revisit as an "abandon and restart" UX (delete current run, start fresh) without touching task state.
- **Org-wide single fallback approver** — rejected in D-06 (bottleneck risk). Per-team is the floor of granularity.
- **DB-row completeness check in i18n:parity guard** — rejected in D-16 (introduces DB state into a CI lint guard). The visual indicator covers user-facing needs.
- **Org-wide override-everyone-permission flag** — rejected implicitly by SC#5 ("OWNER-only and CI-tested"). No revisit unless requirements change.
- **Werkvertrag locked-phrase entries** — explicitly DEFERRED to Phase 75 by the ROADMAP itself (SC#6 wording).
- **Arabic (ar) localization for OFFB surfaces** — out of scope per ROADMAP. Phase 79 covers AR for Gulf surfaces only.

</deferred>

---

*Phase: 74-f4-offboarding-workflow-foundation-kt-templates-override-per*
*Context gathered: 2026-04-27*
