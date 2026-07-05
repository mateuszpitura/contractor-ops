# Plan 93-05 Summary — Per-market employee lifecycle templates

**Wave:** 2 · **Status:** complete

## What shipped

- **New `@contractor-ops/employee-templates` package** (source-resolved, mirrors `offboarding-templates`):
  - `types.ts` — `MarketTemplateSeed` / `MarketTaskSeed` + `GovStubKind` + `CertType` unions.
  - `registry.ts` + `content/{pl,de,uk,us}.ts` — register-on-import `Jurisdiction`-keyed content; `index.ts` materializes `ALL_MARKET_TEMPLATE_SEEDS` (8 = 4 jurisdictions × ONBOARDING + OFFBOARDING) and exports `upsertEmployeeMarketTemplates`.
  - Step lists cover the ROADMAP statutory steps: PL (badania wstępne, PIT-2, PPK, IKE/IKZE · świadectwo pracy, ekwiwalent, ZUS ZWUA, PIT-11), DE (Personalfragebogen, Steuer-ID/ELStAM, SV-Ausweis, bAV · Arbeitszeugnis simple, Abmeldung SV, Lohnsteuerbescheinigung), UK (P45/P46, RTI, pension · P45, final RTI, pension, P11D), US (W-4, I-9+E-Verify, state W-4, direct-deposit · final paycheck, COBRA, W-2, 401k). Statutory steps carry `adviserVerify:true`; gov steps carry a `govStub` marker; cert steps a `certType` marker.
- **Idempotent boot upsert** (`upsert-on-boot.ts`): parent `workflowTemplate.upsert` keyed on `@@unique([organizationId, jurisdiction, type, seedKey])` with an empty `update` (never clobbers org edits); children created via `createMany` only when the template has none yet, so a re-run adds zero rows. Rows seed `status:'DRAFT'` + `appliesToEntityType:'EMPLOYEE'`. Markers ride `configJson` under non-`rules` keys (kept unconditional). Targets `WorkflowTemplate` — what `startRun` instantiates — NOT `WorkflowRoleTemplate`.
- **Boot-hook wiring** (`post-org-create-hook.ts`): `upsertEmployeeMarketTemplates` called alongside `upsertSeedTemplates` inside the existing fail-soft try/catch (logged, never re-thrown); the KT seed call is untouched. `@contractor-ops/employee-templates` added as an api workspace dep.

## Verification

- `pnpm --filter @contractor-ops/employee-templates test upsert-on-boot` → **GREEN** (4/4: 8-seed shape, first-run creates 8 templates + all children, second run adds zero, DRAFT/EMPLOYEE + no-clobber update).
- `pnpm --filter @contractor-ops/employee-templates typecheck` + `pnpm typecheck --filter=@contractor-ops/api` → green.

## Known constraint

Seed tasks use `assigneeMode:'ROLE_BASED'` with `assigneeRole: null`. The P89 HR roles (hr_admin/hr_manager/payroll_officer/leave_approver) are Better Auth org roles, not the Prisma `UserRole` enum that `WorkflowTaskTemplate.assigneeRole` accepts — so DRAFT templates materialize unassigned and the org assigns HR members when it reviews/activates. (Never CONTRACTOR_OWNER for employees.)

## v7.5 deferrals

Qualified (free-text) Arbeitszeugnis, P11D PDF, COBRA packet, 401(k) packet — noted as manual steps only; cert generation deferred.
