# Facts — QA walk-and-fix

## Tooling (per CLAUDE.md)

- **Automated matrix:** `goals/qa-walk-and-fix/walk.ts` (Playwright headless) drives every route × locale × theme × viewport × registered surface. Output: flat `findings/<run-id>/<locale>/*.png`, `manifest.json`, `SUMMARY.md`, `REPORT.md`.
- **Manual triage:** `agent-browser` (`open` → `snapshot -i` → `click @e1`) is for inspecting findings after a walk — not for running the full matrix.
- The existing Playwright a11y + functional projects remain CI guardrails alongside `pnpm qa:walk`.
- Code discovery during the loop uses `semble search` first, falling back to grep only for exhaustive literal scans (per memory rule).
- Library / API documentation lookups go through `ctx7` (Context7 MCP), not stale knowledge.
- The existing Playwright a11y + functional projects (`playwright.functional.config.ts`, `playwright.a11y.config.ts`) keep running as CI guardrails; a new `playwright.qa.config.ts` may be added if it helps drive the loop, but it is not required.

## Seed infrastructure

- The walk uses the existing `packages/db/scripts/seed-dev.ts` runner with the `showcase` profile (or a richer profile if `comprehensive-dev-seed` lands first); no parallel seed script is introduced.
- The `--profile=qa` profile is added to `seed-dev.ts` only if the existing profiles do not already exercise every state we need; otherwise the closest existing profile is reused.
- `pnpm seed:qa` is a thin wrapper that runs `seed-dev` with the chosen profile against the dev DB, then runs a small Payload seeder under `apps/cms/scripts/seed-qa.ts` for blog content. Both share the same `SEED_DEV_ALLOWED_HOST` guard.
- Better Auth accounts created by the seed are written to `.env` under `QA_ADMIN_EMAIL` / `QA_ADMIN_PASSWORD`, `QA_ACCOUNTANT_EMAIL` / `QA_ACCOUNTANT_PASSWORD`, `QA_CONTRACTOR_EMAIL` / `QA_CONTRACTOR_PASSWORD` so the walk can switch roles.
- The seed produces three orgs in the same database so the walk can hop between non-empty / empty / large states without re-seeding:
  - `qa-default-org` — every entity in every status (default walk target).
  - `qa-empty-org` — zero contractors / invoices / payments / equipment (empty-state walk target).
  - `qa-stress-org` — 300+ contractors, 1000+ invoices, 200+ payment-runs (pagination / virtualization walk target).
- Payload seed produces: 5 published Posts per locale across at least 2 Categories and 3 Tags, 2 Authors with avatars + bios + socials, 4 LegalDocuments (`privacy` + `terms` × 2 jurisdictions), 8 Media assets.

## Walk harness — what `agent-browser` does on every view

- For each route × state × locale × theme combination, the harness performs:
  - `agent-browser open` to the URL, with the storage state for the chosen role.
  - `agent-browser snapshot -i` to get interactive refs, then exercises every primary action (CTA, table row, tab, dialog open/close, dropdown, form submit, search field, filter chip, pagination, theme toggle, locale switch, command palette ⌘K).
  - Capture of: console errors, unhandled rejections, network 4xx (other than expected auth bounces) and any 5xx, asset 404s, React hydration warnings, axe-core violations.
  - One **final success screenshot** per surface at viewports mobile / tablet / desktop in light AND dark themes, stored under `goals/qa-walk-and-fix/findings/<run-id>/<locale>/{index}-{routeId}-{viewport}-{theme}[-{variant}].png` (see `manifest.json`).
  - The screenshots are the deliverable artifact: when the goal is done, every view / subview / page / modal / dialog / dropdown / popover / sheet has a captured frame the human can scroll through to confirm parity.

## Modals, sheets, dropdowns

- Modals (`Dialog`), sheets, popovers, dropdowns, command palette, and sonner toasts are walked as first-class views — each gets its own screenshot under its parent route.
- The harness explicitly opens every modal trigger discoverable from `snapshot -i` (new-contractor wizard, payment-run wizard, contractor detail tabs, invoice detail panel, settings sub-panels, share dropdown, notifications popover, etc.).

## States covered per view

- Default / loaded.
- Empty (use `qa-empty-org`, empty tab, no-results search).
- Loading (Playwright route interception slow-replay, or `agent-browser` network throttling) — skeleton + refetch overlay frames.
- Error (forced API failure for the route's main query) — error boundary or inline error UI must render the project's standard error surface.
- Disabled / read-only (accountant on payments, contractor on dashboard, etc.).
- Mobile viewport (375 wide) — sidebar / sheet collapse, no horizontal scroll, sticky header offsets correct.
- RTL — `ar` locale renders without clipped text, every sticky element stays anchored to the inline-end side, every margin/padding/border uses logical CSS.
- Focus-visible — every interactive element shows the design-system focus ring; no `outline: none` without a replacement.
- Dark theme — every page renders with `data-intensity` cascade honored.

## Chaos / "act as a human" pass

- After the deterministic walk passes, a second pass exercises edge-case behavior the way a real user would:
  - Spam-click the same button rapidly — the UI debounces or disables; no double-submission.
  - Submit forms with leading/trailing whitespace, mixed casing, emoji, RTL strings inside an LTR locale, ≥ 512-char inputs, deliberately invalid payloads.
  - Open the same dialog from two different triggers in quick succession — no double-mount, no stuck overlay.
  - Navigate forward / backward via the browser controls during a form mutation — no broken state.
  - Refresh on dynamic pages (e.g. `/contractors/<id>/contracts`) — no 404, no lost selection state where state is supposed to persist via the URL.
  - Open a route, switch locale mid-session — no key leak, no untranslated fallback, no layout drift.
  - Open a route, switch theme mid-session — no FOUC, no token mismatch.
  - Network drop mid-mutation — UI shows the project's standard offline / retry surface, no console error.
  - Drag a file onto an `<input type=file>` plus drop a non-allowed type — proper rejection toast, no console crash.
  - Empty multi-step wizards: open, click Next without filling anything, validation messages render in the active locale.

## Locale matrix

- The walk covers all four locales: `en`, `pl`, `de`, `ar`.
- `ar` is the canonical RTL pass — failure to render correctly is a blocker.
- Untranslated keys (raw `Namespace.key` leaking into the UI) count as a finding.
- Date / number / currency formatting uses the locale's Intl conventions; the same numeric value rendered on two pages must show the same separators and currency placement in the same locale.

## Console + network hygiene

- Zero `console.error` / `console.warn` from app code on every walked route (third-party noise from React DevTools / Next.js HMR is filtered).
- Zero unhandled promise rejections.
- Zero React hydration mismatch warnings.
- Zero "missing key" React warnings.
- Network: only expected 4xx (e.g. unauthenticated probes); no 5xx; no asset 404s; no requests to deprecated endpoints.
- A request inventory per route is emitted alongside the screenshot; a request that does NOT terminate within the route's idle window (`networkidle`) is a finding.

## Visual unification — deep checks

- All headers / typography across web + landing + cms use the shared token pairing in `packages/ui/src/styles/tokens.css`.
- Every table on `apps/web` uses `AtelierTableShell` + `DataTableBody` + `SectionLabel` (existing `ui-consistency-sweep` + `unified-loading-skeletons` goals are the source of truth — divergences are findings).
- Status pills use `AtelierStatusPill` variants only; ad-hoc colored badges are findings.
- Empty states use `AtelierEmptyState` with a domain illustration; the in-table empty row is removed where the upstream goals require it.
- Loading states follow the canonical skeleton patterns from `unified-loading-skeletons`.
- Focus rings use the shared token (`--ring`) with the same width/offset on every element.
- Cards use the intensity-tier-appropriate glass class (`exhibition` / `atelier` / `workbench`).
- Spacing snaps to the 8-pixel grid for cards, list rows, page padding, dialog content.
- Sticky elements preserve the same top offset across pages.
- Buttons use canonical variants from `packages/ui/src/components/shadcn/button.tsx`; no one-off Tailwind button utility blocks.

## A11y depth

- Every page passes axe-core WCAG 2.2 A + AA on the walked viewports.
- Every interactive element is keyboard-reachable in source order; focus trap correctness is verified for every modal / dialog / sheet (Tab cycles inside; Shift+Tab cycles backward; Esc closes; focus returns to opener).
- Every form input has a programmatic label; every error message is announced via `aria-describedby` or `role="alert"`.
- Color contrast for body text, secondary text, and disabled text passes 4.5:1 / 3:1 thresholds in both themes.
- No element relies on color alone to communicate state (status pill icon + text required).

## i18n depth

- `pnpm i18n:parity` and `pnpm i18n:code-coverage` pass with zero missing keys after the loop.
- Pluralisation forms (PL / DE / AR) render the correct ICU variant for `0`, `1`, `2`, `5` counts on every list page.
- Date pickers (calendar, date-time range picker) show locale-correct first-day-of-week, month names, AM/PM vs 24h.
- The `<html lang>` and `<html dir>` attributes match the active locale on every walked route.

## Public API parity (apps/public-api)

- For the seeded `qa-default-org`, every documented endpoint in `apps/public-api`'s OpenAPI spec returns a 2xx with a payload that matches the documented schema for a representative entity.
- Endpoints documented but unimplemented (or implemented but undocumented) surface as findings — the spec and the runtime must agree.
- Authentication paths (API key issuance, scope checks, rate-limit headers) behave as documented for a seeded admin token.
- A short walk hits each public endpoint via `agent-browser` / curl-equivalent from inside Node, captures the response, and stores it next to the screenshots so the human can review request × response together.

## Iteration + done condition

- The work is executed as a `walk → fix → re-walk` loop driven by a new repo-level `pnpm qa:walk` script that orchestrates `agent-browser` + axe + the screenshot writer.
- Each iteration produces a dated REPORT in `goals/qa-walk-and-fix/findings/<iso-date>/REPORT.md` with cluster summaries, per-route sheets, and a JSON index of screenshots.
- Findings are clustered, then fixed in priority order: blocker → high → medium → low.
- After each batch of fixes, the walk re-runs and a new REPORT is written.
- The goal is **done** only when the latest REPORT contains zero findings, `manifest.coverage.missing === 0`, and every registered surface has a success PNG under `findings/<run-id>/<locale>/` (indexed in `manifest.json` + `SUMMARY.md`).
- Every fix lands as an atomic commit whose message names the cluster.
- Repo-wide gates stay green between iterations: `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r test`, plus the existing Playwright a11y + functional configs.

## Fix scope — allowed

- Any UI / component / style / layout / i18n / a11y change across `apps/web`, `apps/landing`, `apps/cms`, `packages/ui`.
- Any backend / tRPC / Payload / validator change required to make a UI state reachable, deterministic, or testable.
- Public-API spec or implementation tweaks to bring docs and runtime into alignment.
- Test infrastructure: new specs, fixtures, axe rules.
- Seed additions inside `seed-dev.ts` and the new `apps/cms/scripts/seed-qa.ts`.

## Fix scope — must NOT change

- Better Auth flow logic beyond primitive swaps.
- Production legal-pages content beyond render-bug fixes.
- Cross-region replication / RLS policies / audit-log writes.
- Any in-progress work owned by another open goal — those goals are upstream sources of truth, not parallel work; surface their items as findings and let the upstream goal land them.

## Out of scope

- New product features beyond what is needed to make existing views render coherently.
- Performance budgets, Lighthouse score targets, bundle-budget enforcement (separate goals).
- Migrating off `output: 'export'` for `apps/landing` (separate scope; the blog routes already ship a static-export-safe placeholder).
- OCR pipeline behaviour — OCR is not yet wired to an LLM, so OCR-driven invoice extraction is excluded from the walk. Pages that *mention* OCR (the credit ledger widget, billing references) are walked for visual correctness only.
- External-integration end-to-end flows — `/settings/integrations` and equivalent surfaces are walked for visuals, internal tRPC contract, and bug-spotting only. No OAuth round-trips against real providers (DocuSign, Linear, Jira, Slack, KSeF, ZATCA, Peppol, DATEV, Mistertango, Revolut, Stripe, Resend). External-integration scenarios are queued for the **next** goal which will add per-integration scenarios on top of this seed.

## `.env` handling

- The walk reads `.env` to discover which integrations are configured locally (so the seeded surfaces match the configured environment) but **never** logs, prints, screenshots, or commits secret values.
- Findings reports redact any token-shaped value (`*_API_KEY`, `*_SECRET`, `*_TOKEN`, password fields) before being written to disk.
- Screenshots that would otherwise capture secrets visible in the UI (admin debug panes, integration "show key" UIs) mask the secret region before being saved.
