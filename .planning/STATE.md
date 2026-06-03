---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Platform Maturity & Operational Hardening
status: executing
stopped_at: Completed 79-08-PLAN.md (Gulf 4-locale i18n; C10 GREEN at translation layer; Task 3 human-verify deferred to verifier)
last_updated: "2026-06-03T21:48:24.130Z"
last_activity: 2026-06-03 -- Phase 80 planning complete
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 83
  completed_plans: 79
  percent: 91
---

# Project State

## Blockers

### BLOCKER (2026-05-31): Phase 78 — CONCURRENT EXECUTOR detected; this resume stopped before 78-07 to avoid duplicate/colliding work

**Phase:** 80
**Workflow:** `gsd:execute-phase 78` (background resume) — TWO executor sessions ran this phase at the same time.

**What this resume verified + did (faithful, no redo):**

- 78-01..78-05: already COMPLETE at resume (code + tests + SUMMARYs committed). Verified Wave-2 adapter tests GREEN (33/33: entra 11, okta 10, github 12) + `@contractor-ops/integrations` typecheck clean. Did NOT touch.
- 78-06: a CONCURRENT executor session (separate live `claude` process) committed the full 78-06 wiring while this resume was mid-work — `4aa68ff4 feat`, `adfd4a9d test`, `a11bf9eb fix`, and `2c00e148 docs(78-06) SUMMARY`. Their work is correct: register-all registers Entra/Okta/GitHub in BOTH registries with keys `ENTRA`/`OKTA`/`GITHUB` (NOT `ENTRA_ID` — matches Prisma `DeprovisioningProvider` + `ImpactPreview` union), 3 PENDING flags `module.idp-deprovisioning-{entra,okta,github}`, 3 connection routers (`entra`/`okta`/`github` namespaces) + barrel + root mount, and the `deprovisioning` router extended to all 5 providers for the toggle table.
- This resume layered ONE scoped quality fix on top (commit `06f0a3ee`): the three routers' `setEnabled` signoff gate threw a bare `Error` (→ INTERNAL_SERVER_ERROR); changed to `TRPCError FORBIDDEN` with `DEPROVISIONING_PROVIDER_SIGNOFF_PENDING`, and raised the connection-router test suite timeout to 20s (heavy appRouter import on cold fork worker). Verified: API typecheck clean, `idp-deprovision-connections.test.ts` 15/15 GREEN, `idp-provider-enable.test.ts` 5/5 GREEN (no regression).

**Schema constraint found (carried forward for any 78-06/78-07 follow-up):** the Prisma `IntegrationProvider` enum has `GITHUB` + `MICROSOFT_365` but NO `ENTRA` / `OKTA` values, so `IntegrationConnection` rows for Entra/Okta cannot be stored without a schema migration (out of 78-06 scope). The per-org enable toggle therefore lives in `Organization.settingsJson.idpDeprovisioningEnabled` (Phase 77 D-15 shape) keyed by the `DeprovisioningProvider` string — works for all 5 without schema change. `getProviderToggleState` derives ENTRA/OKTA `connected` from settings only (documented inline in `deprovisioning.ts`). Full per-provider credential storage + `idp-token-resolver`/`idp-impact-preview` extension for Entra/Okta is DEFERRED (needs the enum + connection-row migration).

**Why stopped (per execute-phase blocker rule):** Only 78-07 (web-vite UI: 3 provider cards + per-provider compliance toggle table, 14 files) remains. The concurrent executor already began 78-07 web-vite work (`a11bf9eb` touched `apps/web-vite` ToggleProvider). Two executors writing the same 14 web-vite files would collide destructively. The other session owns the remaining plan and is the live driver. This resume hands off cleanly rather than racing.

**Next-resume guidance:** Confirm only ONE executor is active before resuming 78-07. Check `git log --grep=78-07` + `ls .planning/phases/78-*/78-07-SUMMARY.md`; if the other session finished it, run phase verification only. 78-07 must follow `apps/web-vite/ARCHITECTURE.md` (Page→Container→Hook→Component), extend the existing `provider-connection-card` + `getProviderToggleState`/`enableProviderForOrg` (5 providers now), i18n en/de/pl/ar parity, loading/empty/error states, WCAG.

### DEFERRED REFACTOR (2026-06-01): Consolidate per-provider connection routers (78 WR-1, FIX F)

The three per-provider connection routers (`packages/api/src/routers/integrations/entra.ts`,
`okta.ts`, `github.ts`) are near-verbatim copies of each other and duplicate the logic already
in `deprovisioning.enableProviderForOrg` / `getProviderToggleState`. The Phase 76/77/78 review
(78 WR-1) flagged this as the primary DRY debt in the phase.

**Why deferred:** The web-vite UI (`apps/web-vite/src/components/integrations/hooks/`) calls
`trpc.entra.getStatus`, `trpc.entra.setEnabled`, `trpc.okta.*`, and `trpc.github.*` in three
separate hook files. Consolidating into a single parameterized procedure (e.g.
`trpc.deprovisioning.getProviderConnectionStatus({ provider })` / `.enableProviderForOrg`) would
require updating those 3 hook files, changing query-key invalidation, and a coordinated UI +
API change — too wide a surface to do safely as an atomic post-review fix. The correctness fixes
(transaction wrapping WR-5, cache invalidation WR-4) have already been applied to all 4 entry
points in commit `170be7bc`.

**Suggested follow-up:** In a dedicated refactor phase, delete the 3 per-provider routers, update
the 3 web-vite hooks to call `trpc.deprovisioning.enableProviderForOrg({ provider, enabled })` /
`getProviderToggleState` (already wired for all 5 providers), and consolidate `getStatus` into
`getProviderToggleState`. The toggle-table and provider-card UI then share one cache entry per org.

### RESOLVED (2026-05-31): Phase 73 RE-PLANNED against `apps/web-vite` — the `apps/web` drift blocker below is cleared; 8 plans regenerated/corrected, all gates pass

**Resolution (`gsd:plan-phase 73 --auto`, background re-plan):** All 8 PLAN.md regenerated/corrected for the current tree. Subagent spawning was unavailable in the background runtime (same as Phase 77 RESOLVED note), so the orchestrator performed researcher/planner/checker roles inline against the live tree (paths verified via semble + Read). Outcome:

- **CONTEXT.md + RESEARCH.md + PATTERNS.md + VALIDATION.md** refreshed with re-plan banners + authoritative `<web_vite_binding>`/`<phase72_binding>`/`<ar_parity_amendment>` blocks (verified live paths).
- **Faithful backend (light-touch):** 73-03 (auth + override/audit-trail) unchanged-faithful; 73-04 (validators locked-phrase + parity) amended for **ar parity** (en+pl+de+ar; was "ar=Phase 79"); 73-05 fixed `createServiceLogger`→`createLogger({ service })`.
- **73-02 (schema, `autonomous: false`):** kept as a FLAG but SOFTENED — multi-region apply (`pnpm db:migrate:all` via `migrate-all-regions.ts`, NOT `push-all-regions.ts`) is a DEFERRED post-deploy item under LOCAL-ONLY (Phase 70/74/76 precedent), NOT a hard gate; downstream Wave 2 runs against a local `prisma db push`. Removed the "Wave 2/3 MUST NOT land" hard-block.
- **Regenerated UI vs `apps/web-vite`:** 73-01 (UI RED scaffold tasks 07/08/09 → web-vite container/view paths + `--filter @contractor-ops/web-vite`); 73-06 (admin dashboard — Page→Container→Hook→Component, canonical DataTable, payment-block-modal D-10 reuse, 60s polling, drilldown Link); 73-07 (portal — SPLIT backend `portal.complianceItems` + `submitUploadReplacement` from web-vite UI); 73-08 (compliance-tab UX — SPLIT backend approve/reject + notification types + `compliance-portal-self-service` PENDING flag from web-vite override/history/upload-review UI).
- Bound to SHIPPED Phase 72 (commits 72-01..72-08): `compliance-payment-gate.ts` `assertContractorPaymentEligibility`, `compliance-reminder-scan.ts`, `payment-export-compliance-snapshot.ts`; router namespace is `classification` (UI calls `trpc.classification.*`, not `trpc.compliance.*`); cron lives in `apps/cron-worker/.../reminders`.
- **Gates:** requirements coverage 3/3 (COMPL-01/04/11); decision coverage 17/17 (D-01..D-17); no stale `apps/web`/`[locale]`/next-intl/`push-all-regions`/`trpc.compliance.`/`@/i18n` references remain in any PLAN. Wave graph 0→1→2→3, deps valid.

**Next:** `/gsd:execute-phase 73` (confirm only ONE executor active first; shared tree). 73-02 stays `autonomous: false` — its DEFERRED multi-region apply is recorded for post-deploy, not a blocker.

<details><summary>Original blocker note (stale — kept for history)</summary>

### BLOCKER (2026-05-31): Phase 73 execute-phase HALTED — UI plans (3 of 8) + UI test scaffolds target the deleted `apps/web` (Next.js); need re-plan against `apps/web-vite`

**Phase:** 73 (F1 Compliance — Admin Dashboard + Portal Self-Service + i18n)
**Workflow:** `gsd:execute-phase 73` (autonomous background run)
**Status:** Ready to execute

**Why halted (per execute-phase rule "if drift is so deep a plan can't be faithfully executed, write specifics to STATE.md as a blocker and stop rather than guessing"):**

The 8 plans were authored 2026-04-27 against the Next.js `apps/web` app, which has since been **removed on this branch** (`audit/post-migration-parity`). The current UI app is `apps/web-vite` (React + Vite SPA) with a fundamentally different architecture. This is the same drift class already recorded for Phases 76/77 in this STATE.md. Verified against the live tree:

- **No `@contractor-ops/web` package exists** — only `@contractor-ops/web-vite`. Every UI plan's commands (`pnpm --filter @contractor-ops/web test|typecheck`) target a nonexistent package and would fail immediately.
- `apps/web/` directory is **gone**. All UI plan `files_modified` paths (`apps/web/src/app/[locale]/(dashboard|portal)/...`, `apps/web/src/components/...`, `apps/web/messages/{en,pl,de}.json`) are dead.
- UI plans assume **Next.js 15 server components** (`setRequestLocale`, `getTranslations`, `generateMetadata`, `[locale]` route groups, `redirect from next/navigation`) and **next-intl** (`useTranslations`/`Link`/`useRouter` from `@/i18n/navigation`). `apps/web-vite` uses: custom `useTranslations` (`apps/web-vite/src/i18n/useTranslations.ts`), TanStack Router (no `[locale]` groups, no server components), Page→Container→Hook→Component layering (`apps/web-vite/ARCHITECTURE.md`), and i18n catalogs at `apps/web-vite/messages/{en,de,pl,ar}.json` (note: **ar** is required by the i18n:parity guard peers `[de, pl, ar]`; plans only mention en/pl/de).
- Adapting these is a **rewrite, not a path rename** (server→SPA, next-intl→custom i18n, route model, +ar locale) = re-planning, not execution.

**Second, independent blocker — `autonomous: false` manual-ops gate cannot be satisfied in a background run:**

- Plan **73-02** (DB schema) is `autonomous: false`. Its verification mandates a manual post-merge step: `npx tsx packages/db/scripts/push-all-regions.ts` against BOTH EU + ME regions, and states *"Downstream Wave 2 / Wave 3 plans MUST NOT land until this manual step is confirmed complete."* No human is present to run/confirm multi-region apply, so Wave 2 backend plans (73-03/73-05) that write to the new `waivedReasonCategory`/`waivedReasonNote` columns + `PENDING_REVIEW` enum value would be landing against an unconfirmed schema.

**Plan-by-plan triage (verified anchors):**

| Plan | Wave | Verdict | Notes |
|------|------|---------|-------|
| 73-01 | 0 | PARTIAL | Backend RED scaffolds (tasks 01-06, 10 → api/compliance-policy/validators/auth) are faithful — anchors exist. UI scaffolds (07/08/09 → `apps/web/...`, `--filter @contractor-ops/web`) are DEAD. |
| 73-02 | 1 | FAITHFUL but `autonomous:false` | `packages/db/prisma/schema/{contractor,contract}.prisma` exist; additive migration + 4 schema tests OK. Blocked on manual multi-region apply (see above). |
| 73-03 | 2 | FAITHFUL | `packages/auth/src/{permissions,roles}.ts` + `packages/api/src/routers/compliance/classification.ts` (exports `classificationRouter`, mounted via `routers/compliance/index.ts`) all exist. Override mutation + audit-trail query land cleanly. |
| 73-04 | 1 | FAITHFUL | `packages/validators/src/legal/{gb,de,signoff-registry.json}` + `packages/compliance-policy/src/policies/{uk,de,pl,ksa,uae}.ts` exist. COMPL-11 locked-phrase registry + parity guard fully executable. |
| 73-05 | 2 | FAITHFUL | `packages/api/src/services/{compliance-payment-gate,compliance-supersession}.ts` + `packages/compliance-policy/src/{expiry,types,registry}.ts` exist. Dashboard query helpers + `defaultExpiryFromUploadDate` + expirySemantic backfill all executable. |
| 73-06 | 3 | DEAD | Admin `/compliance/dashboard` route — full Next.js server-component + next-intl rewrite required for `apps/web-vite`. |
| 73-07 | 3 | DEAD (UI) / mixed | Portal surface. Backend bits (`portal.complianceItems` query, `compliance.submitUploadReplacement`) are faithful, but the plan structures them around dead UI + their own RED scaffold (73-01-03) and dead `apps/web` paths in `files_modified`. |
| 73-08 | 4 | DEAD (UI) / mixed | Compliance-tab UX. Backend bits (`approve/rejectUploadReplacement`, notification types, feature-flags entry) faithful, but plan mixes them with `apps/web-vite` component rewrites + dead test scaffolds in one wave. |

**Recommended remediation (pick one, then re-run execute-phase 73):**

1. **Re-plan the phase** (`gsd:plan-phase 73`) against the current tree: anchor all UI to `apps/web-vite` (Page→Container→Hook→Component per `apps/web-vite/ARCHITECTURE.md`), swap next-intl → `apps/web-vite/src/i18n/useTranslations.ts`, TanStack Router routes (no `[locale]`), i18n catalogs `apps/web-vite/messages/{en,de,pl,ar}.json` (+ ar parity), and `--filter @contractor-ops/web-vite`. Split the mixed backend/UI plans (73-07/73-08) so backend mutations land in their own wave. Decide how to satisfy 73-02's multi-region apply in this environment (or mark it a tracked manual checkpoint).
2. **Scope-reduce to backend-only** for this run: a re-plan could carve 73-01(backend)+73-02+73-03+73-04+73-05 into a "Phase 73a — COMPL data/permission/i18n foundation" and defer all UI to a re-planned "Phase 73b". This delivers COMPL-11 fully + COMPL-01/COMPL-04 data layer without guessing UI. Still needs the 73-02 manual-apply decision.

No `--gaps-only`/`--wave`/`--interactive` flags were passed; standard full-phase flow was attempted. CONTEXT.md (`73-CONTEXT.md`, gathered 2026-04-27) is itself written entirely against `apps/web` and needs refresh before/with re-planning.

</details>

---

### RESOLVED (2026-05-31): Phase 77 plan-phase — GSD tooling break (missing model-catalog.json) no longer reproduces

**Phase:** 78
**Workflow:** `gsd:plan-phase 77 --auto`
**Resolution:** `gsd-sdk query init.plan-phase 77` and `roadmap.get-phase 77` now return valid JSON in this environment — the `model-catalog.json` crash no longer reproduces. plan-phase 77 ran end-to-end; RESEARCH.md, VALIDATION.md, PATTERNS.md and PLAN.md files were generated. NOTE: subagent (`gsd-phase-researcher` / `gsd-planner` / `gsd-plan-checker`) spawning was unavailable in the background-agent runtime, so the orchestrator performed those roles inline against the live tree (verified paths via semble + Read). Two upstream caveats recorded in 77-RESEARCH.md: (a) Phase 76 is PLANNED but NOT executed — of its infra exists yet, so Phase 77 plans treat it as an upstream dependency; (b) Phase 76 plans + 77-CONTEXT.md reference the now-deleted `apps/web` (Next.js) — Phase 77 anchors all server routes to `apps/api` Fastify routes and all UI to `apps/web-vite` (Page→Container→Hook→Component).

<details><summary>Original blocker note (stale — kept for history)</summary>

**Status (original):** Executing Phase 75

**What happened:**

`gsd:plan-phase 77 --auto` could not start. Step 1 (Initialize) runs `gsd-sdk query init.plan-phase 77` plus follow-up `gsd-sdk query` calls (agent-skills, config-get). Two failures:

1. **`gsd-sdk` is not on PATH** — not a binary, npm global, shell alias, or function (checked PATH, `~/.config/zsh/`, `~/.zshrc`, npm `-g`).
2. **The fallback `gsd-tools.cjs` crashes at module load** — identical signature to the Phase 75 / 78 blockers:

```
Error: Cannot find module '/Users/mateusz.pitura/.claude/sdk/shared/model-catalog.json'
Require stack:

- ~/.claude/get-shit-done/bin/lib/model-catalog.cjs
- ~/.claude/get-shit-done/bin/lib/model-profiles.cjs
- ~/.claude/get-shit-done/bin/lib/core.cjs
- ~/.claude/get-shit-done/bin/gsd-tools.cjs

```

**Root cause (same as Phase 75 / 78):**

- `bin/lib/model-catalog.cjs` line 4 does `require(path.join(__dirname,'..','..','..','sdk','shared','model-catalog.json'))` → `~/.claude/sdk/shared/model-catalog.json`.
- The entire `~/.claude/sdk/` directory is absent; `find ~/.claude -iname 'model-catalog*'` returns only the `.cjs`. `gsd-file-manifest.json` lists the `.cjs` but no `sdk/` entry — the installed GSD package (VERSION 1.41.1, files dated 10 May) shipped a `.cjs` requiring a data file the installer never placed.
- `core.cjs` transitively requires this chain, so it fails for *every* query verb (confirmed: `init.plan-phase` crashes identically).

**Why this is a hard blocker (not worked around):**

The entire plan-phase pipeline routes through `gsd-sdk query`: init context + model selection, research/nyquist/pattern-mapper/UI-gate/schema-push config reads, validation-strategy creation, decision/requirements coverage gates, `state.planned-phase`, `roadmap.annotate-dependencies`, and `commit`. Hand-rolling these bypasses the workflow's state-integrity guarantees and risks corrupting STATE.md / ROADMAP.md / REQUIREMENTS.md tracking. Per execution policy, environment/access failures are surfaced as blockers rather than silently worked around.

**To unblock — pick one of:**

1. **Restore the missing SDK asset (recommended):** Repair the GSD install so `~/.claude/sdk/shared/model-catalog.json` exists (re-run the GSD installer/updater, or `/gsd-update`), and confirm `gsd-sdk` lands on PATH.
2. **Place the file manually** at `~/.claude/sdk/shared/model-catalog.json` (must contain keys: `profiles`, `phaseTypes`, `adaptiveTierMap`, `agents`).
3. After either fix, confirm with `node ~/.claude/get-shit-done/bin/gsd-tools.cjs query find-phase 77` returning JSON, then re-run `gsd:plan-phase 77 --auto`.

**No `.planning/` files were modified** beyond this blocker note. Phase 77 CONTEXT.md and DISCUSSION-LOG.md remain intact and ready for planning once the tooling is repaired.

</details>

---
- Phase 75-08 — e-sign IP-ratification signing + webhook atomic flow DEFERRED (not faithfully executable against current tree). DONE in 75-08: 6 IP-ratification templates; HealthCheckPanel (web-vite presentational + use-health-check-panel hook + container); CredentialsTab + CredentialAddDialog + container (use-credentials-tab hook); PendingCredentialsWarningDialog; IpVerificationEsignButton (presentational); i18n keys en/de/pl/ar; health-check-panel.test 7 GREEN; esign-webhook-ip-ratification.test 2 GREEN + 7 todo. DEFERRED (75-08-04 startIpRatificationSigning + 75-08-05 webhook atomic flow): (1) real e-sign entry is esign-orchestrator.sendForSignature requiring an existing Document(storageKey PDF in R2)+connectionId+signers, NOT a raw template string — no template->PDF->R2 render pipeline exists; (2) SigningEnvelope has NO documentType/metadata column (esign.prisma) — IP_RATIFICATION webhook detection needs a schema column+migration the plan only hand-waves; (3) the materialiseFromPolicy carry-forward to flip ContractorComplianceItem->SATISFIED is not the real helper signature. To unblock (follow-up slice): add SigningEnvelope.documentType+metadataJson + migration; build template->PDF->R2->Document step so startIpRatificationSigning can call sendForSignature; extend apps/api/src/routes/webhooks/process.ts e-sign branch (handleSigningCompletion already there) to detect IP_RATIFICATION and run the atomic 3-step tx + workflow.ip_verification.signed audit. IpVerificationEsignButton is presentational+wired-by-prop, ready for its container/hook once the mutation lands. NOT a tooling failure (gsd-sdk works) — plan-vs-reality drift requiring schema+render-pipeline work outside the plan's concrete spec; surfaced per policy.
- [DEFERRED post-deploy] Phase 72 multi-region migration apply — run `pnpm --filter @contractor-ops/db db:migrate:all` (3 additive migrations: 20260531170000/170001/170002_phase72_*) per region after merge. LOCAL-ONLY constraint; not a phase blocker. Shared dev DB also needs phase75/phase76 applied first (concurrent session owns those).

### BLOCKER (2026-05-31): Phase 78 plan-phase aborted — same GSD tooling break (missing model-catalog.json)

**Phase:** 78 — F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator)
**Workflow:** `gsd:plan-phase 78 --auto`
**Status:** Ready to plan

**What happened:** Identical root cause to the Phase 75 blocker below. `gsd:plan-phase` step 1 (`gsd-sdk query init.plan-phase 78`) crashes at module load:

```
Error: Cannot find module '/Users/mateusz.pitura/.claude/sdk/shared/model-catalog.json'
Require stack:

- ~/.claude/get-shit-done/bin/lib/model-catalog.cjs
- ~/.claude/get-shit-done/bin/lib/model-profiles.cjs
- ~/.claude/get-shit-done/bin/lib/core.cjs
- ~/.claude/get-shit-done/bin/gsd-tools.cjs

```

`~/.claude/sdk/` is still entirely absent; `find ~/.claude -name 'model-catalog*.json'` still returns nothing. GSD VERSION still 1.41.1. Confirmed `query init.plan-phase` and `query config-get` both crash identically.

**Why this is a hard blocker (not worked around):** plan-phase depends on `gsd-sdk` for init context + agent model assignment, phase validation (`roadmap.get-phase`), MVP/security/UI/schema gates, Nyquist VALIDATION.md creation, planner/checker subagent model selection, requirement & decision coverage gates (`check.decision-coverage-plan`), `state.planned-phase`, `roadmap.annotate-dependencies`, and `commit`. Hand-rolling these bypasses the workflow's correctness and STATE.md/ROADMAP.md integrity guarantees. Per policy, environment failures are surfaced, not worked around.

**To unblock:** same fix as the Phase 75 blocker below — restore `~/.claude/sdk/shared/model-catalog.json` (re-run the GSD installer/`/gsd-update`, or place the file from the GSD package; required keys: `profiles`, `phaseTypes`, `adaptiveTierMap`, `agents`). Verify with `node ~/.claude/get-shit-done/bin/gsd-tools.cjs query roadmap.get-phase 78` returning JSON, then re-run `gsd:plan-phase 78 --auto`.

**No phase 78 planning artifacts were created or modified** (no RESEARCH.md, VALIDATION.md, PLAN.md). `78-CONTEXT.md` and `78-DISCUSSION-LOG.md` remain intact. No subagents were spawned. Only this blocker note was added to STATE.md.

---

### BLOCKER (2026-05-31): Phase 75 execution aborted — GSD tooling broken (missing model-catalog.json)

**Phase:** 75 — F4 Offboarding — Contract Health Check + IP Verification + Credential Vault
**Workflow:** `gsd:execute-phase 75`
**Status:** Ready to execute (8 plans present, none executed — no SUMMARY.md files), but BLOCKED on environment.

**What happened:**

`gsd:execute-phase 75` could not start. The workflow's first action is to load init context via the GSD SDK CLI (`gsd-sdk query init.execute-phase 75`). That CLI is the `gsd-tools.cjs` script at `~/.claude/get-shit-done/bin/gsd-tools.cjs` (GSD VERSION 1.41.1). **Every** `gsd-tools.cjs query ...` invocation crashes at module-load time:

```
Error: Cannot find module '/Users/mateusz.pitura/.claude/sdk/shared/model-catalog.json'
Require stack:

- ~/.claude/get-shit-done/bin/lib/model-catalog.cjs
- ~/.claude/get-shit-done/bin/lib/model-profiles.cjs
- ~/.claude/get-shit-done/bin/lib/core.cjs
- ~/.claude/get-shit-done/bin/gsd-tools.cjs

```

**Root cause:**

- `bin/lib/model-catalog.cjs` line 4 does `require(path.join(__dirname,'..','..','..','sdk','shared','model-catalog.json'))`, resolving to `~/.claude/sdk/shared/model-catalog.json`.
- That file does not exist. The entire `~/.claude/sdk/` directory is absent (`ls ~/.claude/sdk` → No such file or directory).
- `find ~/.claude -name 'model-catalog*.json'` returns nothing — there is no copy anywhere to symlink or point at.
- `core.cjs` transitively requires this chain, so it fails for *all* query verbs, not just model-resolution ones (confirmed: `init.execute-phase`, `find-phase`, `config-get` all crash identically).

**Why this is a hard blocker (not worked around):**

The execute-phase pipeline depends on `gsd-tools.cjs` for: init context + model/parallelization/branching config, `phase-plan-index` (wave grouping + files_modified overlap), `state.begin-phase`, per-plan worktree gate, `roadmap.update-plan-progress`, `commit`, `verify.key-links` / `verify.schema-drift`, `phase.complete`, and learnings/todo closing. Hand-rolling all of this would bypass the workflow's correctness and state-integrity guarantees and risks corrupting STATE.md / ROADMAP.md / REQUIREMENTS.md tracking. Per execution policy, environment/access failures are surfaced as blockers rather than worked around.

**To unblock — pick one of:**

1. **Restore the missing SDK asset (recommended):** Reinstall / repair the GSD install so `~/.claude/sdk/shared/model-catalog.json` exists (e.g. re-run the GSD updater/installer, or `/gsd-update`). The package that ships `bin/lib/model-catalog.cjs` should also ship the `sdk/shared/model-catalog.json` it requires — verify the install copied the `sdk/` tree.
2. **Locate the file from the GSD source/package** and place it at `~/.claude/sdk/shared/model-catalog.json` (must contain keys: `profiles`, `phaseTypes`, `adaptiveTierMap`, `agents`).
3. After either fix, confirm with `node ~/.claude/get-shit-done/bin/gsd-tools.cjs query find-phase 75` returning JSON, then re-run `gsd:execute-phase 75`.

**No `.planning/` plan files were modified** beyond this blocker note. No phase 75 commits exist; `state.begin-phase` was never called (CLI is down). Phase 75 plans, CONTEXT.md, RESEARCH.md, VALIDATION.md remain intact and ready.

---

### BLOCKER (2026-04-27): Phase 72 execution aborted — dirty working tree

**Phase:** 72 — F1 Compliance — Reminder Cascade + Payment Block
**Workflow:** `gsd:execute-phase 72`
**Status:** Ready to execute

**What happened:**

`gsd:execute-phase 72` started, parsed init successfully (8 plans across 3 waves, parallel + worktree mode, all `incomplete`), and then performed pre-flight checks. The working tree was found to contain **279 uncommitted changes** (263 modified files + 16 untracked paths) from prior unrelated work — including a refactor that directly collides with Plan 72-08's target file.

**Concrete collision (hard blocker):**

- `apps/web/src/app/api/cron/reminders/route.ts` is in `git status` as `M` AND is listed in Plan 72-08 `files_modified`.
- The uncommitted change in `route.ts` deletes the inline `detectDrvClearanceExpiries` function and replaces it with `import { detectDrvClearanceExpiries } from './drv-clearance-expiries';` — a real refactor.
- Two new untracked files back this refactor: `apps/web/src/app/api/cron/reminders/drv-clearance-expiries.ts` and `apps/web/src/app/api/cron/reminders/reminders-shared.ts`.
- Worktree-isolated executors clone HEAD, so they would NOT see this refactor and would re-introduce the deleted code in their own commit. Subsequent worktree merge-back would either drop the refactor or generate complex conflicts. Either outcome corrupts both the refactor and Plan 72-08.

**Other dirty surfaces (soft blockers — broad collision risk):**

- 263 modified files spanning `apps/web`, `apps/landing`, `apps/public-api`, `packages/api`, `packages/db`, `packages/validators`, `scripts/`, plus configs (`next.config.ts`, multiple `package.json`, `biome.ci.json`).
- 16 untracked paths including new `packages/api/src/routers/{compliance,core,equipment,finance,integrations,portal,workflow}/index.ts` (a router-restructure refactor in progress).
- These overlap conceptually with Phase 72's API/router/payment surfaces even where filenames don't match exactly. Spawning 8 plan agents on top of this state is unsafe.

**No `.planning/` files are dirty** — the conflict is purely in production source.

**No phase 72 commits exist** — STATE.md was NOT updated to "Active Phase 72" yet, and `state.begin-phase` was deliberately not called. The phase 72 plans, CONTEXT.md, RESEARCH.md, PATTERNS.md, VALIDATION.md remain untouched and ready.

**To unblock — pick one of:**

1. **Commit the in-flight refactor** (recommended if it represents real, intentional work):
   - `git status` → review the 279 changes
   - Stage and commit them as one or more atomic refactor commits on `main`
   - Then re-run `gsd:execute-phase 72`
2. **Stash if the refactor is exploratory:**
   - `git stash push -u -m "pre-phase-72 refactor in-flight"` (note: `-u` to include the 16 untracked files)
   - Run `gsd:execute-phase 72`
   - Restore with `git stash pop` afterwards (expect conflicts on `route.ts` — Plan 72-08 will have rewritten it)
3. **Discard if the changes are debris** (DESTRUCTIVE — only if certain):
   - `git restore .` and `git clean -fd` — manager / user must explicitly authorise this
   - Then re-run `gsd:execute-phase 72`

**Concurrency note:** A background agent for Phase 73 planning may be running in parallel. It should not be touching production source files (read-only on Phase 72 surfaces, write-only on `.planning/phases/73-*`), so it is unlikely to be the source of the dirty tree. The dirty changes pre-date this `gsd:execute-phase 72` invocation (uncommitted before STATE.md was last updated at 13:57 today).

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-26 — v6.0 milestone started)

**Core value:** The invoice-to-payment flow must work end-to-end: invoice arrives, gets matched to contract, routed through approval, and batched for payment — with full audit trail.
**Current focus:** Phase 80 — v6 0 verification hardening manual uat

## Current Position

Phase: 79 (f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-) — EXECUTING
Plan: Not started
Status: Ready to execute
Last activity: 2026-06-03 -- Phase 80 planning complete

Progress: [██████████] 100%

**Active Phase:** none (Phase 70 closed)
**Next Phase candidates (parallel-ready):**

- Phase 71 (F1 Compliance — Policy Package + Schema + Classification Reconcile) — 7 plans, depends on 70 ✓
- Phase 76 (F2 IdP — Capability Mixin + Saga + Cooldown + GWS Scope) — 10 plans, depends on 70 ✓ + 74 + 75 (still gated on F4)
- Phase 74 (F4 Offboarding — Workflow Foundation + KT Templates + Override Permission) — discussed, ready for `/gsd-plan-phase 74`

## Phase 76 Planned (2026-04-27)

10 plans across 4 waves; 1 marked `autonomous: false` (Plan 76-02 schema migration — multi-region apply per Plan 70-09 precedent):

| Wave | Plan | Title | autonomous | Requirements |
|------|------|-------|------------|--------------|
| 0 | 76-01 | Failing test scaffolds (19 RED) + new `@contractor-ops/idp-saga` package skeleton + `idp-deprovisioning` PENDING signoff entry | true | All 8 (RED state) |
| 1 | 76-02 | Prisma schema — DeprovisioningRun + DeprovisioningStep + IdpChangeProvenance + ContractorAssignment.endedAt + multi-region usage docs | **false** | IDP-02, 09, 10, 13 |
| 1 | 76-03 | Deprovisionable interface + GWS scope-registry typed-const + IDP_AUDIT_ALLOWED_FIELDS extension (8 new fields) + adapter registry mapping | true | IDP-08, 10, 14 |
| 1 | 76-04 | Saga helpers — canStartDeprovisioning (TZDate via `@date-fns/tz`, reuses Phase 71 D-07 pin) + deriveRunStatus pure function + recomputeRunStatus + provenanceLookup atomic claim + insertProvenance + gcExpiredProvenance | true | IDP-02, 09, 13 |
| 1 | 76-05 | tRPC `getDeprovisioningEligibility` query + audit-log on every call (single-source-of-truth helper consumed by both UI and server-side mutation) | true | IDP-02, 10 |
| 2 | 76-06 | tRPC `startDeprovisioningRun` + `retryDeprovisioningStep` mutations + QStash fan-out + `_step-runner` API route + saga-canonicalize helper for SHA-256 hashes | true | IDP-09, 10 |
| 2 | 76-07 | `pnpm lint:scopes` CI guard (4th sibling in `@contractor-ops/lint-guards`) + ts-morph drift detector + structured-diff format-offence + husky pre-push + CI workflow extension | true | IDP-14 |
| 2 | 76-08 | GWS scope-upgrade flow — additive `getOAuthConfig().scopes` + `prompt=consent` + 3-state reconnect banner (write-access variant) + i18n keys (en/de/pl/ar) + OAuth callback writes `directory.user.write` capability | true | IDP-11 |
| 3 | 76-09 | `GoogleWorkspaceAdapter implements Deprovisionable` — suspendAccount + revokeAllSessions + verifyDeprovisioned + handleWebhook provenance lookup + register-all wires registerDeprovisionableAdapter | true | IDP-08, 13 |
| 3 | 76-10 | D-16 template annotation on GWS deprovision test + GC cron sub-task in reminders/route.ts + SC#7 no-Reactivate-button RTL + grep guard | true | IDP-08, 13, 15 |

**Plan-checker verdict:** PASSED (manual checker run — gsd-plan-checker agent not installed in this environment). All 16 LOCKED CONTEXT decisions (D-01..D-16) addressed; every IDP-{02,08,09,10,11,13,14,15} requirement covered by ≥1 plan beyond Wave 0; Standing Constraint LOCAL-ONLY honoured (legal review DEFERRED, multi-region manual). Threat models (8 plans × ~5 threats), validation strategy (Nyquist with 35-row per-task verification map), Phase 70 dependency hooks (`signoff-registry-flags.json`, `IDP_AUDIT_ALLOWED_FIELDS`, `getIdpAuditLogger`, `scopeCapabilities` JSONB infrastructure, `lint-guards` 4th-sibling extension), and Phase 71 D-07 TZ library convergence (`@date-fns/tz`) all present.

**Key risks identified:**

- Plan 76-02 schema migration is `autonomous: false` — requires manual `npx tsx packages/db/scripts/push-all-regions.ts` against EU + ME databases post-merge.
- Plans 76-07 (`lint:scopes` guard) and 76-08 (GWS scope expansion) are sequenced in Wave 2 such that the guard ships before the GWS adapter import. The plan accepts that 76-07 may be RED-then-GREEN within the brief 76-07-only window before 76-08 lands; the guard itself passes its own unit tests in 76-07.
- Phase 71 is being planned in parallel; both phases reuse `@date-fns/tz` from the Phase 71 D-07 pin. Cross-checked against 71-RESEARCH.md (line 23, 385) — single library, no parallel pin.

**Phase 76 plan artefacts:**

- `76-RESEARCH.md` — schema shapes, TZ library convergence, QStash topology, DeprovisionResult type shape (USER_NOT_FOUND → SUCCEEDED rule + MAX_ATTEMPTS = 3), validation architecture, 10-plan wave shape
- `76-PATTERNS.md` — 18 Phase-76 elements mapped to existing codebase siblings (no new architectural primitives — every D-NN has a precedent: Phase 70 D-13/D-15/D-16, Phase 71 D-07, v5 `recreateDraftAfterDrift`, classification `claimDraft` atomic-update, `late-payment-interest.ts` QStash fan-out)
- `76-VALIDATION.md` — 35 verification rows across 10 plans; 5 manual-only (multi-region apply, legal review of `idp-deprovisioning` flag, GWS write-access banner end-to-end, real-provider sandbox tests, webhook self-trigger end-to-end)

## Phase 71 Planned (2026-04-27)

7 plans across 4 waves; 2 marked `autonomous: false` (Plans 71-03 schema migration + 71-07 backfill — both follow Phase 70 Plan 09 multi-region precedent):

| Wave | Plan | Title | autonomous | Requirements |
|------|------|-------|------------|--------------|
| 0 | 71-01 | Failing test scaffolds + new `@contractor-ops/compliance-policy` package skeleton | true | All 4 (RED state) |
| 1 | 71-02 | 13-rule policy registry seeds (5 jurisdictions) + 13 PENDING signoff entries + TZ-aware isExpired helper | true | COMPL-08, COMPL-09 |
| 2 | 71-03 | Schema migration — 4 cols + 2 enums + 1 col on ClassificationAssessment + drift index | **false** | COMPL-08 |
| 2 | 71-04 | `submit` transactional refactor + supersession-on-outcome-change + materialiseFromPolicy/supersedeAndMaterialise helpers | true | COMPL-02 |
| 3 | 71-05 | `recreateComplianceAssessment` admin tRPC mutation + idempotency guard + single audit-log emission | true | COMPL-10 |
| 3 | 71-06 | Recompute UI button + bulk action + 4-locale i18n strings | true | COMPL-10 |
| 3 | 71-07 | Idempotent backfill script + multi-region run docs | **false** | COMPL-08 |

**Plan-checker verdict:** PASSED. All 16 LOCKED CONTEXT decisions (D-01..D-16) addressed; every COMPL-{02,08,09,10} requirement covered; Standing Constraint LOCAL-ONLY honoured (legal review DEFERRED, multi-region manual). Threat models, validation strategy (Nyquist), and Phase 70 dependency hooks (`signoff-registry-flags.json`, `lint:schema`/`lint:logs`/`i18n:parity` regression checks) all present.

**Phase 71 plan artefacts:**

- `71-RESEARCH.md` — pinned per-jurisdiction document specifics + draft legal text + library choice (`@date-fns/tz` v4)
- `71-PATTERNS.md` — analog files: feature-flags signoff registry, classification recreateDraftAfterDrift, audit-writer, push-all-regions, revalidate-vat-button
- `71-VALIDATION.md` — 36 verification entries across 7 plans; 5 manual-only (multi-region apply, visual SQL review, admin UI, legal text approval)

## Phase 70 Complete (cleared 2026-04-27)

**Plan 70-09 + 70-10 status:** SHIPPED. The `autonomous: false` flag on 70-09 referred to the per-region backfill *apply step*, not the code work. Code-side acceptance criteria were met and committed; the apply step is recorded as a deferred post-deploy item under the LOCAL-ONLY Standing Constraint (mirrors v5.0 deferred-items pattern).

**Phase 70 commits (all 10 plans on `main`):**

| Plan | Commit | Subject |
|------|--------|---------|
| 70-01 | `bcaa2e70` | Wave 0 failing test scaffolds for FOUND6-01..06 + lint-guards package |
| 70-02 | `cde07dc8` | pnpm lint:schema CI guard for FOUND6-01 (P27) |
| 70-03 | `abc00a7c` | default-redact logger bodies + pnpm lint:logs guard for FOUND6-02 (P28) |
| 70-04 | `eb4486ce` | pnpm i18n:parity CI guard for FOUND6-03 (P29) |
| 70-05 | `c251e4c7` | flag-namespace signoff registry schema + helpers for FOUND6-04 (P30) |
| 70-06 | `f2d76942` | wire pnpm lint:schema/lint:logs/i18n:parity into CI + husky pre-push |
| 70-07 | `99a6c74f` | boot-time flag-signoff gate + LOCAL-ONLY bypass for FOUND6-04 (P30) |
| 70-08 | `741f62f0` | getIdpAuditLogger() with allow-list semantics for FOUND6-06 (P28) |
| 70-09 | `9212adf1` | IntegrationConnection.scopeCapabilities + backfill migration for FOUND6-05 (P31) |
| 70-10 | `2a41d142` | GWS reconnect banner + i18n keys for FOUND6-05 / D-16 |

**Deferred post-deploy item (recorded in Deferred Items table below):**

The backfill apply against `DATABASE_URL_EU` and `DATABASE_URL_ME` is idempotent and documented in `packages/db/scripts/README.md`. Recommended sequence (run from a deploy workstation, NOT in background sessions):

```sh
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts
```

`WHERE scopeCapabilities IS NULL` precondition makes both runs idempotent — safe to re-run after partial failure or to verify zero-write convergence.

**Downstream unblocked:** Phase 71 (depends on 70 ✓), Phase 74 (depends on 70 ✓ — context gathered, ready to plan), Phase 79 (depends on 71). Phase 76 still gated on Phase 74 + 75 landing.

## Performance Metrics

**Velocity:**

- Total plans completed: 378 (51 v1.0 + 52 v2.0 + 47 v3.0 + 55 v4.0 + 70 v5.0 [Phases 56–69] + 10 v6.0 [Phase 70])
- v6.0 plans completed: 10 (Phase 70: 70-01..70-10)
- v6.0 phases completed: 1 / 11 (Phase 70)
- v6.0 phases planned: 11 (70-80)

**v5.0 Reference:**

- 70 plans across 14 phases (56–69)
- Trend: Stable; gap-closure phases reduced verification debt to zero before milestone close

*Updated after each plan completion*

## Accumulated Context

## Deferred Items

Items acknowledged and deferred at v5.0 milestone close on 2026-04-26:

| Category | Phase | File | Status | Disposition |
|----------|-------|------|--------|-------------|
| migration_apply | 70 | 70-09-SUMMARY.md | code shipped (`9212adf1`) — multi-region apply pending | post-deploy: `tsx packages/db/scripts/backfill-scope-capabilities.ts` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME` (idempotent, dry-run-supported) |
| migration_apply | 74 | 74-04-SUMMARY.md | code shipped (`21e998cc`) — multi-region apply pending | post-deploy: `tsx packages/db/scripts/push-all-regions.ts` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME`. Migration: `20260427105536_phase_74_offboarding_foundation`. Additive-only (0 DROP/RENAME). |
| migration_apply | 76 | 76-02-SUMMARY.md | code shipped (`45a7c742`) — multi-region apply pending | post-deploy: `npx tsx packages/db/scripts/migrate-all-regions.ts` (or `pnpm db:migrate:all`) against `$DATABASE_URL_EU` then `$DATABASE_URL_ME`. Migration: `20260531164549_phase76_idp_deprovisioning`. Additive-only (3 CREATE TABLE + 5 CREATE TYPE + 1 ADD COLUMN, 0 DROP). Idempotent via `_prisma_migrations`. |
| migration_apply | 73 | 73-02-SUMMARY.md | code shipped (`10ac5a4d`) — multi-region apply pending | post-deploy: `pnpm db:migrate:all` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME`. Migration: `20260428000000_phase_73_compliance_dashboard_overrides_pending_review`. Additive-only (1 CREATE TYPE + 1 ALTER TYPE ADD VALUE + 2 ADD COLUMN + 2 CREATE INDEX, 0 DROP). Idempotent via `_prisma_migrations`. NOTE: local `prisma db push` is blocked by the pre-existing `Contractor.search_vector` GENERATED column — used `prisma generate` for Wave 2 type resolution. |
| migration_apply | 76-WR1 | audit/post-migration-parity (this branch) | code shipped — multi-region apply pending | post-deploy: `pnpm db:migrate:all` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME`. Migration: `20260601000000_phase76_fix_wr1_idempotencykey_per_org`. Drops `DeprovisioningRun_idempotencyKey_key` (global unique) and creates `DeprovisioningRun_organizationId_idempotencyKey_key` (composite per-org unique). Additive/safe (DROP INDEX + CREATE UNIQUE INDEX, no data loss). Must be applied BEFORE any other session runs startDeprovisioningRun in production to eliminate the cross-tenant key-squatting window (WR-1). |
| legal_signoff | 73 | 73-04-SUMMARY.md | code shipped (`5d001914` parent commit) — per-jurisdiction legal review pending | post-deploy: flip COMPL_DOCNAME_* signoff-registry entries PENDING→APPROVED via per-adviser PRs (UK/Steuerberater/PL/KSA/UAE/US). Arabic doc-name legal review for all `// TODO ar legal review (Phase 79)` entries = Phase 79. |
| i18n_review | 73 + fix-campaign | apps/web-vite/messages/ar.json | machine-translated (WR-5 + campaign batches 3/5) | Phase-73 + campaign Arabic translations (Compliance.dashboard, Compliance.override, Compliance.uploadReview, Compliance.history, Compliance.notifications, Portal.compliance, Payments.sidePanel.loadingTitle, Compliance.documentType ip_assignment keys) are machine-generated — native Arabic speaker review required before production. Consistent with existing deferred ar doc-name / banner review (legal_signoff row above + Phase 79). |
| uat_gap | 60 | 60-HUMAN-UAT.md | partial — 4 pending scenarios | post-deploy manual UI verification |
| uat_gap | 61 | 61-UAT.md | partial — 12 pending scenarios | post-deploy manual UI verification |
| uat_gap | 62 | 62-HUMAN-UAT.md | partial — 3 pending scenarios | post-deploy manual UI verification |
| uat_gap | 63 | 63-HUMAN-UAT.md | partial — 6 pending scenarios | post-deploy manual UI verification |
| verification_gap | 56 | 56-VERIFICATION.md | gaps_found | GAP-67-01-01 closed by Phase 69 (commit ee0dc8aa); FOUND-03 → Complete |
| verification_gap | 57 | 57-VERIFICATION.md | gaps_found | code-level passed; gap addressed by Phase 66 + Phase 57 plan 04 audit-acknowledgement |
| verification_gap | 58 | 58-VERIFICATION.md | gaps_found | I-3 documented as warning (verification-shape only, runtime works); Phase 67 verified |
| verification_gap | 60 | 60-VERIFICATION.md | human_needed | manual UI UAT — same items as 60-HUMAN-UAT above |
| verification_gap | 61 | 61-VERIFICATION.md | human_needed | manual UI UAT — same items as 61-UAT above |
| verification_gap | 62 | 62-VERIFICATION.md | human_needed | manual UI UAT — same items as 62-HUMAN-UAT above |

All items consistent with Standing Project Constraints (LOCAL-ONLY, manual UI verification deferred to post-deploy).
Code-level audit gaps (I-1 / EINV-01/02/04 / PAY-04 / FOUND-03) all closed this session by Phases 65-69.
| Phase 79 P01 | 25m | 3 tasks | 10 files |
| Phase 79 P79-02 | 14min | 4 tasks | 13 files |
| Phase 79 P79-03 | 35 | 3 tasks | 12 files |
| Phase 79 P04 | 10min | 2 tasks | 5 files |
| Phase 79 P79-05 | 16 | 2 tasks | 15 files |
| Phase 79 P06 | 8min | 2 tasks | 6 files |
| Phase 79 P08 | 10min | 2 tasks | 4 files |

### Standing Project Constraints

- **Deployment status: LOCAL-ONLY.** The application is still in local development and has not been deployed to production. No external users, no regulated customers, no live data flows.
- **Legal/regulatory verification is DEFERRED.** Any feature that ordinarily requires sign-off from an external legal entity (UK tax adviser for IR35 / ITEPA wording, German Steuerberater for DRV / Scheinselbständigkeit / SGB terminology, Polish doradca podatkowy for JPK, Arabic legal counsel for PDPL, etc.) should be marked as "Needs verification by legal entity before production deploy" in the relevant SUMMARY.md / VALIDATION.md / plan checkpoint, but must NOT hard-block the build, the CI pipeline, or local execution. There is no point running approval workflows pre-deploy.
- **Default behaviour for legal-review checkpoints:** treat the plan-provided legal wording as the working copy, ship it, and record the outstanding legal sign-off as a post-merge item in the phase SUMMARY under "Manual-Only Verifications" or an equivalent section. Do NOT write STATE.md blockers for missing legal sign-off unless the plan explicitly hard-stops on it.
- **Codebase coding standards override plan templates (user-confirmed, Phase 73).** Plan template code is a sketch, not authoritative — match the existing codebase conventions and pass every repo check/lint gate:
  - **Prisma enum values = `UPPER_SNAKE_CASE`** (`^[A-Z][A-Z0-9_]*$`), enforced by `pnpm --filter @contractor-ops/db db:audit-enum-casing`. Plan templates that show lowercase enum values are wrong — convert to UPPER_SNAKE.
  - **No hardcoded user-facing strings.** UI text in `apps/web-vite` goes through `useTranslations` (apps/web-vite/src/i18n/useTranslations.ts) with keys added to ALL of `messages/{en,de,pl,ar}.json` (run `pnpm i18n:parity`). tRPC error `message`s use stable constant strings (client maps tRPC codes → localized copy); runtime `MISSING_MESSAGE` is never acceptable.
  - **Run the relevant gates before marking a plan done:** `db:audit-enum-casing` (schema), `lint:schema`, `lint:audit-log` (sensitive mutations → writeAuditLog), `lint:raw-sql` (tenant-scoped), `lint:logs`/`lint:silent-catch` (Pino, no swallowed errors), `i18n:parity` + `check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}` (UI waves). Scope-boundary: do NOT fix pre-existing unrelated offenders (e.g. Phase 77 `ManualOverrideCategory` lowercase, `UserPinnedView` missing organizationId) — only keep your own additions clean.

### v6.0 Roadmap Summary (created 2026-04-26)

**11 phases (70-80) covering 54 requirements:**

| Phase | Name | Reqs | Research |
|---|---|---|---|
| 70 | v6.0 Foundation — CI Guards & Observability | 6 | STANDARD |
| 71 | F1 Compliance — Policy Package + Schema | 4 | NEEDS RESEARCH |
| 72 | F1 Compliance — Reminder + Payment Block | 4 | STANDARD |
| 73 | F1 Compliance — Dashboard + Portal + i18n | 3 | STANDARD |
| 74 | F4 Offboarding — Workflow + KT Templates | 6 | STANDARD |
| 75 | F4 Offboarding — IP Verify + Credentials | 5 | NEEDS RESEARCH |
| 76 | F2 IdP — Capability + Saga + Cooldown | 8 | STANDARD |
| 77 | F2 IdP — GWS + Slack (the wedge) | 4 | NEEDS RESEARCH |
| 78 | F2 IdP — Entra + Okta + GitHub | 3 | NEEDS RESEARCH |
| 79 | F3 Gulf — UAE Free-Zone + Saudization | 11 | NEEDS RESEARCH |
| 80 | v6.0 Verification + Hardening + UAT | 0 | STANDARD |

**Hard dependency edges:**

- 70 → all (foundation guards must ship first)
- 71 → 79 (free-zone trade license participates in F1 reminder cron)
- 71 → 75 (F4 IP-clause findings persist as ContractorComplianceItem)
- 74 → 75 (F4 IP_VERIFICATION needs override permission + workflow foundation)
- 75 → 76 (F2 14-day cooldown gate references F4 final-invoice-paid state — Pitfall 7)
- 76 → 77 → 78 (saga + cooldown infra → wedge → differentiator)

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v6.0 roadmap, 2026-04-26]: Foundation-first (Phase 70) — PITFALLS P27-P31 wins over ARCHITECTURE F1-first proposal; cross-cutting CI guards prevent CRITICAL-recovery-cost bug classes
- [v6.0 roadmap, 2026-04-26]: F4 ships before F2 — Pitfall 7 cooldown gate references F4's final-invoice-paid state machine
- [v6.0 roadmap, 2026-04-26]: F2 split into wedge (GWS+Slack, Phase 77) + differentiator (Entra+Okta+GitHub, Phase 78) — ~95% SMB market hits the wedge with narrowest scope expansion
- [v6.0 roadmap, 2026-04-26]: F1 ships before F3 + F4 — both compose on F1's `ContractorComplianceItem` + reminder cron schema
- [v6.0 requirements, 2026-04-26]: Drift escape hatch reused 3x (compliance requirement-set / Saudization Nitaqat thresholds / role taxonomy) — milestone-wide pattern mirrors v5.0 `recreateDraftAfterDrift`
- [v6.0 requirements, 2026-04-26]: Saudization band entry is MANUAL — system never auto-computes (legal liability + quarterly matrix changes); GULF-FUTURE-02 likely never
- [v6.0 requirements, 2026-04-26]: Contract clause scanner is REGEX-FIRST per-jurisdiction phrase library; Claude Vision tool_use only as MANUAL_REVIEW_REQUIRED tristate fallback (PITFALLS P22)
- [v6.0 requirements, 2026-04-26]: Credentials are POINTERS only (`CredentialReference` schema) — content-validation regex rejects AKIA*/GitHub PATs/JWT/hex≥32; storing actual credentials explicitly out of scope (PITFALLS P21)
- [v5.0 roadmap]: Classification engine as new `packages/classification` with pluggable country rule sets (mirrors einvoice pattern)
- [v5.0 roadmap]: XRechnung uses CII XML syntax (not UBL) — different from existing Peppol-AE profile
- [v5.0 roadmap]: ZUGFeRD requires PDF/A-3 with embedded CII XML via pdf-lib — highest technical risk, needs proof-of-concept
- [v5.0 roadmap]: Classification stored per-engagement, not per-contractor
- [v5.0 roadmap]: German legal terminology locked as code constants, not in translation files
- [Phase ?]: Phase 79 RTL ml-/mr- guard confirmed absent (Pitfall 20) and built as a Node ESM script (check:rtl-logical-props) wired into lint:ci, scoped to Gulf web-vite surfaces only (D-17)
- [Phase ?]: Gulf test fixtures (makeMeOrg/makeFreeZoneAssignment/makeFreeZoneComplianceItem) are plain-object factories, structurally typed so Wave 0 RED tests import them before the FreeZoneAssignment schema lands in 79-02
- [Phase ?]: 79-02: GENERATE ONLY, DEFER APPLY — ran db:generate (no DB mutation) for downstream type resolution; single-region db:migrate:dev + multi-region db:migrate:all (EU+ME) both deferred post-deploy under LOCAL-ONLY (migration phase79_gulf_free_zone_saudization, additive-only)
- [Phase ?]: 79-03: uae.free_zone_license bumped to BLOCKING @v2 (per-rule rotation); POLICY_RULE_SET_VERSION NOT bumped (locked to pkg version, not the rotation mechanism)
- [Phase ?]: 79-03: free-zone compliance item written out-of-band from the service with zone!=='MAINLAND' gate (D-04); appliesIf:()=>false keeps the classification path out (Pitfall 2); reminder cron fans out over SUPPORTED_REGIONS (Pitfall 18); GULF-11 region-leakage lint in lint:ci (Pitfall 19)
- [Phase ?]: 79-04: Saudization rate from manual SaudiHeadcount only; Nitaqat band read-through, never auto-computed (Pitfall 7/8)
- [Phase ?]: 79-04: NOC scope-mismatch item uses documentType OTHER (no NOC enum value; identified by name + policyRuleId uae.permitted_activity_noc@v1) — avoids a migration in a pure-logic plan
- [Phase ?]: 79-04: offboarding trajectory is ephemeral SaudiHeadcount-1, advisory + non-authoritative, asserts no band, persists nothing (D-12)
- [Phase ?]: 79-05: gulf tRPC namespace mounted (free-zone + saudization CRUD + dashboard + GULF-10 audit-logged drift overrides), tenant-scoped/region-aware/audit-logged; contract-create runs the permitted-activity ISIC scope check in-tx (non-blocking, D-07); D-02 freeform-to-FreeZoneAssignment backfill + AE-field hide. C9 GREEN.
- [Phase ?]: 79-06: UAE free-zone UI = Container/Hook/Form (hook = sole tRPC boundary); native date input over calendar (RTL-safe); form doubles as create surface
- [Phase ?]: 79-06: D-02 removed freeform UAE tradeLicense*/freeZone inputs from country-compliance-section, mounted structured free-zone form; scope-mismatch banner non-blocking --warning (D-07)
- [Phase ?]: 79-08: Saudization.bands.* sourced from LOCKED_SA_PHRASES literals (identical across en/de/pl/ar, D-14).
- [Phase ?]: 79-08: free-zone zone proper nouns kept verbatim in de/pl, localized in ar; demo-readonly i18n keys bundled per user decision (only 4 JSONs staged).

### Pending Todos

- Phase 70 — DONE (10/10 plans on `main`); multi-region backfill apply is a deferred post-deploy item (see Deferred Items table).
- Phase 74 (F4 Offboarding — Workflow Foundation) — context gathered, run `/gsd-plan-phase 74` next.
- Phase 71 + 76 plans ready — execute when ready (71 unblocked, 76 still gated on 74 + 75).
- Phase 75, 77, 78, 79 carry NEEDS RESEARCH flags — `/gsd-plan-phase` will spawn `gsd-phase-researcher` for those.
- Standing reminder: every legal-sensitive Unleash flag introduced by a v6.0 phase must register PENDING in `signoff-registry.ts` (FOUND6-04 CI gate enforces this since Phase 70 shipped).

### Blockers/Concerns

- **[BLOCKER — 2026-06-03] Phase 79 plan-phase workflow cannot spawn subagents (no `Task`/`Agent` API in this runtime).** `Skill(gsd:plan-phase, "79 --auto")` was invoked as a nested/background-agent session. In that context the subagent-dispatch tool (`Task` / `Agent` / `general-purpose`) is NOT in the tool set and is NOT discoverable via `ToolSearch` (confirmed with queries for `Task`, `gsd planner researcher`, and `general-purpose agent delegate`). The plan-phase pipeline's three core stages — `gsd-phase-researcher` (RESEARCH.md), `gsd-planner` (PLAN.md files), `gsd-plan-checker` (verification + revision loop) — are all defined as `Agent()` spawns of those named GSD subagent types and cannot be dispatched here. Same root cause as the documented `[BLOCKER — 2026-04-13] Phase 60` entry below. Additionally, `gsd-sdk query agent-skills gsd-phase-researcher|gsd-planner|gsd-plan-checker` all returned empty strings (`""`) in this run, so even the agent skill contracts (plan schema, deep-work rules, verification rules) were not loadable inline. **No files were created or modified for Phase 79 plans, and no commits were made — this run STOPPED before the researcher spawn rather than hand-authoring PLAN.md (which would bypass the entire research→plan→plan-checker→revision quality pipeline this `--auto` run is meant to execute, violating the manager's "do not silently work around" instruction).** Init/context verified healthy and ready: `phase_status: Pending` (no closed-phase gate), `79-CONTEXT.md` present with 17 locked decisions (D-01..D-17) + mandatory canonical-refs, `has_research: false`, `has_plans: false`, `research_enabled: true`, `plan_checker_enabled: true`, `commit_docs: true`, phase req IDs `GULF-01..GULF-11`. Config gates that would have fired downstream: ASVS L1 security threat-model block (`security_enforcement: true`, block-on `high`), UI-SPEC gate (`ui_phase`/`ui_safety_gate` true — phase has frontend indicators + `UI hint: yes`, so a `79-UI-SPEC.md` would be required or auto-generated under the auto-chain), pattern-mapper (`pattern_mapper: true`), Nyquist validation (`nyquist_validation_enabled: true`), and schema-push detection (Prisma — phase adds `FreeZoneAssignment`/`SaudizationConfig`/`SaudiHeadcount`/`UaeFreeZone` models + `ContractorAssignment` columns, so a `[BLOCKING]` `npx prisma db push` task injection would apply). **Resolution:** re-run `/gsd:plan-phase 79 --auto` (or `/gsd-plan-phase 79`) from a **top-level** interactive Claude Code session where the `Task` subagent API is available, so the researcher → planner → plan-checker chain can run with full fidelity. No re-prep needed — CONTEXT.md and init are already in the correct pre-research state. Remember when committing planning files: `.planning/phases` is a symlink → stage via the real `milestones/v6.0-phases/79-…/` path.

- **[RESOLVED — 2026-04-13] Phase 58 Plan 58-04 COMPLETE.** Wizard UI + i18n shipped in commits `3fed4277` (i18n Classification namespace across en/pl/de/ar + Pitfall-9 _NOTE) and `13310313` (13 wizard component files + RSC page entry + 16/16 RTL + a11y tests + new `recreateDraftAfterDrift` tRPC mutation for the rule-set drift escape hatch). All plan grep assertions green (scoring-free client bundle, aria-current / aria-valuenow / aria-live / inputMode="numeric" / CLASSIFICATION_SCHEIN_NOT_APPLICABLE / isNotApplicable / Classification namespace / _NOTE all present). Locked-phrases guard 32/32 green. See `.planning/phases/58-classification-engine-rule-sets/58-04-SUMMARY.md`. Plan 58-05 remains (outcome page + disclaimer modal + classification tile + 2 human-verify checkpoints — `autonomous: false`).

- **[HISTORICAL — 2026-04-13] Plan 58-04 prior race-condition blocker (now obsolete).** Agent invoked for Plan 58-04 per orchestrator instructions that Plans 58-02 and 58-03 were running as parallel agents. On inspection at start of this session (branch `v2`, HEAD `fb95eb3e`): (1) `packages/classification/src/profiles/ir35/` and `packages/classification/src/profiles/scheinselbstandigkeit/` still contain ONLY `__tests__/` subdirectories — no `rule-set.ts`, no `scoring.ts`, no registered profiles; (2) `packages/api/src/routers/classification.ts` does NOT exist — there is no `classification` router in `packages/api/src/routers/` at all; (3) `58-02-SUMMARY.md` and `58-03-SUMMARY.md` are both absent from `.planning/phases/58-classification-engine-rule-sets/`; (4) `git log --oneline -30` contains zero commits referencing `[58-02]` or `[58-03]` — newest classification-related commit remains `55ce4204` (Plan 58-01 Task 3). Plan 58-04's wizard shell (`apps/web/src/components/contractors/classification/wizard/classification-wizard-shell.tsx`) explicitly imports `IR35_QUESTIONS`, `RULE_SET_VERSION` from `@contractor-ops/classification/profiles/ir35/rule-set`, `SCHEIN_QUESTIONS`, `CATEGORY_WEIGHTS`, `CATEGORY_TITLES` from `@contractor-ops/classification/profiles/scheinselbstandigkeit/rule-set`, and calls `trpc.classification.createDraft`, `.getDraft`, `.saveAnswer`, `.submit`, `.acknowledgeDisclaimer` — every one of those exports depends on Plan 58-02's rule-set constants landing AND Plan 58-03's tRPC router landing. Plan 58-04's `<context>` block even directly `@`-references `58-03-SUMMARY.md` as a read-first input. Note that Plan 58-03's own agent has just recorded its own blocker above — 58-03 is gated on 58-02, and 58-04 is gated on both, so the dependency chain is: 58-02 must land → 58-03 can run → 58-04 can run. Executing 58-04 now would (a) produce TypeScript errors against missing exports, (b) require speculative mocking of both upstream APIs that would need rewriting once real code exists, (c) violate the plan's `depends_on: [58-01, 58-02, 58-03]` declaration, and (d) risk making import paths drift from what 58-02/58-03 will actually export. Per dispatch instructions ("If Plan 58-04 has a file-level dependency on 58-02 or 58-03 output, check whether those commits have landed before proceeding; if not, write a blocker stating the dependency and stop"), STOPPING without making any code changes. No files were modified and no commits were created by this aborted 58-04 run. Resolution: wait for Plan 58-02 parallel agent to land IR35 + DRV rule-sets + scoring + profile registration on `v2`, then for Plan 58-03 parallel agent to land the classification tRPC router on `v2`, then re-dispatch `/gsd:execute-plan 58-04` as a fresh top-level agent. Re-run checks: (a) `ls packages/classification/src/profiles/ir35/ packages/classification/src/profiles/scheinselbstandigkeit/` must show more than `__tests__/`, (b) `ls packages/api/src/routers/classification.ts` must succeed, (c) `ls .planning/phases/58-classification-engine-rule-sets/58-02-SUMMARY.md .planning/phases/58-classification-engine-rule-sets/58-03-SUMMARY.md` must succeed, (d) `git log --oneline --all | grep -E "\[58-0[23]\]"` must return commits.

- **[RESOLVED — 2026-04-13] Phase 58 Plan 58-03 COMPLETE.** Classification tRPC router landed in commit `4ad362f9` on `v2`. Seven procedures (createDraft / getDraft / saveAnswer / submit / acknowledgeDisclaimer / getLatest / listByContractor) wired into appRouter; `classificationSaveAnswerRateLimit` middleware (Upstash + in-memory fallback, 120/min/assessment); observability `LOG_BODY_EXCLUDE_PREFIXES` sentinel covers `classification.*`. 36 green tests (30 router integration + 6 middleware unit), 0 new TS errors. See `.planning/phases/58-classification-engine-rule-sets/58-03-SUMMARY.md`. Plan 58-04 is now unblocked.

- **[HISTORICAL BLOCKER — 2026-04-13] Phase 58 Plan 58-03 cannot proceed — file-level dependency on Plan 58-02 not yet committed.** Agent invoked for Plan 58-03 (classification tRPC router + rate-limit middleware) per orchestrator instructions that Plan 58-02 was running as a parallel agent. On inspection at start of this session: `packages/classification/src/profiles/ir35/` and `packages/classification/src/profiles/scheinselbstandigkeit/` contain ONLY `__tests__/` subdirectories (rule-set.test.ts + scoring.test.ts scaffolds from Plan 58-01). No `rule-set.ts`, no `scoring.ts`, no `index.ts` / `profile.ts` files registered. `getProfileForCountry('GB')` and `getProfileForCountry('DE')` therefore throw because Plan 58-01 registry is empty — no profiles registered. Recent git log (last 30 min) shows zero Plan 58-02 commits on `v2`; newest classification-related commit remains `55ce4204` (Plan 58-01 Task 3). Plan 58-03 PLAN.md explicitly imports `getProfileForCountry`, `buildQuestionsSnapshot`, `outcomeSchema`, `getAnswerSchemaForType`, and calls `profile.scoreAssessment(...)` — all depend on Plan 58-02's IR35 + DRV profiles + scoring functions existing. Without them, TEST CD-1..LC-3 all fail at setup (no profile for 'GB' / 'DE'), and there is no `scoreAssessment` to wire into `submit`. Per orchestrator instructions ("If Plan 58-03 has a file-level dependency on 58-02 output, check whether the required files/tests from 58-02 are already committed before proceeding; if not, write a blocker stating the dependency and stop"), STOPPING without making any code changes. Resolution: wait for Plan 58-02 parallel agent to land its commits (at minimum `packages/classification/src/profiles/ir35/rule-set.ts` + `scoring.ts` + profile registration and `packages/classification/src/profiles/scheinselbstandigkeit/rule-set.ts` + `scoring.ts` + profile registration on `v2`), then re-dispatch `/gsd:execute-plan 58-03` as a fresh top-level agent. Re-run check: `ls packages/classification/src/profiles/ir35/ packages/classification/src/profiles/scheinselbstandigkeit/` must show more than just `__tests__/`, AND `git log --oneline -- packages/classification/src/profiles/` must contain a Plan 58-02 commit. No files were modified and no commits were created by this aborted 58-03 run.

- **[PARTIAL PROGRESS — 2026-04-13] Phase 58 Plan 01 (Wave-0 skeleton) COMPLETE; Plans 02–05 remain.** The `/gsd:execute-phase 58` run was invoked as a background agent session. Runtime does not expose the `Task()` subagent API, so per execute-phase.md `<runtime_compatibility>` the orchestrator fell back to sequential inline execution. Plan 58-01 (3 tasks) executed fully on-branch (v2): (1) `packages/classification` workspace scaffolded with registry + types + Zod schemas + snapshot helper + 7 Wave-0 test scaffolds (9 tests pass, 4 `describe.todo` scaffolds for Plan 02 TDD); (2) `ClassificationAssessment` Prisma model + `ClassificationAssessmentStatus` enum added with explicit index `map` names to dodge Postgres-63-char truncation collisions; back-relations on `ContractorAssignment` + `Organization`; `db:push` succeeded against Neon EU pooler; (3) 9 CLASSIFICATION_SCHEIN_* locked phrases appended to `packages/validators/src/legal/de.ts`, new `packages/validators/src/legal/disclaimers.ts` with 4 bilingual disclaimer constants + reserved-key guard, `packages/validators/src/index.ts` re-exports both modules, `locked-phrases-guard.test.ts` extended with 2 new Phase-58 describe blocks (32/32 guard tests green). See `.planning/phases/58-classification-engine-rule-sets/58-01-SUMMARY.md` for detail. **Remaining:** Plan 58-02 (IR35 + DRV rule sets + scoring, Wave 2), Plan 58-03 (classification tRPC router + rate limit, Wave 3), Plan 58-04 (wizard UI + i18n, Wave 3), Plan 58-05 (outcome pages + disclaimer dialog + tile + 2 human-verify checkpoints, Wave 3 — `autonomous: false`). Three structural issues surfaced during the run that inform how the remaining plans should be dispatched: (a) the runtime's write hooks or a file watcher repeatedly reverted edits to `packages/validators/src/legal/de.ts`, `packages/validators/src/index.ts`, and `packages/validators/src/__tests__/locked-phrases-guard.test.ts` until the final commit captured them — future edits to shared files in this package should Read+Edit then immediately `git add && git commit` to lock the change before the linter strikes; (b) `pnpm install` triggers a repo-wide postinstall build that fails in `@contractor-ops/integrations` (pre-existing docusign-adapter.test.ts + claude-ocr-adapter.msw.integration.test.ts type errors, unrelated to Phase 58) — individual `pnpm --filter @contractor-ops/{db,classification,validators} ...` commands work cleanly; (c) Phase 57 ran as a parallel background agent and rewrote `STATE.md` frontmatter during Phase 58's execution, so STATE body edits must be surgical appends, not full-file rewrites, until both phases settle. Remaining plans each have fully detailed PLAN.md files under `.planning/phases/58-classification-engine-rule-sets/` with canonical read-before-write references into RESEARCH.md + UI-SPEC.md + CONTEXT.md. Resolution: dispatch Plans 58-02 through 58-05 as **separate top-level** `/gsd:execute-plan 58-02` … `/gsd:execute-plan 58-05` invocations (one fresh agent per plan) so each loads a clean context window; 58-05 additionally needs interactive sessions for the two Steuerberater / UK-tax-adviser human-verify checkpoints before its VALIDATION.md can flip `nyquist_compliant: true`.
- **[BLOCKER — 2026-04-13] Phase 60 plan-phase workflow cannot spawn subagents.** The `Skill(gsd:plan-phase, "60 --auto")` run was invoked as a nested sub-agent / background agent session (GSD autonomous pipeline). In that context the `Task` tool is NOT available — it is not in the tool set and not discoverable via `ToolSearch`. The workflow cannot spawn `gsd-phase-researcher`, `gsd-planner`, or `gsd-plan-checker`. Before stopping, two artifacts WERE created successfully using the inline tool set: (1) `.planning/phases/60-classification-polish/60-UI-SPEC.md` — full UI design contract derived from CONTEXT.md D-01..D-16 + existing Precision Craft tokens in `apps/web/src/app/globals.css` + `apps/web/components.json` (shadcn `base-nova` preset); 4 sizes / 2 weights typography, accent reserved-for list with 5 specific items, 60/30/10 split explicit, registry safety PASS (shadcn official only — no third-party), component inventory for 15 Phase-60 components mapped to existing shadcn primitives (`card`, `badge`, `alert-dialog`, `dialog`, `dropdown-menu`, `popover`, `progress`, `table`, `tabs`, `tooltip`, `skeleton`, `button`, `input`, `select`, `separator`, `breadcrumb`, `calendar`, `sheet`, `label`), inline 6-dimension self-check PASS (commits `2aefefcf` + `b4fa1974`, frontmatter flipped to `status: executing

- **[BLOCKER — 2026-04-12] Phase 57 plan-phase workflow cannot spawn subagents.** The `/gsd-plan-phase 57 --auto` run was invoked as a background agent session (GSD autonomous pipeline). In that nested sub-agent context the `Task` tool is NOT available — it is not in the tool set and not discoverable via `ToolSearch`. The workflow cannot spawn `gsd-phase-researcher`, `gsd-planner`, or `gsd-plan-checker`. Orchestrator stopped before step 5 (research spawn) per manager instructions to record blockers instead of silently working around permission/tool-access errors. CONTEXT.md is already in place at `.planning/phases/57-government-api-clients/57-CONTEXT.md` (gathered 2026-04-12, 14 locked decisions, full canonical refs, code-context, and deferred list). DISCUSSION-LOG.md also present. No RESEARCH.md, VALIDATION.md, UI-SPEC.md, or PLAN.md files were created. Resolution options: (1) re-run `/gsd-plan-phase 57 --auto` from an interactive top-level session (not a nested background agent) so Task-tool-based subagent spawning works; (2) run the pipeline stages manually at top-level: `/gsd-ui-phase 57 --auto` (if frontend indicators trigger the gate) → `/gsd-plan-phase 57 --auto`; (3) use `--skip-research` if research is not desired. Note this is the same blocker pattern previously hit on Phase 56 — nested sub-agent spawning is a structural limit of the current autonomous orchestration, not a transient failure. Before a clean re-run, reset chain flag if stuck: `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow._auto_chain_active false`.
- **[BLOCKER — 2026-04-12] Phase 56 plan-phase workflow cannot spawn subagents.** The `/gsd-plan-phase 56 --auto` run was invoked as a background agent session (GSD autonomous pipeline). In that context the `Task` tool is not available, so the workflow cannot spawn `gsd-ui-researcher`, `gsd-ui-checker`, `gsd-phase-researcher`, `gsd-planner`, or `gsd-plan-checker`. The workflow auto-chained into `gsd:ui-phase` (UI-SPEC gate, step 5.6) and stopped at the first researcher spawn. Resolution options: (1) re-run `/gsd-plan-phase 56 --auto` from an interactive top-level session (not as a nested background agent) so Task-tool-based subagent spawning works; (2) run the pipeline stages manually at top-level: `/gsd-ui-phase 56 --auto` → `/gsd-plan-phase 56 --auto --skip-research` (or with research) — each as a separate top-level invocation; (3) disable UI gate via `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow.ui_phase false` and `workflow.ui_safety_gate false` and re-run (not recommended — loses design contract). Side effect: `workflow._auto_chain_active` was set to `true` during the aborted run; reset with `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow._auto_chain_active false` before a clean re-run. CONTEXT.md is in place; no other artifacts were created.
- HMRC developer hub registration takes weeks — initiate during Phase 56 to avoid blocking Phase 57
- pdf-lib PDF/A-3b capability needs proof-of-concept before Phase 62 implementation — fallback is Apache PDFBox child process
- German Steuerberater review of tax terminology should be commissioned during Phase 56
- VIES REST API production stability in 2026 unconfirmed — may need soap fallback
- BACS Standard 18 full spec requires procurement from Vocalink/Pay.UK via BACS bureau
- [BLOCKER — 2026-04-14] Phase 62 execute-phase workflow cannot spawn subagents. The /gsd:execute-phase 62 run was invoked as a background autonomous agent session. In that context the Task() subagent API is NOT available — not in the tool set and not discoverable via ToolSearch. Per execute-phase.md <runtime_compatibility>, the documented fallback is sequential inline execution, but the scope of Phase 62 exceeds what a single inline context can reliably complete: 7 plans across 6 waves touching ~90+ files (Prisma schema + forward-only migration with [BLOCKING] live Neon push, full zugferd-de profile with CII/XRechnung parsers + PDF asset bundle, PDF/A-3 generator pipeline with veraPDF CI gate, intake matcher/service, two tRPC routers, all web UI surfaces per 62-UI-SPEC.md including intake pages/upload dialog/split-button/locale strings across en/de/gb, and Playwright E2E coverage for both EINV-02 + EINV-03). Plan artifacts total ~3,400 lines before implementation. Attempting inline would exhaust context before Wave 3 and produce partial uncommitted work — matching the pattern previously documented for Phases 56, 57, 58, 60 nested-agent blockers. Execution stopped BEFORE any code changes (STATE.md begin-phase ran but no Prisma edits, no migrations, no parser code, no UI). Current branch: v2 @ 378407dc. STATE.md frontmatter was advanced to "Phase 62 execution started" via state begin-phase — manager may want to roll that back to "Phase 63 context gathered" if restarting from a clean slate. Resolution options: (1) re-run /gsd:execute-phase 62 from an interactive top-level session where Task() subagent spawning is available — the recommended path since 7 plans deserve fresh context each; (2) run each plan individually at top-level: /gsd:execute-plan 62-01 ... /gsd:execute-plan 62-07 one at a time, each as a fresh top-level invocation, respecting wave dependencies (62-01 first, then 62-02, then 62-03 and 62-04 in parallel, then 62-05, then 62-06, then 62-07); (3) use interactive flag: /gsd:execute-phase 62 --interactive at top-level for pair-programming-style sequential inline execution with user checkpoints. Note that Plan 62-01 Task 4 is [BLOCKING] — it requires `pnpm --filter @contractor-ops/db prisma db push --accept-data-loss` against the live Neon DB; this must NOT be bypassed since downstream Prisma client types depend on the push completing. Reset chain flag before re-run if needed: `node .claude/get-shit-done/bin/gsd-tools.cjs config-set workflow._auto_chain_active false` (already reset by this session's init step).

- **[REPLAN COMPLETE / COMMIT BLOCKED — 2026-05-31] Phase 72 path-fix replan done on disk; commit blocked by an in-progress cherry-pick owned by another process.** Ran `gsd-plan-phase 72 --auto` as a REPLAN to fix stale file paths after the web migration on `audit/post-migration-parity`. All edits are COMPLETE and intact on disk (verified): 8 PLAN.md (72-01..08) + CONTEXT/RESEARCH/PATTERNS/VALIDATION migration banners + new `72-REPLAN-DRIFT-MAP.md` (authoritative path-correction reference). Corrections applied: `apps/web` → `apps/web-vite` (Vite SPA; the "wizard" is `components/payments/new-payment-run-dialog/` + `hooks/use-payment-run-step-review.ts`; i18n is flat `apps/web-vite/messages/{en,de,pl,ar}.json` via custom `useTranslations`, NOT next-intl/next-link); cron reminders → `apps/cron-worker/src/jobs/handlers/reminders/index.ts` (4th `Promise.all` member; test `apps/cron-worker/src/__tests__/reminders.test.ts`); dedup helper home → `packages/api/src/services/cron-dedup.ts` (cron-worker `shared.ts` re-exports — the old "move out of apps/web" task was obsolete); payment router → `routers/finance/payment.ts` (`payment.create` + `payment.lockAndExport`, NOT `paymentRun.*`); approval router → `routers/core/approval.ts` (`resumeFromCompliance` gated by `invoice:['approve']` — no `approval`/`override` perm exists in `@contractor-ops/auth`); classification router → `routers/compliance/classification.ts`; `approval-engine/operators/` to be created beside the existing `approval-engine.ts`; lint-guard → per-guard subdir `lint-guards/src/payment-gate-guard/run-guard.ts` (`runPaymentGateGuard`) surfaced via `index.ts` barrel; logger `createServiceLogger` (nonexistent) → `createLogger({ service })`; `getCurrentPolicyVersion()` (nonexistent) → `POLICY_RULE_SET_VERSION` const; feature-flags import from package barrel (no `/registry` subpath); multi-region `push-all-regions.ts` → `migrate-all-regions.ts` (`db:migrate:all`); and `packages/api/package.json` `exports` must gain `./services/cron-dedup` + `./services/compliance-reminder-scan` (explicit allowlist, no wildcard). All 19 corrected target paths verified to exist in-tree. Decisions D-01..D-19 unchanged. **COMMIT BLOCKER:** the repo is mid-`git cherry-pick` (`.git/sequencer/todo` lists 2 pending `test(api,classification)` commits — `7df2a620`, `72934061` — NOT created by this session; HEAD `5223b324`, branch `audit/post-migration-parity`). The `lint-staged` pre-commit hook + sequencer state cleared the index when I tried to commit, so `git commit` failed with "could not find any staged files". Per Git safety rules I did NOT run `cherry-pick --abort/--continue/--skip`, `reset`, or any destructive recovery (a shared tree — that could destroy another agent's in-flight work). Resolution: once the in-progress cherry-pick is resolved by its owner, re-stage and commit the phase 72 docs: `git add .planning/milestones/v6.0-phases/72-f1-compliance-reminder-cascade-payment-block/ && git commit` (suggested message in the aborted attempt). The replan content needs no further work — only the commit is pending. (`.planning/config.json` shows `_auto_chain_active: true→false`, a harness side-effect, intentionally left unstaged.)

## Session Continuity

Last session: 2026-06-03T10:49:06.893Z
Stopped at: Completed 79-08-PLAN.md (Gulf 4-locale i18n; C10 GREEN at translation layer; Task 3 human-verify deferred to verifier)
Resume file: None
Next command: `/gsd-plan-phase 74`  (Phase 74 context gathered, ready to plan; 71 + 76 plans already ready to execute)

**Planned Phases (ready to execute):** 71 (F1 Compliance — 7 plans), 76 (F2 IdP — 10 plans, gated on 74 + 75)
**Recorded:** 2026-04-27

**Planned Phase:** 74 (F4 Offboarding — Workflow Foundation + KT Templates + Override Permission) — 8 plans — 2026-04-27T09:58:11.669Z
