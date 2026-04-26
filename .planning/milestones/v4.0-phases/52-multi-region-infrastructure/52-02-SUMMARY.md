---
phase: 52-multi-region-infrastructure
plan: 02
subsystem: infra
tags: [r2, cloudflare, storage, multi-region, data-residency]

requires:
  - phase: 52-multi-region-infrastructure
    provides: DataRegion enum, tenant context with region field

provides:
  - Regional R2 storage service with per-region bucket routing
  - getRegionalBucket function for bucket name resolution
  - Auto-resolution from tenant context for request-scoped calls

affects: [document-router, portal-router, ocr-extraction, esign-orchestrator]

tech-stack:
  added: []
  patterns: [regional-bucket-routing, tenant-context-auto-resolution]

key-files:
  created:
    - packages/api/src/services/regional-storage.ts
    - packages/api/src/services/__tests__/regional-storage.test.ts
  modified:
    - packages/api/src/services/r2.ts
    - packages/validators/src/env.ts
    - .env.example

key-decisions:
  - "Legacy r2.ts functions fallback to R2_BUCKET_NAME → R2_BUCKET_NAME_EU for backward compatibility"
  - "Regional storage auto-resolves region from tenant context when not explicitly provided"
  - "Same Cloudflare account credentials shared across regional buckets"

patterns-established:
  - "Regional bucket routing: getRegionalBucket(region) maps region to env var"
  - "Explicit region param available for background jobs without tenant context"

metrics:
  files_created: 2
  files_modified: 3
  tests_added: 10
  tests_passing: 10
---

# Plan 52-02: Regional R2 File Storage

## What was built

Created a region-aware R2 storage service that routes file uploads and downloads to the correct regional bucket based on org data region. The existing single-bucket r2.ts was updated with a backward-compatible fallback. New `regional-storage.ts` provides `getRegionalBucket`, `createRegionalPresignedUploadUrl`, `createRegionalPresignedDownloadUrl`, `headRegionalObject`, and `deleteRegionalObject`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | bfe5fb0 | Add regional R2 file storage service |

## Deviations

None.

## Self-Check: PASSED

- [x] Regional storage service selects correct R2 bucket per region (10 tests passing)
- [x] Auto-resolution from tenant context works
- [x] Backward-compatible fallback in legacy r2.ts
- [x] Env validation for R2_BUCKET_NAME_EU and R2_BUCKET_NAME_ME
