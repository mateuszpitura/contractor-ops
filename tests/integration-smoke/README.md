# Integration smoke tests

Live round-trips against **real provider sandboxes** — the cutover safety net
that mocked (MSW) unit tests can't provide. MSW proves we parse a recorded
shape; smoke proves the live contract, our credentials, and our configured
callback URLs still work.

## How to run

```sh
# all-skipped clean pass (no creds) — proves the harness wires up:
pnpm test:integration:smoke

# real calls — opt in + provide per-provider sandbox creds:
RUN_LIVE_SMOKE=1 \
  STRIPE_SECRET_KEY=sk_test_... \
  SLACK_BOT_TOKEN=xoxb-... SLACK_TEST_CHANNEL_ID=C... \
  pnpm test:integration:smoke
```

Each suite **self-skips** unless `RUN_LIVE_SMOKE=1` and its required env vars
are set (see `harness.ts`). These files are `*.smoke.ts`, never `*.test.ts`,
so `turbo test` / `pnpm test` never pick them up.

## Rules for a new smoke

1. Wrap in `smokeDescribe(provider, requiredEnv, fn)`.
2. Do the **smallest** real round-trip.
3. Be **self-cleaning + idempotent** (create-then-delete). Never touch shared
   or persistent provider state. Identity-mutating smokes (GWS / Okta / Entra
   deprovision) target **disposable test identities only**.

## CI

`.github/workflows/integration-smoke.yml` runs this on a nightly cron +
`workflow_dispatch`, matrixed per provider, reading creds from a CI secret
group. It is **not** wired into the PR pipeline — a sandbox outage must not
block merges.

## Coverage (extend over time)

| Provider | File | Creds | Status |
|----------|------|-------|--------|
| Stripe | `stripe.smoke.ts` | `STRIPE_SECRET_KEY` (test) | ✅ scaffolded |
| Slack | `slack.smoke.ts` | `SLACK_BOT_TOKEN`, `SLACK_TEST_CHANNEL_ID` | ✅ scaffolded |
| VIES | `vies.smoke.ts` | none (public) | ✅ scaffolded |
| Storecove | _todo_ | `STORECOVE_API_KEY` | ⬜ |
| InPost | _todo_ | sandbox key | ⬜ |
| Teams (Bot Emulator) | _todo_ | `AZURE_BOT_APP_ID/SECRET` | ⬜ |
| Google Workspace | _todo_ | SA JSON + `GWS_TEST_DOMAIN` | ⬜ |
| HMRC | _todo_ | sandbox id/secret | ⬜ |
| Resend → Gmail-MCP inbox assert | _todo_ | Resend key + test mailbox | ⬜ |
