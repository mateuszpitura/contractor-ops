# Plan 93-10 Summary — Documentation-follows-code closure

**Wave:** 5 · **Status:** complete

## What shipped

- **New domain page** `.planning/brain/wiki/domains/worker-onboarding-offboarding.md` — Purpose / Flow (mermaid) / Entry points / UI surface / Agent mistakes; `verify_with` lists the real source paths (workflow-execution-runs, deprovisioning, employee-lifecycle-router, statutory-cert-pdf, gov-stub-types, post-org-create-hook, employee-templates, the 3 schema files, the web-vite hook + panel).
- **`structure/api-routers-catalog.md`** — added the `employeeLifecycle` namespace row; bumped `source_commit` + added `employee-lifecycle-router.ts` to `verify_with` (this was the gate-required refresh for the `root.ts` change).
- **`structure/prisma-schema-areas.md`** — new "Worker on/offboarding" section (EntityType members, `WorkflowRun.workerId`, `WorkflowTemplate.jurisdiction/seedKey` + compound unique, `DeprovisioningRun` nullable-FK + `workerId`, `EmployeeProfile.terminatedAt`, `StatutoryCertificate`, the un-applied migration + CHECK constraints).
- **`structure/key-services.md`** — added `statutory-cert-pdf`, the gov stub seams, `employee-templates`, and the shared `startWorkflowRun` helper.
- **`.planning/MEMORY.md`** — the four Phase 93 invariants (extend-not-duplicate + single `startWorkflowRun`; `terminatedAt` cooldown signal; DRAFT `*Last4` adviser-verify certs + gov stubs; per-market `WorkflowTemplate` seeds + un-applied migration).
- **`wiki/log.md`** dated Phase 93 entry; **`wiki/hot.md`** overwritten with a worker-on/offboarding discovery pointer (both `source_commit` bumped).

## Verification

- `pnpm check:wiki-brain` → **0 errors** (1 pre-existing WARN: multiple `source_commit` prefixes across the wiki — non-blocking). Fixed the two dead wikilinks and refreshed the `root.ts`-drifted catalog. BM25 index rebuilt (`.vault-meta/` — gitignored local artifact; contextual-prefix + `bm25-index.py build`, docs=228).

## Notes

- `patterns/workflow-engine.md` and `patterns/offboarding.md` (listed in the plan) do NOT exist in this branch's wiki, so the worker-keying pattern notes were folded into the domain page + MEMORY + `patterns`-free cross-refs instead of creating new pattern pages.
