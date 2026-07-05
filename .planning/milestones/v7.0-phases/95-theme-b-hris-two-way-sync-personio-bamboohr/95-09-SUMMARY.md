# Plan 95-09 Summary — documentation follows code

**Wave:** 6 · **Status:** complete

## What shipped

| File | Change |
|------|--------|
| `wiki/domains/hris-sync.md` | NEW — Purpose, the **field-partition table** (field → owner → direction), the **loop-break** (disjoint partition + syncHash + change-origin guard), Flow, Entry points, the three "agent mistakes"; `verify_with` lists the hris-sync services + outbox push files + router |
| `wiki/integrations/personio.md` | NEW — client-credentials bearer, v2 /persons offset≤200, 200/min, attribute-scoped; `integration.personio-sync` gate |
| `wiki/integrations/bamboohr.md` | NEW — OAuth 2.0, un-paginated directory, standard-field sync, `BAMBOOHR_CUSTOM_ATTR_VERIFIED` custom-attr gate |
| `wiki/integrations/_index.md` | +Personio, +BambooHR |
| `wiki/structure/api-routers-catalog.md` | Conditional workforce 6→7; `hrisSync` namespace row; `source_commit` bumped; router added to `verify_with` (resolves the root.ts drift gate) |
| `wiki/structure/cron-jobs.md` | +`hris-sync` hourly row; `source_commit` bumped |
| `wiki/structure/prisma-schema-areas.md` | +HRIS section (enum + partial unique index + configJson storage) |
| `wiki/patterns/feature-flags.md` | +`integration.personio-sync`/`integration.bamboohr-sync` gates |
| `wiki/log.md` + `wiki/hot.md` | Phase 95 log entry + hot-cache discovery shortcut |
| `.planning/EXTERNAL-ENABLEMENT.md` | +4 rows (Personio creds, BambooHR OAuth, BambooHR custom-attr, migration apply) |
| `.planning/MEMORY.md` | +HRIS two-way-sync invariant (disjoint loop-break; invoice.paid is not an outbox type; one-HRIS-per-org raw-SQL partial index; C1/C2/C3) |

## Verification

- `pnpm check:wiki-brain` → **0 errors**, 1 warning (the pre-existing multi-`source_commit` WARN — expected across a large wiki). The root.ts → `api-routers-catalog.md` drift error is resolved.
- Contextual prefixes regenerated for the touched pages; BM25 index rebuilt (`docs=70`).

## Notes

- The graphify graph (`.planning/graphs/graph.json`) is WARN-only and auto-rebuilt by the `.husky/post-commit` hook on any `apps/`/`packages/` commit, so no manual `graphify update` was needed; BM25 + `.vault-meta/*` are local gitignored artifacts.
- All wiki text is durable domain/code facts — no operational "audit in progress" text.
