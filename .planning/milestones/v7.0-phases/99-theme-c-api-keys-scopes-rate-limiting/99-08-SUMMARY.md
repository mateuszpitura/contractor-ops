# 99-08 SUMMARY — docs-follows-code + validation sign-off + P100 handoff

**Wave:** 5 · **Status:** done

## End-to-end verification (Task 1)
- Full scoped suites GREEN: `packages/api` public-api + all six security suites (write-scope BFLA, actor,
  rotation, tier-quota, mutation-audit, flag) + `api-key` router/service/auth; `apps/public-api`
  strict-dto / openapi-doc / write-routes-dark / routes; `apps/web-vite` api-keys + key-detail-drawer.
  No write is reachable without a scope; the surface stays double-dark. Audit-log lint OK.
- Fixed a where-clause assertion in `api-key-service.test.ts` surfaced by the grace-aware `resolveByPrefix`
  (expiry + rotation-grace are now AND-composed).
- `99-VALIDATION.md` sign-off complete; every INTEG-AUTH/INTEG-API requirement maps to a GREEN test;
  `wave_0_complete: true`.

## Documentation-follows-code (Task 2)
- Rewrote **`wiki/domains/public-api-surface.md`** as the single read+write surface page (folds in the
  deferred 98-12 read-surface synthesis + the 99 write surface, keys, scopes, rotation, per-tier quota,
  actor model, sourceIp/UA audit, Developer UI, agent mistakes).
- New **`wiki/patterns/rate-limit.md`** (two-limiter model). Updated `patterns/tenant-and-audit.md`
  (API_KEY actor + actingUserId attribution + sourceIp/UA), `patterns/rbac-permissions.md` (apiKey-mode
  BFLA), `patterns/feature-flags.md` (`module.public-api` double-dark, flip = P100),
  `structure/api-routers-catalog.md` (publicApiRouter writes + apiKeyRouter rotate/ipLog/usage),
  `structure/key-services.md` (api-key-service grace + api-quota-counter + api-tier-limits). Bumped
  `source_commit` on every touched page.
- Appended the log entry, overwrote `hot.md`, and recorded the **5 durable invariants** in `.planning/MEMORY.md`
  (attribution-only actingUserId; mandatory-scope + API_KEY/sourceIp/UA audit on every write; rotation
  grace; two-limiter quota; writes stay double-dark until P100).
- `pnpm check:wiki-brain` passes (0 errors; only the pre-existing source_commit-prefix WARN). BM25 index
  rebuilt; the graphify graph is current from the earlier code commits (post-commit hook).
- **`99-100-HANDOFF.md`** — the write flag flip + un-hide + SDK-write-inclusion are Phase-100 acts after
  INTEG-SEC-01; P100 consumes `TIER_WEBHOOK_SUBSCRIPTION_CAP` + `ApiKeyIpEvent` (leak alarm);
  `_initiatePayoutForRun` + `compliance_document.create` + the migration apply stay deferred.

## Phase 99 — closed
Keys hash/rotate/revoke with audit; every write enforces a scope (BFLA); per-tier quotas apply; every
mutation audits apiKeyId+sourceIp+userAgent; the Developer page is complete; the whole write surface stays
double-dark, cleanly handed to Phase 100.
