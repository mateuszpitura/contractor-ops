# Persistent Memory (cross-session invariants)

Facts that stay true across GSD phases. Update when architecture or policy changes — not for per-phase task lists (those live in `STATE.md`).

**Last updated:** 2026-07-01

## web-vite UI (current)

- **No `*-container.tsx`** under `apps/web-vite/src/` — wired section + `*View` in co-located files; route screens use `*PageContent` in `pages/**`
- **tRPC boundary** — only `components/{domain}/hooks/use-*.ts` (enforced by `pnpm check:web-vite-data-layer`)
- **`BillingTierGate`** — Stripe subscription tier (`billing/billing-tier-gate.tsx`); distinct from Unleash **`FeatureGate`** (`layout/feature-gate.tsx`)
- **Tests** — assert `*View` with stub props; mock wired import paths, not deleted containers

## API / integration patterns (2026-06)

- **`integrationProcedure`** — integration routers use factory (`packages/api/src/lib/integration-procedure.ts`)
- **`loadOrgIntegrationConnection`** — sole connection loader in integration routers; no inline `findFirst`
- **Integration RBAC** — zero plain `tenantProcedure` in `integrations/*`; teams reads on `integrationSettingsProcedure('read')`

## Money & finance

- **Money rounding** — integer minor units only; derived values round HALF-UP (`Math.round`); skonto discount FLOORS, statutory interest rounds HALF-UP on the accrued claim; never `parseFloat`-then-scale unvalidated money. See [[patterns/money-rounding]] (`.planning/brain/wiki/patterns/money-rounding.md`).

## Shared UI patterns

- **`useListDataTable`** — domain list hooks own sort/column/selection state; reports via `useReportTableState`
- **`EntitySummarySheet`** — side-panel shell (contractor, contract, invoice, payment-run, workflow, approval); `titleVisuallyHidden` + `loadingTitle` for skeleton a11y
- **`useDirection`** — RTL from locale (`ar`); EntitySummarySheet, WizardDialogShell, WorkbenchDataTable
- **Provider sections** — hook + skeleton + view in one `*-provider-section.tsx`

## Authority order

1. In-tree verification (`packages/api/src/root.ts`, `pnpm test`, `pnpm typecheck`)
2. `CLAUDE.md` + `.planning/PROJECT.md`
3. `.planning/codebase/*` maps (commit `70f5782d`)
4. `.planning/intel/*` query index
5. Phase SUMMARYs under `.planning/milestones/` (historical)
6. **Discard** stale session memory, cross-repo handoffs, unverified test counts

## Stack anchors

- **Monorepo:** pnpm 10 + Turborepo; Node 24; TypeScript ESM
- **Staff API:** Fastify `apps/api` → tRPC `appRouter` at `/api/trpc/*`
- **Portal API:** `portalAppRouter` at `/api/trpc/portal` — **not** in `appRouter` (TS inference cost)
- **Router counts:** verify `packages/api/src/root.ts` — **53** always-mounted namespaces + conditional spreads: **8** classification (`module.classification-engine`), **1** us-expansion `taxForm` (`module.us-expansion`), **2** workforce `worker`/`employee` (`module.workforce-employees`) — each also gated by `QA_DEFAULT_ORG_ID`
- **Web UI:** `apps/web-vite` — pages inline `*PageContent` or wired sections → Hook → Component; tRPC only in `hooks/`; **zero** `*-container.tsx` under `components/` (17C2)
- **Auth:** Better Auth `packages/auth`; tenant from session, never from client `organizationId` alone
- **DB:** Prisma 7, PostgreSQL 17; regional `DATABASE_URL_EU` / `_ME` (+ optional `_US`)
- **Flags:** `@contractor-ops/feature-flags` only — keys in `packages/feature-flags/src/registry.ts`

## Non-negotiable patterns

| Pattern | Where enforced |
|---------|----------------|
| `entityIdSchema` for single-entity inputs | `packages/validators/src/common-inputs.ts`, `lint:architecture` |
| `formatMoneyAmount` in web-vite | `apps/web-vite/src/lib/money.ts`, `lint:architecture` |
| No `@contractor-ops/db` in web-vite | `lint:architecture` |
| `writeAuditLog` on sensitive mutations | `packages/api/src/services/audit-writer.ts`, `lint:audit-log` |
| Zod on every tRPC procedure | `packages/api/src/init.ts` middleware stack |
| `semble search` before grep | `CLAUDE.md`, `.cursor/rules/` |
| Read before Edit on existing files | Cursor runtime guard |

## Product / legal

- **Core value:** Invoice → match → approval → payment with full audit trail
- **Current milestone:** v7.0 GTM Expansion (phases 82–101) — see `STATE.md`
- **Legal copy:** DEFERRED sign-off; locked phrases in `packages/validators/src/legal/` — do not duplicate in UI/CMS
- **Deploy posture:** LOCAL-ONLY until legal gates cleared

## Agent discovery commands

```bash
semble search "<behavior>"
node .claude/get-shit-done/bin/gsd-tools.cjs intel query <term>
node .claude/get-shit-done/bin/gsd-tools.cjs graphify query <term>
pnpm check:web-vite-data-layer
pnpm typecheck --filter=@contractor-ops/api
```

## Memory layers (agent stack)

| Layer | Path | Role |
|-------|------|------|
| Live code truth | semble + Read | Symbols, procedures |
| Brownfield snapshot | `.planning/codebase/*` | Structure, conventions (commit pinned) |
| Query index | `.planning/intel/*` | Fast JSON lookup |
| Call graph | `.planning/graphs/graph.json` | AST graphify (verify edges via semble) |
| Domain wiki | `.planning/brain/wiki/` | Why / flows / patterns — **not** symbol lookup |
| Cross-session invariants | This file | Policies that survive phases |

## Graphify note

AST-only extract from repo root: `graphify extract . --no-cluster --out .planning/graphs` (see `.graphifyignore`). Semantic LLM skipped — docs/images/md excluded. Venv: `.planning/.venv-graphify/` (local, not committed). User runs extract; copy `graphify-out/graph.json` when done.

## Wave 16A — workflows container collapse (2026-06-10)

Collapsed all **20** `workflows/` + `workflow/credentials-tab-container.tsx` passthrough/orchestrator files into View+wired exports or `*PageContent` route shells; **zero** workflow `*-container.tsx` remain under `components/workflows/` and `components/workflow/`.

## Wave 17C1 — zatca/admin/auth/peppol container collapse (2026-06-10)

Collapsed **26** `*-container.tsx` in `zatca/` (12), `admin/` (7), `auth/` (4), `peppol/` (3) — View+wired in co-located files; route orchestrators inlined as `*PageContent` in matching `pages/**`; **zero** containers remain in those four folders.

## KB enforcement — doc/graph freshness is gated, not advisory (2026-06-16)

The graphify + semble + wiki knowledge base is now enforced, not hoped for:
- **CI doc-drift gate** — `scripts/check-wiki-brain.mjs` fails when a source file under a wiki page's `verify_with` changes in the diff without that page being updated (NEW drift only, vs branch base; `ci.yml` ci job uses `fetch-depth: 0`). graph.json / BM25 absence downgraded to WARN (local gitignored artifacts).
- **Stop hook block-once** — `.claude/hooks/wiki-brain-inject.sh stop` emits `{"decision":"block"}` once (respects `stop_hook_active`) when `apps/`/`packages/` changed with no wiki update; also emits `GRAPH_WARN` if graph older than newest code commit.
- **Graph auto-rebuild** — `.husky/post-commit` runs incremental AST-only `graphify update` (LLM keys blanked) in background when a commit touches `apps/`/`packages/`.
- **Surfacing** — `core-values.yml` Tools/Workflow now routes graphify (call graph / blast radius) + "never assert project facts from memory"; semble wired in `.mcp.json` + new `.cursor/mcp.json` for Cursor parity.
- **Honest ceiling** — these force *hygiene + freshness*, not *semantic correctness*. No mechanism proves a wiki page is true or that an agent used a result well; an edit-accuracy eval (golden tasks) is the open follow-up.

## US W-form intake + treaty engine (Phase 85, 2026-06-16)

The W-9 / W-8BEN / W-8BEN-E surface captures (does not file) a US tax classification + resolves the treaty claim. Invariants that survive the phase:

- **One treaty engine, one table.** US treaty rows live in the shared `WithholdingTaxRate` table (`sourceCountry='US'`, nullable `treatyArticle` column; `serviceType` reused as the income-type axis = `'business_profits'`). The 4-field `@@unique([sourceCountry, contractorResidency, serviceType, effectiveFrom])` key is load-bearing — adding a 5th field breaks the seed upsert + `calculateWht` lookup. Rates are whole-number percent (30.0 / 0.0 / null). PL/DE/GB/IE/NL → 0% (Article 7); AE/SA have no US treaty → 30%. The same table feeds Phase 87's 1042-S withholding.
- **`TaxFormSubmission` is append-only + supersede-chained**, FK'd to `Contractor` (NOT `Worker` — that abstraction is Theme B/Phase 89). Re-cert flips the prior ACTIVE row to SUPERSEDED then inserts a new ACTIVE row in one `$transaction`; signed rows are never mutated, only DRAFT rows are.
- **Portal-primary self-cert.** The beneficial owner signs in the portal (`portalAppRouter`). ESIGN attestation (ip / actorId / signedAt) is 100% server-derived from the session + headers — the client schema omits all three; identity is unforgeable. The W-9 payload never carries a full SSN (last-4 reference only; the SSN stays in its encrypted column with the `contractorPii:read` reveal gate). `buildFormSnapshot` recursively strips full-SSN/TIN keys as a second guard.
- **Staff get a read/track mirror only** — never an on-behalf signing path (`requestTaxForm` writes an audit event, no record). The staff `taxForm` namespace is a DEDICATED router so `root.ts` can conditionally spread the whole US surface behind `module.us-expansion`; the always-mounted `taxRouter` is never extended for it. Defense-in-depth: boot-gate spread + per-request `assertUsExpansionEnabled` (the flat portal merge can't be conditionally spread, so it self-gates).
- **web-vite layering holds** — the wizard's only tRPC boundary is `hooks/use-tax-form-wizard.ts`; the container + steps + page are presentational (`check:web-vite-data-layer`). Treaty rate/article auto-populate is advisory display announced via `aria-live`; the authoritative resolution + persistence happen server-side.

## AuditLog is DB-level append-only (2026-06-17)

`AuditLog` is append-only enforced in Postgres, not just by convention (migration `20260617000000_auditlog_append_only`): a `BEFORE UPDATE` trigger (`app.reject_auditlog_update`) rejects **every** UPDATE unconditionally, and the RLS `auditlog_delete` policy permits a DELETE **only** inside a transaction that has called `allowAuditPurge(tx)` (`@contractor-ops/db` → `SET LOCAL app.allow_audit_purge='on'`, read by `app.audit_purge_allowed()`). The sole legitimate caller is the GDPR Right-to-Erasure path (`routers/compliance/gdpr.ts`); ordinary writers never set the flag, so their deletes are denied. The old over-broad `auditlog_write FOR ALL` policy was replaced by INSERT-only (`auditlog_insert`). To "correct" an audit row, supersede with a new INSERT — never UPDATE.

## Worker model abstraction (Phase 89, 2026-06-22)

`Worker` is the org-scoped identity root for the workforce union (contractors today, employees from Phase 90). Invariants that survive the phase:

- **Worker base table + one-time backfill.** `Worker` (`packages/db/prisma/schema/worker.prisma`) carries `organizationId` + `workerType WorkerType @default(CONTRACTOR)` + shared `displayName`/`email`/`status` + soft-delete; it is **tenant-owning and absent from `globalModels`** (so `withTenantScope` injects org scope — proven by `worker-tenant-isolation.test.ts`). `Contractor` links via a sidecar `workerId String @unique` 1:1 FK — **`Contractor.id` stays stable** so the 20+ FKs that reference it are never relinked (not a re-key). The link was populated by `packages/db/scripts/backfill-worker.ts`: idempotent (`WHERE workerId IS NULL`, re-run = no-op), reversible (`--rollback` nulls `workerId` then drops orphaned Workers; contractor rows untouched), per-region, audited (one system-actor `worker.backfill.apply` `AuditLog` row per org, written directly via Prisma since `db` sits below `api` in the dep graph — recorded against `ORGANIZATION` as `EntityType` has no `WORKER` member). Two-step migration ordering: Migration A (nullable column + table, additive) → backfill → Migration B (`SET NOT NULL` + FK, applied **LAST** after staging-parity sign-off — running B first rejects every null row). The `contractor.create` sites (`contractor-core.ts`, `import.ts`, `seed-dev.ts`) create+link a `Worker` atomically so new contractors are never orphaned.

- **Contractor reads are `workerType`-scoped by a central extension.** `withWorkerTypeDefault` (`packages/db/src/worker-type.ts`) is chained outermost in the tenant client (`withWorkerTypeDefault(withSoftDelete(withTenantScope(...)))`) and injects `workerType='CONTRACTOR'` on Worker reads **unless the caller passes an explicit `workerType`** (explicit-where-wins — the `worker`/`employee` routers do this to read cross-type). Its blind spot is raw SQL: the 4 known `$queryRaw` `FROM "Contractor"` sites (dashboard active-contractor count, command-palette FTS, two `contractor-shared` facet reads) are **contractor-only-by-table** and annotated `// contractor-only-raw-sql:`; `scripts/check-contractor-rawsql-workertype.ts` (wired into `lint:ci` after `lint:raw-sql`) fails any NEW unannotated raw `FROM "Contractor"` read. Per-type HR-only fields gate on a separate `employee` RBAC resource (4 HR roles, BFLA fence — never a contractor mutation, never auto-granted to `owner`); the whole `worker`/`employee` surface is dark behind `module.workforce-employees` via the three-layer flag-off. Detail: [[domains/worker-foundation]] (`.planning/brain/wiki/domains/worker-foundation.md`).

## US payment rail — payment run is the withholding source of truth (Phase 88, 2026-07-01)

The US payout rail is where the withholding that the tax-form surface only *reports* is actually *deducted*, and where the recorded payout figure becomes the truth the forms aggregate. Invariants that survive the phase:

- **The payment run is the single source of truth for the withheld amount.** The recorded `PaymentRunItem.whtAmountMinor` (written by `applyWithholdingToRun` in `packages/api/src/routers/finance/payment-shared.ts`) is authoritative; the 1099-NEC box-4 and 1042-S box-2 **aggregate the year's actual payment-run withholding — never recompute** the deduction in the forms. Withholding is a payment event: the form reflects what really moved. One HALF-UP round of `whtAmountMinor` at the rate, then `amountMinor = grossAmountMinor − whtAmountMinor` (integer gross/net invariant); the export file carries the net. See [[patterns/money-rounding]].

- **One jurisdiction-agnostic withholding path.** `applyWithholding` (pure, per item) covers SA WHT (unchanged `calculateWht`), US backup withholding 24% (IRC §3406, when `Contractor.backupWithholdingFlagged`), and the 1042-S treaty rate (`applyTreaty`, 30% statutory fallback). The SA branch is byte-preserved and regression-guarded; a US-domestic recipient / 0% treaty / non-withholding jurisdiction returns `null` (item untouched). `createBackupWithholdingFlagWriter` (`tin-match.service.ts`) persists the flag via a tenant-scoped idempotent `updateMany({ id, organizationId })` (boolean only — the TIN never reaches the write).

- **US export formats are hand-rolled and config-driven.** `generateNachaFile` is a hand-rolled zero-dependency NACHA ACH credit file (94-char 1/5/6/8/9 records, entry hash, balanced control totals, block padding, service class 220 + SEC PPD + txn 22 defaults — SEC/txn parameterizable); `generateFedwirePacs008` is an ISO 20022 `pacs.008.001.08` XML (not the retired FAIM flat file), the message handed to the bank. `detectUsFormat` routes USD + US bank → `ACH_NACHA`, above the Same-Day ACH ceiling → `FEDWIRE`; the ceiling is dated **config** (`sameDayAchCeilingMinor(asOf)`: $1M → $10M on 2027-09-17), never a constant. USD is a normal ECB currency — **no `USD=1.0` short-circuit** (it would mask a genuinely missing rate). Settlement FX (`payment-settlement.ts` `convertForSettlement`) is a single HALF-UP delegate to `convertAmount`; a missing rate throws `UNPROCESSABLE_CONTENT`, never a silently zeroed payout.

- **Programmatic ACH + live Plaid are mock-behind-seam, flag-dark; Plaid is advisory fail-open.** The GA path installs **zero external SDKs**. `payment.initiatePayout` (opt-in, `payment:export` + `assertUsExpansionEnabled` + `payments.ach-payouts` flag) originates via the `PayoutInitiationAdapter` (Modern Treasury deterministic mock default; live dark); it is idempotent (Upstash reserve/complete/clear — no double-pay) and masked-audited. The NACHA/Fedwire **file** export stays the always-available default. Plaid verification is advisory: the payout reads the persisted `PaymentRunItem.billingProfile.plaidVerificationStatus` via a tenant-scoped include (never `contractor.billingProfiles[]`); an unverified status warns + audits, never blocks. `payments.plaid-verification` gates ONLY the live Plaid client and is deliberately **non-gated** (not in the v7.0 cohort / signoff registry — the only gated payments prefix is `payments.ach-`). Detail: [[domains/us-payment-rail]] (`.planning/brain/wiki/domains/us-payment-rail.md`).

- **ACH return-code ingestion is the reachable path that flips a bounced payout back to FAILED.** The operator uploads the NACHA return file their bank produced via `payment.ingestAchReturnFile` (`payment-core.ts`, same gate as `initiatePayout`: `payment:export` + `assertUsExpansionEnabled`, applied before any parse/apply, `.strict()` Zod with a bounded `returnFileText`); it delegates to `parseNachaReturnFile` → `applyAchReturns` (`services/ach-return.service.ts`) and returns `{ failed, advisory, skipped, unmatched }` **verbatim**. R01/R02/R03 (+ R-family) → `PaymentRunItem.status='FAILED'` + reason; NOC/COR → advisory (no status change, never fails a payout); unrecognised non-correction code defaults to FAILED (fail-safe). Tenant-scoped + idempotent (an already-FAILED item is skipped, so a re-upload is a no-op and a return can never un-fail an item) + one masked audit row per transition plus an ingestion-summary `payment_run.ach_return_ingested` row (sizes + tallies only, no bank data, no raw file text). The `unmatched` count is the operator-safety signal: `unmatched > 0` distinguishes a mis-uploaded / wrong-run file (a foreign-org run flips nothing — every entry is unmatched) from a clean no-bounce run — never a silent zeros-everywhere no-op; a return-addenda file that parses to nothing is a `BAD_REQUEST` (`PAYMENT_ACH_RETURN_FILE_INVALID`). The live Modern Treasury return-webhook (`PayoutInitiationAdapter.handleWebhook`) is a documented deferred seam (programmatic ACH stays dark), so file upload is the only reachable return path. Detail: [[domains/us-payment-rail]] (`.planning/brain/wiki/domains/us-payment-rail.md`).

- **Plaid verification has a reachable mock write path; the tin-match backup-withholding writer is a recorded defer to Phase 86.** The onboarding write path is `payment.verifyBillingProfilePlaid` (`payment-core.ts`, same gate as `initiatePayout`: `payment:export` + `assertUsExpansionEnabled` + tenant-scoped `.strict()` Zod `billingProfileId`): it runs `MockPlaidIdentityClient.verify` against the profile's **masked** US routing/account + `contractor.legalName` and persists `ContractorBillingProfile.plaidVerificationStatus` + `plaidVerifiedAt` + `plaidAccountId`, so the payout advisory read now has a real non-null status. It is itself advisory fail-open — a non-VERIFIED result is written and returned as `{ status, advisoryWarning }`, never throws/blocks; a foreign-org profile is `NOT_FOUND` (never verified); masked audit `contractor_billing_profile.plaid_verified` (billingProfileId + status only). No Plaid SDK installed — the live Link flow stays flag-dark. Separately, the backup-withholding writer `createBackupWithholdingFlagWriter` / `createDbTinMatchPersistence` (`tin-match.service.ts`, which sets `Contractor.backupWithholdingFlagged` that `applyWithholding` already reads) exists and is correct but has **zero production callers by design** — the year-end IRS TIN-match batch that would trigger it is **owned by Phase 86**, not the Phase 88 payout rail. That is a documented defer (LOCAL-ONLY, no live year-end batch yet), recorded in the phase `deferred-items.md` — not a gap and not a silent omission. Detail: [[domains/us-payment-rail]] + [[integrations/plaid]].

## Employee registry — per-market national-ID PII boundary (Phase 90, 2026-07-01)

The employee registry onboards a `Worker(workerType='EMPLOYEE')` + a tenant-owning 1:1 `EmployeeProfile` (`packages/db/prisma/schema/employee.prisma`, `workerId String @unique` FK — there is **no standalone `Employee` table**). Invariants that survive the phase:

- **National-ID PII lives encrypted in dedicated columns, never in the JSON, with a distinct reveal permission.** PESEL / SSN / Iqama / Emirates-ID are stored as AES-256-GCM `*Encrypted` + masked `*Last4` column pairs on `EmployeeProfile` and are **never** placed in the `countryFields` JSON (each per-market schema in `packages/validators/src/employee-country-fields.ts` is `.strict()`, so any national-ID key is a parse error). The three non-SSN IDs encrypt with a dedicated `EMPLOYEE_PII_ENCRYPTION_KEY` (`packages/api/src/services/employee-pii-crypto.ts` `encryptPii`/`decryptPii`/`maskLast4`) for an independent blast radius; the US SSN reuses the existing `SSN_ENCRYPTION_KEY` + `ssn-crypto`. `register` (`employee:create`) `omit`s every `*Encrypted` column on its return; plaintext is exposed only through `revealPii`, a field-routed decrypt gated on the separate `employeePii:read` resource (owner/admin/hr_admin only) that writes an `employee.<field>.revealed` audit row and is mounted **staff-only** (never on `portalAppRouter`). Audit rows use `resourceType: 'ORGANIZATION'` (`EntityType` has no `EMPLOYEE`/`WORKER` member), `resourceId = EmployeeProfile.id`, `workerId` in metadata. Emirates-ID format is blocking but its checksum is **advisory** (`checksumAdvisory`, never throws). Tax/social IDs (Steuer-IdNr / SV-Nummer / NI / PAYE) are **not** encrypted — they are plaintext-but-RBAC-gated fields inside `countryFields`. Detail: [[domains/employee-registry]] (`.planning/brain/wiki/domains/employee-registry.md`).

- **Government code lists are seeded LOCAL-ONLY data, not live API calls; `EmployeeProfile` is tenant-owning.** The employee reference lists (ZUS oddziały, NFZ, urzędy skarbowe, Krankenkassen — `packages/validators/src/reference-data/*`) and ELStAM (`packages/api/src/services/elstam-stub.ts` `lookupElstam`) are versioned + source-cited + adviser-verify seed tables + a **no-network stub seam** — there is **no live government API** (LOCAL-ONLY posture). `EmployeeProfile` is tenant-owning (`organizationId`) and **absent from `globalModels`** so `withTenantScope` injects org scope on every read — proven by `employee-cross-org-leak.test.ts` (ORG_B never reads/mutates ORG_A's row). Two follow-ups are deferred: the additive `__employee_profile_additive` migration is authored but not applied to the live EU/ME/US databases, and the web-vite RBAC mirror (`use-permissions.ts` / `memberRoles`) does not yet grant `employee`/`employeePii` to the HR roles, so the Register + reveal controls fail closed (absent) until that surface is wired.
