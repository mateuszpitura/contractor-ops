# Persistent Memory (cross-session invariants)

Facts that stay true across GSD phases. Update when architecture or policy changes — not for per-phase task lists (those live in `STATE.md`).

**Last updated:** 2026-06-10

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
- **Router counts:** verify `packages/api/src/root.ts` — **53** always-mounted namespaces + **8** classification when `module.classification-engine` (or `QA_DEFAULT_ORG_ID`)
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
