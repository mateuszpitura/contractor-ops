---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 08
subsystem: wiki
tags: [documentation-follows-code, wiki, us-tax-year-end-filing, irs-iris, memory]
requirements-completed: [US-FORM-03, US-FORM-04, US-FORM-05, US-FORM-07]
completed: 2026-07-05
---

# Phase 86 Plan 08: Documentation-follows-code closure

**Satisfied the documentation-follows-code mandate for Plans 86-04/06/07: a new US
year-end-filing domain page + two IRS integration pages + structure/pattern
catalog updates + log/hot/index + MEMORY invariants; `pnpm check:wiki-brain`
passes with no NEW drift.**

## What was updated

### New pages
- `wiki/domains/us-tax-year-end-filing.md` — the full loop (Purpose / Flow /
  Entry points / UI surface / Agent mistakes) with `verify_with` pointing at the
  real shipped source (packages/iris, the services, both routers, the cron, the
  web-vite surfaces).
- `wiki/integrations/irs-iris.md` — ManualDownload default (no TCC), dark A2A
  (`module.iris-efile`), the SOR XSD bundle → non-throwing `BUNDLE_UNAVAILABLE`
  pre-enablement, the one ack parser (six statuses, both paths).
- `wiki/integrations/irs-eservices-tin-matching.md` — the adapter seam (mock
  default + dark SSRF-safe live client), advisory-never-block mismatch, last-4
  cache.

### Catalog + pattern updates
- `structure/api-routers-catalog.md` — `tax1099` staff namespace (now "4
  namespaces") + the portal 1099 consent/download procedures; added the two
  routers to `verify_with`; bumped `source_commit` (resolves the root.ts drift).
- `structure/prisma-schema-areas.md` — the five models (`Form1099Nec`,
  `IrisSubmission`, `IrisAck`, `Tax1099Threshold`, `StateFilingConfig`).
- `structure/cron-jobs.md` — the notify-only `year-end-1099-reminder`.
- `structure/packages.md` — the `packages/iris` builder/validator + 1042-S sibling
  + `BUNDLE_UNAVAILABLE`.
- `patterns/feature-flags.md` — `module.iris-efile` as the single dark A2A gate
  (no `iris-a2a-transmit` flag).
- `integrations/_index.md` + `index.md` — linked the new pages.

### log / hot / MEMORY
- `wiki/log.md` — Phase 86 synthesis entry; `wiki/hot.md` — overwritten frontmatter
  + a US year-end-filing discovery pointer.
- `.planning/MEMORY.md` — the phase's load-bearing invariants (tax-year-keyed
  threshold, CORRECTED=supersede, ManualDownload default + dark A2A single gate,
  one ack parser both paths, TIN mismatch never blocks, missing-XSD =
  `BUNDLE_UNAVAILABLE`, notify-only cron, Copy B only / last-4 only).

## Verification
- `pnpm check:wiki-brain` — **0 errors** (the root.ts↔catalog drift is resolved;
  the remaining WARN is the pre-existing multi-`source_commit` spread across the
  whole wiki, not introduced here).
- BM25 index + contextual-prefix chunks rebuilt (local `.vault-meta` artifacts,
  gitignored).
