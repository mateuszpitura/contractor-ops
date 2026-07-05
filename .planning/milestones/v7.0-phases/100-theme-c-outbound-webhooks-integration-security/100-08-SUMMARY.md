# 100-08 SUMMARY — subscription management API + Settings UI + scope

**Wave:** 4 · **Status:** complete (auto-verified; human visual gate deferred to founder). `webhook-subscription`
3/3 GREEN; `webhooks` component 4/4 GREEN; data-layer + dialog-pattern + i18n parity OK; typecheck clean.

## Backend

- `packages/api/src/routers/core/webhook-subscription.ts` — session-authed, admin-gated
  (`requirePermission({ organization: ['update'] })`) `webhookSubscriptionRouter`: **create** (SSRF-checks
  the URL → `generateWebhookSecret` → `encryptWebhookSecret` → reveal-once), **list**, **update**
  (re-SSRF-checks on URL change), **rotateSecret** (reveal-once, old invalid immediately), **delete**,
  **testFire** (queues a synthetic `webhook.test` delivery), **listDeliveries** (last 100). Per-tier cap via
  `TIER_WEBHOOK_SUBSCRIPTION_CAP`; every mutation `writeAuditLog({ resourceType:'WEBHOOK_SUBSCRIPTION',
  ipAddress, userAgent })`; the secret is encrypted at rest and never returned except at create/rotate.
  Registered in `root.ts` (`webhookSubscription`) via the core barrel.
- `PUBLIC_API_SCOPES` gains `webhooks:manage` — the API-key scope picker can now select it.

## UI (Settings → Developer → Webhooks)

- Container + view `webhooks-tab.tsx`; the ONLY tRPC boundary is `webhooks/hooks/use-webhooks-tab.ts`
  (list query + create/delete/testFire/rotateSecret mutations). Data-table (`webhooks/data-table.tsx`) with
  loading skeleton / empty state / rows (url, event count, active-paused badge, last success/failure, row
  menu: test-fire, rotate-secret, delete). Create dialog (url + HTTPS warning + 16-event multiselect +
  include_pii toggle + reveal-secret-once with copy, DialogBody/DialogFooter). Delete AlertDialog.
  Rotated-secret reveal. Registered in `settings-tabs.ts` (`webhooks` tab, org:update) + the settings page.
- i18n: `Settings.tabs.webhooks` + a full `Settings.webhooks` block added to en/de/pl/ar (English values;
  native de/pl/ar review deferred — EXTERNAL-ENABLEMENT #9). `i18n:parity` GREEN.

## Sequencing note

`secret-store.ts` (listed in this plan) shipped in 100-06 because the dispatcher needs decrypt at dispatch;
this plan consumes `encryptWebhookSecret` on create.

## Human-verify gate (deferred to founder)

Auto-checks pass; the visual confirmation (secret shown once, HTTPS/SSRF warning fires on a bad URL, RTL/dark)
is a founder eyeball pass per the plan — the SSRF check is enforced server-side regardless.

## Verify

`pnpm --filter @contractor-ops/api test webhook-subscription` → 3/3. `pnpm --filter @contractor-ops/web-vite
test webhooks` → 4/4. `pnpm check:web-vite-data-layer` + `check:web-vite-dialog-pattern` + `i18n:parity` → OK.
`pnpm typecheck` api + web-vite → clean.
