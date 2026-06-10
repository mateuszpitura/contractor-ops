---
title: Source 72-PATTERNS
type: meta
tags: [source, raw, patterns]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/72-PATTERNS.md
updated: 2026-06-10
---

# Raw source: 72-PATTERNS.md

## Purpose

GSD phase 72 pattern notes — integration and hook consolidation patterns.

**Immutable copy:** `.planning/brain/.raw/72-PATTERNS.md`

## Summary

Integration provider sections, status-mapping factory, shared hook abstractions.

## Wiki synthesis

- [[integrations/framework-core]]
- [[integrations/jira]]
- [[integrations/linear]]

## When to re-ingest

Large integration refactor touching multiple providers.

## Verify live

```bash
semble search "use-integration-provider-section"
```

## Agent mistakes

- Duplicating per-provider hooks without factory pattern
- Editing `.raw/` copy
