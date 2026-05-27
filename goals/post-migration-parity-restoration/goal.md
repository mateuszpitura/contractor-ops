# Goal — Post-migration parity restoration (close every audit gap)

## Goal

Restore full migration parity by closing every gap surfaced in `goals/post-migration-parity-audit/audit-report.md` head `99584569` — all 7 open P0s, all 32 P1s, all 33 P2s, plus a review pass on the 13 sibling-agent UI polish commits that landed unreviewed on the audit branch. Production cutover is gated on this restoration; no time pressure — quality over speed per CLAUDE.md. The output is a parallel restoration-report.md mirroring audit-report.md row-for-row, with every row's status flipped to `inline-fixed (<SHA>)`, `closed-decision (<doc-ref>)`, `closed-verified-intentional`, OR `deferred (<rationale + risk-register-ref>)`.

## Shared understanding

- **Facts:** see [`facts.md`](./facts.md) — the agreed list of testable outcomes per P0 (legal CMS pipeline implementation, PostHog signup hook, SPA CSP nonce edge runtime, R2 wildcard documented acceptance + CI guardrail, Stripe webhook idempotency test, intake cross-org IDOR test + tRPC scope audit, privacy DE PDF guard verify-then-act), per P1/P2 cluster, sibling-UI review pass, and per-test final verification.

## Execution plan

- **Plan:** see [`plan.md`](./plan.md) — wave-based parallel execution (Wave 0 hygiene + sibling review → Wave 1 infra surfaces → Wave 2 5-agent parallel P0 code fixes → Wave 3 P0 wiring + cutover → Wave 4/5/6 parallel P1 clusters → Wave 7 parallel P2 cluster → Wave 8 FOLLOWUP-PRE-EXISTING-001 → Wave 9 final verification + plannotator gate). Each wave's first step is verify-then-act — the `legal.tsx` IDOR finding (audit said guard missing; router is actually IDOR-safe by construction) is the canonical reason. Open questions worth flagging up front: edge-runtime choice (Render Fastify vs Cloudflare Worker), Payload local API client presence in apps/api, ioredis vs Upstash HTTP for the legal pub/sub channel, `/api/*` prefix decision blocked on ops re-registering external publishers.

## Done condition

`goals/post-migration-parity-restoration/restoration-report.md` mirrors `audit-report.md` row-for-row, with every audit row reflected and every row's status set to `inline-fixed (<SHA>)`, `closed-decision (<doc-ref>)`, `closed-verified-intentional`, OR `deferred (<rationale + risk-register-ref>)`. No row sits `open` without an explicit deferral rationale. The 13 sibling-agent UI commits are reviewed (clean OR new `GAP-SIBLING-NNN` rows recorded). `pnpm typecheck`, all per-workspace test suites (`api-server`, `cron-worker`, `public-api`, `auth`, path-scoped `web-vite`), all quality gates (`check:web-vite-data-layer`, `check:web-vite-page-shells`, new `check:r2-iframe-sandbox`), `pnpm audit`, `pnpm security:scan`, and the full Playwright e2e suite pass on the restoration branch head. The CSP report pipeline shows zero violations against the legitimate bundle for a 48h soak after the GAP-SECURITY-001 edge-runtime cutover. The user signs off on `restoration-report.md` via `plannotator annotate ... --gate`. Production cutover proceeds.
