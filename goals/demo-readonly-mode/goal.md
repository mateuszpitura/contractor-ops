# Goal — Demo read-only mode

When a context is demo (`DEMO_MODE=true` globally, or the session org is in the env-controlled `DEMO_ORG_IDS` list), block every tRPC **mutation** across `appRouter` + `portalAppRouter` (queries pass; per-procedure `meta.allowInDemo` opts out) and skip all real org outbound (KSeF/ZATCA/Peppol/HMRC, email, webhooks, payments) at the service layer. Demo status is env-controlled only — never inferred from mutable `metadata.profile`. The UI surfaces a demo banner + a friendly i18n toast (en/de/pl/ar) on blocked actions. Read everything, write nothing, send nothing.

## Shared understanding
See [`facts.md`](./facts.md) — the testable outcomes (approved via Plannotator).

## Execution plan
See [`plan.md`](./plan.md) — ordered steps, files, and per-step verification (approved via Plannotator).

## Done condition
- With `DEMO_MODE=true` or a session whose org is in `DEMO_ORG_IDS`: every tRPC mutation across `appRouter` + `portalAppRouter` returns `FORBIDDEN`/`DEMO_READ_ONLY` except allowlisted; all queries succeed. A non-demo session mutates normally (no regression).
- Demo orgs trigger no real outbound from cron/service paths (each chokepoint guarded + skip-logged).
- `organization.getCurrent` exposes `isDemo`; web-vite shows a DEMO banner + i18n toast (en/de/pl/ar, RTL-correct).
- `pnpm typecheck --filter=@contractor-ops/api`, scoped `@contractor-ops/api` tests, and `pnpm check:no-process-env` all green; no `console.*`, no raw `process.env`.
