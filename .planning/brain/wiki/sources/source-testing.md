---
title: Source TESTING
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/TESTING.md
  - .planning/codebase/TESTING.md
updated: 2026-06-10
---

# Raw source: TESTING.md

## Purpose

How tests run in monorepo: vitest via turbo, MSW patterns, package filters.

**Immutable copy:** `.planning/brain/.raw/TESTING.md`

## Summary

`pnpm test`, filtered runs, web-vite MSW, API router tests, e2e placement.

## Wiki synthesis

- [[patterns/testing-and-msw]]

## When to re-ingest

New global test harness or CI test gate.

## Verify live

```bash
pnpm test --filter=@contractor-ops/api 2>&1 | tail -5
```

## Agent mistakes

- Citing failure counts from old handoffs without running `pnpm test`
- Skipping tests to ship faster (quality > time)
