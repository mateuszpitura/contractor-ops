---
title: Gulf and Saudization
type: domain
tags: [gulf, uae, saudization, me]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/api/src/routers/gulf/
  - apps/web-vite/src/components/saudization/
updated: 2026-06-09
---

# Gulf and Saudization

## Purpose

UAE free-zone assignment CRUD, Saudization config/headcount/dashboard, GULF-10 drift overrides — region-aware ME (`gulf` router).

## Entry points

| Piece | Path |
|-------|------|
| Router | `gulf` — `packages/api/src/routers/gulf/` |
| UI free-zone | `components/contractors/free-zone/` |
| UI saudization | `components/saudization/` |
| Peppol AE | [[integrations/peppol]] |

## Invariants

- ME regional DB + R2 routing — [[patterns/multi-region-db]]

## Related

- [[contractors-engagements]]
- [[integrations/zatca]]
- [[tax-and-wht]]

## Verify live

```bash
semble search "gulfRouter"
```

## Agent mistakes

- EU tenant assumptions for Gulf-specific fields
