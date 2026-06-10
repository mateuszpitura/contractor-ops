---
title: Source MEMORY
type: meta
tags: [source, raw]
source_commit: 70f5782d78e33ba98c82e4ccda2cd4b0b4aff216
verify_with:
  - .planning/brain/.raw/MEMORY.md
  - .planning/MEMORY.md
updated: 2026-06-10
---

# Raw source: MEMORY.md

## Purpose

Living invariants from GSD phases — authority for decisions that override stale session memory.

**Immutable copy:** `.planning/brain/.raw/MEMORY.md` (snapshot); **live:** `.planning/MEMORY.md`

## Summary

Phase-derived rules, feature-flag keys, jurisdiction notes, process decisions.

## Wiki synthesis

- [[decisions/memory-authority]]
- [[decisions/arch-decisions]]
- Relevant [[patterns/_index]] bullets

## When to re-ingest

After GSD phase completes with new invariant → update live MEMORY + optional wiki page.

## Verify live

```bash
head -40 .planning/MEMORY.md
```

## Agent mistakes

- Trusting cross-repo Claude memory over MEMORY.md + CLAUDE.md
- Bulk-ingesting milestones into wiki
