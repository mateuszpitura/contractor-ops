---
title: Source 70-PATTERNS
type: meta
tags: [source, raw, patterns]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/70-PATTERNS.md
updated: 2026-06-10
---

# Raw source: 70-PATTERNS.md

## Purpose

GSD phase 70 pattern notes — historical implementation patterns for reference during ports.

**Immutable copy:** `.planning/brain/.raw/70-PATTERNS.md`

## Summary

Step-10 port patterns, hook extraction, table/workbench conventions from phase 70 work.

## Wiki synthesis

- [[patterns/web-vite-data-layer]]
- [[patterns/data-tables-workbench]]

## When to re-ingest

Only if re-running phase 70-class port at scale.

## Verify live

```bash
test -f .planning/brain/.raw/70-PATTERNS.md && wc -l .planning/brain/.raw/70-PATTERNS.md
```

## Agent mistakes

- Treating phase snapshot as live CI rules (prefer `patterns/ci-guards` + lint scripts)
- Mass-reading raw PATTERNS instead of wiki synthesis
