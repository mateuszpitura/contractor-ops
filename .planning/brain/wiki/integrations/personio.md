---
title: Personio
type: integration
tags: [personio, hris, sync]
source_commit: f0779951
verify_with:
  - packages/integrations/src/adapters/personio-adapter.ts
updated: 2026-07-05
---

# Personio

## Purpose

Personio HRIS adapter for the two-way sync ([[domains/hris-sync]]). Pulls people/contracts/departments/custom attributes; pushes CO business events as attribute updates. Gated by `integration.personio-sync` (dark until credentials land).

## Auth

Proprietary **client-credentials BEARER** (NOT RFC-6749 OAuth) — `supportsOAuth=false`, KSeF-shaped. A valid cached `accessToken` short-circuits the mint, so the adapter is fully testable against the recorded fixture with zero credentials. Live mint reads `PERSONIO_CLIENT_ID` / `PERSONIO_CLIENT_SECRET` via `getServerEnv()` (no raw `process.env`).

## Flow

- `listEmployees` — GET `/v2/persons` with offset/limit ≤ 200 pagination + `updated_since` delta, under the shared ≤200 req/min token-bucket limiter (`hris-rate-limiter.ts`). `safeParse` every page (attribute-scoped credentials silently omit unpermitted fields — absence is normal, never an error).
- `pushEmployeeEvent` — PATCH the resolved person's attribute, threading `outboxEventId` as the `Idempotency-Key`.

## Invariants

- API **v2** only (v1 deprecates 2026-07-31).
- 200 req/min is MEDIUM-confidence community data; the limiter is conservative so a tighter real limit still passes — verify against the contract at enablement.
- Registered in the HEAVY lazy tier (`register-all.ts`); `getAdapter('personio')` resolves after `loadHeavyAdapters()`.

## Enablement

Create a Personio API v2 client-credentials app → set `PERSONIO_CLIENT_ID`/`PERSONIO_CLIENT_SECRET` → flip `integration.personio-sync` APPROVED per org. See `.planning/EXTERNAL-ENABLEMENT.md`.
