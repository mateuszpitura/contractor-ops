---
title: BambooHR
type: integration
tags: [bamboohr, hris, sync, oauth]
source_commit: f0779951
verify_with:
  - packages/integrations/src/adapters/bamboohr-adapter.ts
updated: 2026-07-05
---

# BambooHR

## Purpose

BambooHR HRIS adapter for the two-way sync ([[domains/hris-sync]]). Same pull/push surface as Personio. Gated by `integration.bamboohr-sync` (dark until credentials land).

## Auth

**OAuth 2.0** — `supportsOAuth=true`, Jira-shaped (`getOAuthConfig` names `BAMBOOHR_CLIENT_ID`/`BAMBOOHR_CLIENT_SECRET`, `redirectPath: /api/oauth/bamboohr/callback`; `exchangeCodeForTokens`/`refreshToken` via `withResilience` + `parseJsonResponse`). The legacy Basic-auth API key is deprecated for B2B and NOT used. Env via `getServerEnv()`.

## Flow

- `listEmployees` — GET `/v1/employees/directory` (un-paginated) → the orchestrator diffs the full snapshot via `syncHash` (no `updated_since`).
- `pushEmployeeEvent` — POST the mapped field, threading `outboxEventId` as the `Idempotency-Key`.

## Custom-attribute gate (D-06)

The custom-attribute contract is UNVERIFIED. `normalizeBambooDirectory(payload, includeCustom)` **withholds every non-standard field** unless `BAMBOOHR_CUSTOM_ATTR_VERIFIED` is set (read via a `try/catch`-wrapped `getServerEnv()` so a missing env degrades to standard-only, never throws). Standard-field sync ships now; the custom-attr path (and its `it.skipIf` test) activates when the contract is confirmed.

## Enablement

Create a BambooHR OAuth 2.0 app → set `BAMBOOHR_CLIENT_ID`/`BAMBOOHR_CLIENT_SECRET` → flip `integration.bamboohr-sync` APPROVED per org. Set `BAMBOOHR_CUSTOM_ATTR_VERIFIED` once the custom-attribute contract is confirmed. The live authorize/token endpoints are company-subdomain specific. See `.planning/EXTERNAL-ENABLEMENT.md`.
