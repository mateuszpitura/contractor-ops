# 100-09 SUMMARY — OWASP API Top-10 gate + gated write flag-flip

**Wave:** 5 · **Status:** complete · OWASP gate GREEN (7/7); public-api write-routes-dark + openapi-doc GREEN
(15/15); api + public-api typecheck clean.

## The executable gate (INTEG-SEC-04)

`owasp-api-gate.security.test.ts` asserts each OWASP API class against the live surface:
- **BOLA** — every mutating public scope is object-scoped (`entity:verb`), never a bare wildcard.
- **BFLA** — every delivered write scope (the P99 matrix) is a member of `PUBLIC_API_SCOPES`; `webhooks:manage` present.
- **SSRF** — a private/metadata webhook URL is rejected by `assertWebhookUrlSafe`.
- **Mass-assignment** — the strict event envelope rejects an injected `secretEncrypted`/privileged key.
- **Security-misconfig** — the SSRF error surfaces a typed `reason`, never an internal stack/secret.
- **Injection** — the event catalog is a closed enum; a `'; DROP` value can never reach a query as an identifier.

## The gated flip (human-checkpoint)

**Precondition confirmed GREEN before un-hiding.** Removed `hide: true` from the **11 write routes** across the
6 delivered entities (contractor create/update, invoice create/void, payment update, paymentRun
create/transition/export, workflow create/execute, workflowTask transition) so they enter
`buildOpenApiDocument` → Scalar → SDK. **`_initiatePayoutForRun` stays deferred (never exposed).** Refreshed
the stale "double-dark / hide:true" route comments.

- `write-routes-dark.test.ts` — layer 1 (404 when the module is off, 11 routes) UNCHANGED + GREEN; layer 2
  inverted to assert the writes are now PRESENT in the spec (count === 11).
- `openapi-doc.test.ts` — the "ZERO write operations" assertion inverted to "writes present"; header comment updated.
- The per-org `module.public-api` grant is **UNCHANGED in code** (`assertPublicApiEnabled` untouched) — it is a
  manual Unleash/ops act. `EXTERNAL-ENABLEMENT.md` row #8 updated: un-hide DONE; remaining = per-org flag grant.

No unscoped mutating endpoint exists; every write keeps its mandatory `requirePermission`.

## Verify

`pnpm --filter @contractor-ops/api test owasp-api-gate` → 7/7. `pnpm --filter @contractor-ops/public-api test
write-routes-dark openapi-doc` → 15/15. Typecheck api + public-api → clean.
