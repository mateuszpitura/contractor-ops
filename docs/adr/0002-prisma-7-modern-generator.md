# 2. Prisma 7 with the modern `prisma-client` generator

Date: 2026-05-17
Status: Accepted

## Context

Prisma 7 ships two client generators:

1. The legacy `prisma-client-js` generator — emits a single bundled
   client to `node_modules/.prisma/client`, with monolithic types that
   `tsc` re-parses on every typecheck.
2. The modern `prisma-client` generator (general availability in Prisma
   7) — emits split per-model types into a configurable output path,
   importable via standard ESM, with tree-shakable types and better
   support for monorepo deduplication.

Our `packages/db` is consumed by `api`, `auth`, `worker`, scripts, and
seed tooling. With the legacy generator, every `tsc --noEmit` run in any
consumer re-typechecks the entire client surface — a measurable cost in
a large schema (~80 models) repeated across 4 apps + 15 packages.

The trade-off: the modern generator currently produces roughly **~2×
the type-volume** of the legacy generator due to its split-per-model
emission strategy. Total typecheck wall time per package goes up; total
typecheck wall time **across the monorepo** comes down once tRPC router
splitting amortises the cost.

## Decision

We use the **modern `prisma-client` generator** in
`packages/db/prisma/schema.prisma` with `output =
"../src/generated/client"`, ESM-only, no preview-feature opt-ins beyond
what is GA in Prisma 7.

We do **not** revert to `prisma-client-js`. The decision is anchored by:
- tRPC router splitting (55 routers across 7 domain folders) reduces
  per-router type pressure.
- A planned set of narrow type aliases (`Pick<Prisma.OrgGetPayload, …>`)
  for hot tRPC outputs to keep client bundle types small.
- Better long-term forward compatibility with Prisma's roadmap (driver
  adapters, Edge runtime, etc. are first-class in the new generator).

## Consequences

**Good**
- Tree-shakable types — client bundles only what consuming code
  references.
- First-class ESM, no CJS interop shims.
- Aligned with Prisma's forward roadmap (adapters, Edge support).
- Predictable output path under `packages/db/src/generated/client` makes
  Docker layer caching straightforward.

**Bad**
- ~2× tsc cost per package vs. legacy generator. Mitigated by router
  splitting + narrow type aliases.
- Some third-party tooling that special-cases `node_modules/.prisma`
  (older Sentry integrations, some IDE plugins) needs explicit
  configuration to find the new output path.
- Generator changes between Prisma minor releases have historically
  shipped subtle type differences — pin the Prisma version and review
  the diff on every upgrade.
