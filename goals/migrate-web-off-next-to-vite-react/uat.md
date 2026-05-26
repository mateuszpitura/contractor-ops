# UAT — Migrate apps/web off Next.js to Vite + React

Gating checklist for plan.md Step 15. Every item must show `[x]` before
plan.md Step 16 (cutover) starts. Any unresolved blocker stops the
cutover, regardless of the green tests on the new stack.

Sign-off requires:
- one Engineering reviewer + one Product reviewer per row,
- the related observability link or screenshot referenced in the row's
  "evidence" column,
- `git rev-parse HEAD` of the build under test recorded in the **Build**
  section below.

## Build under test

- **Commit**: `<git rev-parse HEAD>`
- **Date (UTC)**: `<YYYY-MM-DD HH:MM>`
- **Test stack URLs**: `https://app-next.contractor-ops.com` /
  `https://api-next.contractor-ops.com`
- **Sentry release**: `<release id>`
- **PostHog dashboard**: `<link>`
- **Cutover procedure**: see [`cutover-runbook.md`](cutover-runbook.md)
- **Grace period log**: see [`grace-period.md`](grace-period.md)

## Per-domain functional UAT

For each row run the listed flow end-to-end against the test stack in
each of the four locales (`en`, `pl`, `ar`, `de`) where applicable.

### Auth surface (Step 10 batch 1)

- [ ] `/<locale>/login` — email + password sign-in, error states (bad
      password, locked account), Turnstile challenge fires on bot UA.
- [ ] `/<locale>/register` — sign-up with verification email; magic-link
      click lands on the correct locale.
- [ ] `/<locale>/forgot-password` + `/<locale>/reset-password` round
      trip.
- [ ] `/<locale>/verify-email` resend + success.
- [ ] `/<locale>/invite/[token]` — token validated, accept/decline both
      paths.
- [ ] Cross-subdomain cookie sticks across `app.* ↔ api.*` after sign-in
      (DevTools → Application → Cookies; Domain = `.contractor-ops.com`,
      SameSite=None, Secure).
- [ ] Better Auth rate-limit fires on 11th failed sign-in within 1 min
      (`Retry-After` header present).

### Dashboard shell (Step 10 batch 2)

- [ ] `/<locale>` dashboard index renders with no console errors, KPIs
      load via tRPC, sidebar + topbar + theme switcher + locale switcher
      all functional.
- [ ] Sign-out clears cookies on both subdomains and redirects to
      `/<locale>/login`.

### Contractors (Step 10 batch 3)

- [ ] `/<locale>/contractors` — list, pagination, search, filter
      chips.
- [ ] `/<locale>/contractors/[id]` — detail, edit, soft-delete.
- [ ] `/<locale>/contractors/[id]/engagements/[engagementId]` —
      open / close, contract attachment.
- [ ] `/<locale>/contractors/[id]/engagements/[engagementId]/classification`
      — IR35 / SVF / DRV / ZATCA flows; chain assessment continuation.

### Invoices (Step 10 batch 4)

- [ ] `/<locale>/invoices` — list, filter, drill-in.
- [ ] `/<locale>/invoices/[id]` — render PDF preview from R2 signed URL,
      download, mark paid.
- [ ] `/<locale>/invoices/intake` — upload, OCR start, classification.
- [ ] `/<locale>/invoices/intake/[id]` — review extracted fields, edit,
      approve.

### Payments / Approvals / Contracts / Equipment (Step 10 batch 5)

- [ ] `/<locale>/payments` — list, batch CSV export, mark settled.
- [ ] `/<locale>/approvals` — pending queue, approve/deny round-trip,
      Slack / Teams notify still fires.
- [ ] `/<locale>/contracts[/[id]]` — list, e-sign initiation (DocuSign
      or Autenti depending on jurisdiction).
- [ ] `/<locale>/equipment[/[id]]` — list, assignment, depreciation.

### Workflows / Time / Organization (Step 10 batch 6)

- [ ] `/<locale>/workflows[/[id]]` — instance list, run drill-in, task
      progression.
- [ ] `/<locale>/workflows/templates[/[id]|/new]` — template author flow.
- [ ] `/<locale>/time[/[contractorId]]` — timesheet entry, weekly summary.
- [ ] `/<locale>/organization/{cost-centers,projects,teams}` — CRUD on
      each.

### Classification (Step 10 batch 7)

- [ ] `/<locale>/classification` — root dashboard, jurisdiction filter.
- [ ] `/<locale>/classification/expert-help` — request → expert response
      thread.

### Settings (Step 10 batch 8)

- [ ] `/<locale>/settings` — index loads, every subnav clickable.
- [ ] `/<locale>/settings/{calendar,e-invoicing,e-invoicing/log,integrations/zatca,members,payments,tax,workflow-roles}` —
      each subpage loads, mutates a setting, persists.

### Portal (Step 10 batch 9)

- [ ] `/<locale>/portal/login` + `/<locale>/portal/login/verify` —
      contractor-side magic-link auth.
- [ ] `/<locale>/portal/invoices/submit` + `/<locale>/portal/invoices/submit/success`
      — contractor submits invoice, sees confirmation.
- [ ] `/<locale>/portal/{invoices,contracts,documents,equipment,time,payments,settings}`
      — read paths render.

### Admin (Step 10 batch 10)

- [ ] `/<locale>/admin/boe-rate` (and every other admin tool) loads under
      the `platform_operator` role and refuses non-operator sessions.

### Public / legal

- [ ] `/<locale>/legal/{privacy,privacy/[jurisdiction],terms,sub-processors,breach-notification}`
      renders without auth (regulators / prospects access).

## Webhooks — signed payload replay

For each provider replay a known-signed payload against
`https://api-next.contractor-ops.com/webhooks/<provider>` and assert
the row in `audit_log` reflects the call.

- [ ] `/webhooks/stripe` — payment_intent.succeeded.
- [ ] `/webhooks/storecove` (Peppol BIS) — document.received.
- [ ] `/webhooks/inpost` — shipment.status_changed.
- [ ] `/webhooks/[provider]` for each of: `slack`, `resend`, `linear`,
      `jira`, `notion`, `confluence`, `docusign`, `autenti`.
- [ ] `/webhooks/_process` — drain a QStash queued message.
- [ ] `/ksef/_sync` — Polish KSeF inbound + outbound roundtrip.
- [ ] `/peppol/{inbound,outbound,poll}` — each branch.
- [ ] `/zatca/_submit` — Phase-2 B2B submit.
- [ ] `/teams/messages` — bot receive.
- [ ] `/oauth/[provider]/{start,callback}` — fresh consent flow per
      provider.
- [ ] Tampered signature rejected with 401 (verifies the HMAC port).
- [ ] Replay protection: same payload submitted twice returns
      idempotent 200 on the second call (no double audit row).

## Crons — manual trigger

Each entry below is a job inside `apps/cron-worker`. Trigger the handler
locally (`pnpm --filter @contractor-ops/cron-worker exec node -e
"...invoke runJob..."`) or wait one tick; verify last-success
timestamp appears at `http://<worker>:4100/health` and the expected
side-effect lands.

- [ ] `token-refresh` (15 min) — at least one integration token re-issued.
- [ ] `data-purge` (daily 03:00 UTC) — soft-deleted rows hard-deleted past
      retention window.
- [ ] `exchange-rates` (daily 06:00 UTC) — `exchange_rate` table updated
      with today's rates.
- [ ] `boe-rate-poll` — BoE base-rate row updated.
- [ ] `classification-reassessment-triggers` — re-assessment queued for
      contractors past their cadence.
- [ ] `classification-economic-dependency` — economic-dependency alerts
      fire as expected.
- [ ] `org-definition-sync` — Jira / Linear project rows upserted.
- [ ] `inpost-status-poll` — shipment statuses refreshed.
- [ ] `trial-notifications` — trial-expiring email rendered + sent.
- [ ] `reminders` (+ `drv-clearance-expiries`) — DRV clearance expiry
      reminders fire.
- [ ] `job-health` — self-health row recorded.
- [ ] `late-interest-pdf-reaper` — expired PDFs removed from R2.

## Observability / non-functional

- [ ] Sentry error rate over 24 h ≤ pre-cutover baseline (capture screenshot).
- [ ] PostHog active-user count over 24 h ≥ pre-cutover baseline ± 5%.
- [ ] Web Vitals p75 over 24 h: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1
      (capture PostHog dashboard).
- [ ] No CSP violation reports posted to `/csp-report` over 24 h
      (after the 48-h report-only soak).
- [ ] `/health` returns 200 under k6 ramp (50 → 200 concurrent users,
      5-min window) without 5xx.
- [ ] Render `api-server` autoscale fires at target CPU/memory and
      stabilises within 5 min.

## Security spot-checks

- [ ] CORS preflight from `https://evil.example` blocked (no
      `Access-Control-Allow-Origin` echoed).
- [ ] State-changing POST to `/api/<anything>` without an `Origin`
      header returns 403 from the csrf-origin guard (logs include the
      requestId).
- [ ] State-changing POST from foreign origin returns 403.
- [ ] /api/auth/** + /webhooks/** still exempt from the origin guard.
- [ ] Rate-limit headers (`X-RateLimit-Limit`, `Remaining`, `Reset`)
      present on every /api/* response; 11th request inside 1 min on
      /api/portal/* returns 429 + `Retry-After: 60`.
- [ ] Better Auth session cookie has `HttpOnly; Secure; SameSite=None;
      Domain=.contractor-ops.com; Path=/`.
- [ ] Penetration smoke: tampered `x-forwarded-for` does NOT bypass
      per-IP rate limit (proxy-addr extraction confined to
      TRUSTED_PROXIES list).

## Sign-off

- **Engineering**: `<name>` — `<date>`
- **Product**: `<name>` — `<date>`
- **Security review (if material change)**: `<name>` — `<date>`

## Blockers log

Document any item that fails — even if the team intends to fix it later
— so the cutover decision is made with full visibility.

| Item | Severity | Owner | Status | Notes |
|------|----------|-------|--------|-------|
| `<row id>` | P0 / P1 / P2 | `<name>` | open / fixed | … |
