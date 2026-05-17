# Architecture Decision Records

This directory records significant architectural decisions for
`contractor-ops` using the [Michael Nygard ADR format][nygard]. Each ADR
captures the **context** that forced a decision, **the decision itself**,
and the **consequences** (good and bad) we accept by making it.

ADRs are immutable once accepted. If a decision is later reversed or
superseded, write a new ADR and update the older one's status to
`Superseded by ADR-NNNN`. Do not edit the original Context/Decision text —
that history is the value.

## Index

| ID | Title | Status |
|---|---|---|
| [0001](./0001-monorepo-pnpm-turbo.md) | pnpm + Turborepo monorepo | Accepted |
| [0002](./0002-prisma-7-modern-generator.md) | Prisma 7 with the modern `prisma-client` generator | Accepted |
| [0003](./0003-region-split-eu-me.md) | Multi-region data residency: EU + ME Neon split | Accepted |
| [0004](./0004-feature-flags-unleash-jurisdiction-guard.md) | Feature flags via self-hosted Unleash + jurisdiction guard | Accepted |

## How to add a new ADR

1. Copy the most recent ADR file as a template, e.g.
   `cp 0004-...md 0005-<short-slug>.md`.
2. Increment the number, fill in `Date`, set `Status: Proposed` while in
   review, flip to `Accepted` on merge.
3. Keep ADRs concise (~30-60 lines). Link out to deeper docs, PRDs, or
   code paths rather than copying them.
4. Add the new row to the index table above.
5. Open a PR — CODEOWNERS will route it to `@contractor-ops/platform`
   when the change touches infra-relevant paths.

### Template

```markdown
# N. Title in title-case

Date: YYYY-MM-DD
Status: Proposed | Accepted | Deprecated | Superseded by ADR-NNNN

## Context

Why is this decision needed? What forces are at play (technical,
organisational, regulatory)? What constraints bound the solution space?

## Decision

What did we choose? State it crisply, in present tense ("we use X").

## Consequences

What becomes easier? What becomes harder? What follow-on work does this
imply? List both the good and the bad — ADRs that only list upsides are
not honest.
```

[nygard]: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
