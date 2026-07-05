# 98-03 SUMMARY — scope taxonomy + read-only auth resources

**Wave:** 1 · **Status:** done

## What landed
- **Auth statement** (`packages/auth/src/permissions.ts`): two READ-only resources —
  `classification: ['read']`, `auditLog: ['read']` — so the public read gates
  `requirePermission({classification:['read']})` / `{auditLog:['read']}` compile.
- **Owner sync** (`packages/auth/src/roles.ts`): same two keys added to `allPermissions` (owner set)
  to preserve the owner-superset invariant. NOT granted to any of the 14 named roles (API-key + owner only).
- **Scope registry** (`packages/api/src/lib/scope-utils.ts`): `PUBLIC_API_SCOPES` widened from 4 read
  scopes to the full granular set — 9-entity reads (`payment:read`, `workflow:read`,
  `classification:read`, `auditLog:read` + the 4 existing) + 7-entity writes (`contractor:create/update`,
  `invoice:create/update`, `payment:create/update/export`, `workflow:create/update/execute`,
  `document:create/update`). `PublicApiScope` union auto-derives. Alphabetized.
- **Auth test sync** (3 enumeration/matrix assertions updated for the 2 new resources):
  `permissions.test.ts` expectedResources, `role-permission-matrix.test.ts` owner keys,
  `roles.test.ts` admin-vs-owner (classification/auditLog are owner-only, admin gets neither).

## Locked reconciliation (A1 / Pitfall 2)
The KEY carries granular `resource:action` strings (exactly what `permissionToScopes` emits). Plural
`entity:read|write` labels are Phase-99 scope-picker DISPLAY BUNDLES that expand to these — never on
the key. `workflowTask.transition` → `workflow:update`; `paymentRun.*` → `payment:*`;
`complianceDocument.*` → `document:*`. classifications + audit_log are READ-ONLY (no write action added).

## Write/read split
7 write entities: contractors, invoices, payments, payment_runs, workflows, workflow_tasks,
compliance_documents. classifications + audit_log read-only (INTEG-AUTH-02 + GTM classification-liability posture).

## BFLA tripwire
The canonical `WRITE_SCOPE_MATRIX` was pre-populated in 98-02; the scope-registry membership half of
`public-api-write-scope.security.test.ts` now turns GREEN (14 passed) — every required write scope is
a member of `PUBLIC_API_SCOPES`. Live 403 matrix stays HOLD-until-98-09.

## Verify
- `pnpm --filter @contractor-ops/auth test` — 280 passed. `pnpm typecheck` auth + api — clean.
- BFLA membership: 14 passed | 14 skipped.
