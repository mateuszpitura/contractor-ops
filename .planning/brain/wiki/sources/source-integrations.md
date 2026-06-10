---
title: Source INTEGRATIONS
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/INTEGRATIONS.md
  - .planning/codebase/INTEGRATIONS.md
updated: 2026-06-10
---

# Raw source: INTEGRATIONS.md

## Purpose

Canonical provider matrix: OAuth, webhooks, credentials, env vars per external system.

**Immutable copy:** `.planning/brain/.raw/INTEGRATIONS.md`

## Summary

16+ providers — e-invoicing, IdP, productivity, Stripe, QStash, Neon/R2, Unleash, couriers, gov APIs.

## Wiki synthesis

- [[integrations/_index]]
- Per-provider pages under `wiki/integrations/`

## When to re-ingest

New OAuth provider or webhook route added.

## Verify live

```bash
ls .planning/brain/wiki/integrations/*.md | wc -l
semble search "integration registry"
```

## Agent mistakes

- Calling Unleash SDK directly from apps (use `@contractor-ops/feature-flags`)
- Missing webhook signature verify on new routes
