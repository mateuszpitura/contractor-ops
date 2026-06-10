---
title: Feature flags
type: pattern
tags: [feature-flags, unleash]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - packages/feature-flags/src/registry.ts
  - packages/feature-flags/README.md
updated: 2026-06-09
---

# Feature flags

## Purpose

Self-hosted Unleash OSS behind `@contractor-ops/feature-flags` wrapper. Keys declared in code registry, toggled in Unleash UI.

## Entry points

| Piece | Path |
|-------|------|
| Registry | `packages/feature-flags/src/registry.ts` |
| Server evaluate | `evaluate()` from package |
| Client | `useFlag()`, `<Feature>` |
| tRPC introspection | `featureFlags` router |
| Classification gate | `module.classification-engine` in `root.ts` |

## Invariants

- **Never** call Unleash SDK directly from apps
- Jurisdiction defaults live in registry — not Prisma
- Module load evaluation in `root.ts` for classification — server restart needed for router registration change; middleware does per-request defense-in-depth

## Related

- [[integrations/unleash-flags]]
- [[domains/classification-ir35]]
- [[structure/api-routers-catalog]]

## Verify live

```bash
grep module.classification-engine packages/feature-flags/src/registry.ts
```

## Agent mistakes

- Adding flag keys only in Unleash UI without registry entry
- Using flags for domain config that belongs in Prisma
