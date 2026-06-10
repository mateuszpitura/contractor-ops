---
title: Source CONCERNS
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/CONCERNS.md
  - .planning/codebase/CONCERNS.md
updated: 2026-06-10
---

# Raw source: CONCERNS.md

## Purpose

Known tech debt, security gaps, and operational risks — agents should not re-discover as surprises.

**Immutable copy:** `.planning/brain/.raw/CONCERNS.md`

## Summary

Infisical stub, InPost webhook fail-open, Sentry boundary gap, region leakage watchlist.

## Wiki synthesis

- [[decisions/tech-debt-hotspots]]
- [[integrations/infisical-secrets]]
- [[integrations/couriers]]
- [[integrations/sentry]]

## When to re-ingest

New HIGH concern from audit or security review.

## Verify live

```bash
cat .planning/codebase/CONCERNS.md | head -60
```

## Agent mistakes

- Shipping production secrets without Infisical wiring
- Copying fail-open webhook patterns from debt list
