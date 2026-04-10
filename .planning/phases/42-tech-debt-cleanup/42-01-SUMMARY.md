---
phase: 42
plan: 1
subsystem: onboarding-import
tags: [tech-debt, retry-role, onboarding]
key-files:
  modified:
    - packages/api/src/routers/onboarding-import.ts
    - packages/validators/src/onboarding-import.ts
metrics:
  tasks: 2
  files_modified: 2
  commits: 2
---

# Plan 42-01 Summary: Fix hardcoded retry role in onboarding import

## What was built

Added `role` field to the `failedItems` array in both the `ImportJob` TypeScript interface and the `importProgressOutputSchema` Zod schema. The original role is now persisted when an invitation fails during import, and `retryFailedItem` uses the stored role instead of hardcoding `'readonly'`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1-2 | 0abad5c | Add role field to interface, schema, and push site; use stored role in retry |
| fix | 09206f8 | Add role field to project failure path (second push site) |

## Deviations

- Found a second `failedItems.push` site in the project failure path (line 386) that also needed the `role` field. Added `role: "readonly"` as default since projects don't have an associated role.

## Self-Check: PASSED

- [x] ImportJob interface includes `role: string` in failedItems
- [x] Zod schema includes `role: z.string()` in failedItems
- [x] `person.role` persisted at push time
- [x] `failedItem.role || "readonly"` used in retryFailedItem
- [x] No hardcoded `role: "readonly"` in retry path (only as fallback)
- [x] TypeScript compilation passes for both packages
