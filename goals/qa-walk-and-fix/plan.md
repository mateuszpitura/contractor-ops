# Plan — QA walk-and-fix

## Solution approach (brief)

A walk-then-fix loop that drives every view in every state with a mix of `agent-browser`, Playwright, and the Playwright MCP server. Each iteration produces a dated REPORT under `goals/qa-walk-and-fix/findings/<iso-date>/` (cluster summaries + per-route Markdown sheets + JSON index + final-success screenshots). Findings are clustered, fixed in priority order, committed atomically, and the walk re-runs. Loop terminates when the latest REPORT has zero findings AND every walked view has a clean final screenshot.

Seed data comes from the existing `packages/db/scripts/seed-dev.ts` runner (reused, extended only if existing profiles miss a needed state) plus a new `apps/cms/scripts/seed-qa.ts` for Payload content. Two extra Better Auth fixture users are seeded with credentials written to `.env` so the walk can swap roles. Public-API parity is verified against the existing OpenAPI spec for the seeded org.

## Step 1 — Seed coverage audit

- Read `packages/db/scripts/seed-dev.ts` profiles (`empty`, `solo`, `small`, `medium`, `huge`, `showcase`, `all`) and map each tenant entity to a state.
- Map every walked route to the entity states it needs.
- Files: `packages/db/scripts/seed-dev.ts` (read only at this step).
- Output: `goals/qa-walk-and-fix/seed-coverage.md` — table of route × required state × profile that satisfies it.
- Verification: every state in §"States covered per view" of `facts.md` is reachable from at least one existing profile.

## Step 2 — Seed gap fill (only if Step 1 finds gaps)

- Add the minimum required rows to `seed-dev.ts` under the chosen profile (extend `showcase` rather than introducing a new `qa` profile if possible).
- Add the three required orgs (`qa-default-org`, `qa-empty-org`, `qa-stress-org`) — likely as separate `--orgs` entries inside the chosen profile.
- Files: `packages/db/scripts/seed-dev.ts`, `packages/db/scripts/README.md`.
- Verification: `pnpm -F @contractor-ops/db tsx scripts/seed-dev.ts --profile=<chosen> --confirm --seed=qa-walk` produces a fresh DB with the three orgs and seeded users; row counts match the expected matrix.

## Step 3 — Better Auth fixture users

- Extend the chosen profile to create three fixture accounts and write their credentials to `.env` (keys `QA_ADMIN_EMAIL`, `QA_ADMIN_PASSWORD`, `QA_ACCOUNTANT_EMAIL`, `QA_ACCOUNTANT_PASSWORD`, `QA_CONTRACTOR_EMAIL`, `QA_CONTRACTOR_PASSWORD`).
- Mirror those keys (empty) into `.env.example`.
- Files: `packages/db/scripts/seed-dev.ts`, `.env.example`.
- Verification: `pnpm seed:qa && grep -c "QA_ADMIN_EMAIL=" .env` → 1; login works through Playwright global-setup with each role.

## Step 4 — Payload CMS seed

- Author `apps/cms/scripts/seed-qa.ts` (mirrors `seed-admin.ts` pattern): connect via `getPayload({ config })`, idempotently upsert 2 Authors + 2 Categories + 3 Tags + 5 Posts × 4 locales + 4 LegalDocuments + 8 Media assets.
- Wire into a new repo-level `pnpm seed:qa` script that calls both `seed-dev.ts` (with the chosen profile) AND `seed-qa.ts` against the CMS DB.
- Files: `apps/cms/scripts/seed-qa.ts`, `apps/cms/package.json` (add `seed:qa` script), root `package.json` (add `seed:qa` that fans out).
- Verification: `pnpm seed:qa` from a clean DB produces the expected Payload row counts (`pnpm -F @contractor-ops/cms exec payload find …`); 4 locales return non-empty post lists.

## Step 5 — Route registry

- Author `goals/qa-walk-and-fix/routes.ts` (TypeScript module so the walker can `import` it) enumerating every URL the walk visits, with metadata: `app`, `role`, `requiresEntity`, `notes`, plus modal triggers per route.
- Source: directory walk of `apps/web/src/app/[locale]/**/page.tsx`, `apps/landing/src/app/[locale]/**/page.tsx`, plus the `apps/cms` admin paths (`/admin`, `/admin/collections/<slug>`, `/admin/collections/<slug>/<id>`).
- Files: `goals/qa-walk-and-fix/routes.ts`, `goals/qa-walk-and-fix/README.md`.
- Verification: `tsx goals/qa-walk-and-fix/routes.ts --print` lists every page under the three apps; nothing referenced by a `<Link>` in source code is missing from the registry.

## Step 6 — Walk orchestrator

- Author `goals/qa-walk-and-fix/walk.ts` — the orchestrator that drives the iteration loop. Combines Playwright (for parallel multi-viewport screenshots), the Playwright MCP server (for interactive exploration during fixes), and `agent-browser` (for live confirmation by me while inspecting findings).
- Capabilities required:
  - Per role, per locale, per theme, per viewport: open every route, exercise every primary interaction, capture console / network / axe / screenshot.
  - Modal/sheet/popover traversal: triggered from each parent route via `routes.ts` metadata.
  - Forced loading: route interception to delay queries by 1.5s.
  - Forced error: route interception to return 500 / network failure on the route's main query.
  - Mobile viewport (375), desktop (1440), portrait tablet (768).
  - Redact secrets in screenshots / reports (mask any DOM region matching `data-secret`, `[name=password]`, integration "show key" panels).
- Output writer: `goals/qa-walk-and-fix/findings/<iso-date>/REPORT.md` + per-route Markdown sheets + JSON index + screenshots tree.
- A repo-level script `pnpm qa:walk` invokes the orchestrator.
- Files: `goals/qa-walk-and-fix/walk.ts`, `playwright.qa.config.ts` (new, at repo root or `apps/web/`), root `package.json` (`qa:walk` script).
- Verification: `pnpm qa:walk --dry-run` prints the matrix of route × state × locale × theme × viewport without opening a browser; `pnpm qa:walk --route=/contractors` runs only that route end-to-end and writes a single-route REPORT.

## Step 7 — First walk

- Run `pnpm qa:walk` against the freshly seeded DB.
- Iterate findings into `goals/qa-walk-and-fix/findings/<iso-date>/REPORT.md`.
- Cluster findings by surface (header / sidebar / table / modal / form / typography / status / theme / RTL / a11y / network / console / i18n).
- Files: write-only into `goals/qa-walk-and-fix/findings/`.
- Verification: REPORT exists; cluster counts non-zero (expected on first run); JSON index lists screenshots for every walked combination.

## Step 8 — Fix loop

- For each cluster in priority order (BLOCKER → HIGH → MEDIUM → LOW):
  1. Pick the cluster.
  2. Fix the cluster end-to-end across all affected files (`apps/web`, `apps/landing`, `apps/cms`, `packages/ui`).
  3. Run repo gates: `pnpm -r typecheck`, `pnpm -F @contractor-ops/web test`, `pnpm -F @contractor-ops/landing build`, `pnpm -F @contractor-ops/cms typecheck`.
  4. Re-run the walk **only on the affected routes** (`pnpm qa:walk --routes=route-a,route-b`) to confirm the cluster is gone.
  5. Atomic commit titled `fix(<surface>): <cluster summary>`.
- After every cluster batch (≤ 5 commits) run the full walk to catch regressions.
- Files: across all three apps + `packages/ui`.
- Verification per commit: gates pass, walk on affected routes shows the cluster removed.

## Step 9 — Chaos / "act as human" pass

- Add a chaos suite to the orchestrator (`walk.ts --chaos`) that exercises the edge-case scenarios in §"Chaos / 'act as a human' pass" of `facts.md`:
  spam-click, whitespace / emoji / large-input form fuzz, double-trigger modals, back/forward mid-mutation, refresh on dynamic routes, mid-session locale + theme swap, network drop, file-drop type rejection, empty multi-step wizard.
- Each scenario writes a Markdown finding with the reproducible steps and a screenshot.
- Files: `goals/qa-walk-and-fix/chaos.ts` (or extend `walk.ts`).
- Verification: `pnpm qa:walk --chaos --route=<x>` exits 0 with no findings once fixed for each scenario per route.

## Step 10 — Public API parity

- Author `goals/qa-walk-and-fix/public-api-check.ts` that:
  - Loads the OpenAPI spec from `apps/public-api`.
  - Issues a `2xx`-expected request per documented endpoint using a seeded admin token from the `qa-default-org`.
  - Compares response against the documented schema.
- Discrepancies become findings under cluster `public-api`.
- Files: `goals/qa-walk-and-fix/public-api-check.ts`, plus any spec / impl fixes in `apps/public-api`.
- Verification: `pnpm qa:walk --public-api` exits 0 with no findings; responses + requests stored alongside screenshots.

## Step 11 — Final clean walk + artifact freeze

- Run the full walk one last time on a fresh seed.
- Confirm the latest REPORT contains zero findings.
- Generate `goals/qa-walk-and-fix/findings/<iso-date>/SUMMARY.md` — the human-reviewable index of every captured success screenshot, organised by app → route → modal.
- Verification: latest REPORT has `Findings: 0`; SUMMARY.md links to every screenshot; `pnpm -r typecheck && pnpm -r build && pnpm -r test` green; `pnpm i18n:parity` green.

## Files / systems touched (summary)

- `packages/db/scripts/seed-dev.ts` — extend profile / fixture users.
- `apps/cms/scripts/seed-qa.ts` — new Payload seeder.
- Root `package.json`, `apps/cms/package.json` — `seed:qa` and `qa:walk` scripts.
- `.env.example` — new `QA_*` keys.
- `playwright.qa.config.ts` — new Playwright project (optional but likely useful).
- `goals/qa-walk-and-fix/` — `routes.ts`, `walk.ts`, `chaos.ts`, `public-api-check.ts`, `findings/<iso-date>/…`, `README.md`.
- Fixes will land across `apps/web`, `apps/landing`, `apps/cms`, `packages/ui` and possibly `apps/public-api`.

## Risks + open questions

- **Risk: seed bloat slows iteration.** `qa-stress-org` (300+ contractors, 1000+ invoices) plus the multi-region writes may push seed runtime past tolerable. Mitigation: keep the stress org optional behind a flag, default the loop to `qa-default-org`, only seed the stress org once before the pagination pass.
- **Risk: `agent-browser` + Playwright in the same loop fight over Chromium instances.** Mitigation: orchestrator picks one driver per route; Playwright for batched screenshots, `agent-browser` only when I attach manually mid-loop.
- **Risk: Better Auth seed writes plaintext passwords to `.env`.** Mitigation: passwords are randomly generated at seed time, are local-only fixture credentials, are gitignored (`.env` is already in `.gitignore`), and never appear in `.env.example`.
- **Risk: Payload local API requires the CMS to be running.** Mitigation: `seed-qa.ts` uses `getPayload({ config })` directly so it does not need a running server, just access to `CMS_DATABASE_URL`.
- **Risk: forcing 5xx on a query may trigger background telemetry alarms.** Mitigation: Sentry DSN unset in `.env` for the walk; route interception flagged so the error boundary's reporting hook is a no-op.
- **Risk: blog routes are static-exported with placeholder slugs.** Walking them returns the placeholder page only. Mitigation: walk against `pnpm dev` (SSR mode), not the static-exported build, when checking blog routes.
- **Risk: overlap with `comprehensive-dev-seed`, `ui-consistency-sweep`, `unified-loading-skeletons` goals.** Mitigation: those goals own the underlying fixes; this goal owns the walk, the report, and the chasing-to-zero. Findings that map to an upstream goal are filed under that goal's cluster and resolved by editing files those goals already enumerate.
- **Open question: does Playwright MCP install cleanly in this monorepo?** Need to validate `npx @playwright/mcp` resolution before committing to it in `walk.ts` — fallback to vanilla Playwright if not.
- **Open question: how to mask integration "show key" UI regions reliably across themes?** Need a `data-secret` opt-in on the producing components; otherwise the orchestrator's redaction would be a per-component allowlist.
