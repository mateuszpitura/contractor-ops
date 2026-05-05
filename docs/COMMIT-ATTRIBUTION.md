# Commit Attribution — Phase 2/3 Audit Run

**Last updated:** 2026-05-05
**Owner:** Platform / changelog automation
**Companion:** [`docs/RUNBOOK-PHASE-2-3-DEPLOY.md`](RUNBOOK-PHASE-2-3-DEPLOY.md)

## Why this document exists

During the Phase 2 / Phase 3 cleanup pass several fixer agents ran in parallel against the same working tree. lint-staged formats files on `git add`, and when one agent's reformat raced another agent's `git commit`, files staged for commit-A could end up bundled into commit-B. The result: **the final code in HEAD is correct on every line**, but a handful of commit subject lines under-describe what they actually contain.

This is a cosmetic problem, not a behavioural one. We did not rewrite history (destructive on shared `main`); the entries below are flagged so that:

1. Changelog generation tools that key off subject prefixes (`feat`, `fix`, scope) can be hand-corrected when generating release notes.
2. Future bisect / blame work can find the "real" home of a finding when the obvious commit subject points elsewhere.
3. The next merge to main can call this out in the PR description so reviewers don't double-report what looks like missing work.

## Misattributed commits

| Commit SHA | Subject says | Actually contains |
|---|---|---|
| `8c79880c` | `feat(observability): F-OBS-03 thread requestId/traceparent across QStash hops` | F-OBS-03 (the requestId / traceparent threading work described in the body) **plus** B-A2's defense-in-depth RLS work for **F-DB-04** — `packages/db/src/rls.ts` (+72) and the related test additions in `packages/db/src/__tests__/rls.test.ts` (+83) ended up in this commit's tree. |
| `e26dd055` | `feat(observability): F-OBS-08 add Sentry beforeSend PII scrubber` | F-OBS-08 (the `apps/web/src/lib/sentry-scrub.ts` walker + 3-runtime config wiring) **plus** **F-SEC-05 / F-SEC-21** portal `OAuthChallenge` work — `packages/api/src/services/oauth-challenge.ts` (new), `packages/db/prisma/schema/oauth-challenge.prisma` (new), the OAuth callback / start route additions, and the regenerated Prisma client output for `OAuthChallenge`. |
| `eda86f75` | `fix(integrations): F-INT-10 Infisical token rotation` | F-INT-10 (the Infisical client TTL + single-flight refresh + `INFISICAL_TOKEN_TTL_MS` env tunable) **plus** **F-SEC-09** portal `set-session` HMAC work — `apps/web/src/app/api/portal/set-session/route.ts` adds the `signature` field on the session bootstrap payload + a server-side HMAC verifier (`createHmac` / `timingSafeEqual`), and the `apps/web/src/app/[locale]/(portal)/portal/login/verify/page.tsx` callsite was updated to send it. |
| `dfea68b1` | `feat(integrations): add arctic dep + oauth-arctic shim for new OAuth providers` | The arctic dep + `packages/integrations/src/services/oauth-arctic.ts` shim **plus** **F-SCALE-01** export framework foundation (`packages/api/src/services/exports/*` — registry, handlers, tests, the typed `Export` table generated client output, and the `/api/exports/_process` + `/api/exports/[exportId]/download` Next.js routes) **plus** **F-SCALE-08** CSV-streaming rewrite of `packages/api/src/lib/csv.ts` and the five report mutations in `packages/api/src/routers/core/report.ts` **plus** the `react-email` template additions in `packages/api/src/services/email/templates/export-ready.tsx`. |
| `a79e7245` | `fix(integrations): F-INT-13 + F-INT-21 webhook dedup index + Stripe late-delivery` | F-INT-13 + F-INT-21 (as described in the body — providerEventId unique constraints + Stripe 24 h late-event guard) **plus** **F-SEC-17** rightmost-trusted-proxy parsing — `apps/web/src/middleware.ts` (+82 lines) wires `proxy-addr` against the `TRUSTED_PROXIES` env var, and `apps/web/package.json` (+4) adds the dependency. |
| `063a36d7` | `fix(security): F-SEC-16 strip taxId from global search + require contractor:read` | F-SEC-16 (the `packages/api/src/routers/core/search.ts` change — drop `taxId` from subtitle, gate with `requirePermission`) **plus** **F-SCALE-03** public-API rate-limit fail-closed work — `apps/public-api/src/lib/rate-limiter.ts` (+30) returns 503 + `Retry-After` in production when Upstash is unavailable, instead of falling open to the in-memory limiter. |
| `608d7dc8` | `feat(outbox): F-ASYNC-03 transactional outbox foundation` | F-ASYNC-03 (the `OutboxEvent` table + drain consumer + handler registry, all described in the body) **plus** **F-ASYNC-04** notification dedup row plumbing — `packages/api/src/services/billing-service.ts` (+124 / -51) threads the F-INT-04 idempotency tuple through to a notification dedup key per business operation, which is the consumer-side counterpart to the `Notification.dedupKey` unique constraint. |

## How to read this

- The "Subject says" column is the literal message. The "Actually contains" column lists everything in the diff that **goes beyond** what the subject describes — the over-staged work from the lint-staged race.
- For changelog generation, treat each row as if it were two (or more) commits. The actual file content is correct on `main`; only the attribution is off.
- `git show <sha> --stat` and `git show <sha>` will both confirm the over-staged contents at any time.

## Why we did not rewrite history

- `main` is shared by other branches and CI; force-pushing rewrites breaks every open PR's base.
- The final tree is correct, so the cost (broken bisect on rebased branches, broken external commit links, broken PR rebasing) outweighs the benefit (cosmetic).
- Changelog generation is a lightweight place to compensate; we do that there.

## Recommendation for future parallel-fixer runs

- Stage and commit one file at a time per agent, OR
- Have agents use isolated `git worktree` checkouts (the in-repo `EnterWorktree` tool) so lint-staged formatters cannot cross-contaminate.

The race only manifests when two or more agents commit within the same lint-staged debounce window. A single sequential run never triggers it.
