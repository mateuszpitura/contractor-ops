---
title: Source 82-PATTERNS
type: meta
tags: [source, raw, patterns]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/82-PATTERNS.md
updated: 2026-06-10
---

# Raw source: 82-PATTERNS.md

## Purpose

GSD phase 82 pattern notes — compliance, schema-driven fields, bulk actions.

**Immutable copy:** `.planning/brain/.raw/82-PATTERNS.md`

## Summary

Schema-driven compliance UI, bulk action hooks, data-table patterns from phase 82.

## Wiki synthesis

- [[domains/compliance-dashboard]]
- [[patterns/data-tables-workbench]]
- [[patterns/validators-boundaries]]

## When to re-ingest

Compliance schema or bulk-action framework change.

## Verify live

```bash
semble search "schema-driven-compliance"
```

## Agent mistakes

- Hardcoding jurisdiction fields instead of schema-driven components
- Bulk mutations without audit log
