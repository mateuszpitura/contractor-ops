# Launch cut-over runbook

Step-by-step for cutting the marketing landing + analytics over to
production. Order matters — Stripe → PostHog → DNS → smoke.

## 1. Seed Stripe products + prices

Edit `scripts/stripe/products.seed.json` if pricing has changed, then:

```bash
# Test mode (sk_test_*)
pnpm tsx scripts/stripe/seed-products.ts

# Live mode (sk_live_*) — requires CONFIRM=YES
CONFIRM=YES pnpm tsx scripts/stripe/seed-products.ts --live
```

The script is idempotent. Stale prices are deactivated (never deleted)
so the audit trail stays intact. After running, every Stripe product
visible in the dashboard MUST have these metadata fields:

- `tier` — `STARTER | PRO | ENTERPRISE`
- `market` — `PL | DE | INTL | UK | UAE | SA`
- `included_seats`
- `credits_included`
- `sort_order`

The landing build refuses to start in production if any active product
is missing them.

## 2. Configure environment variables

In Render → web + worker-cron + landing services:

```
# server-side
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://eu.i.posthog.com

# client-side (landing + web public envs)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

The legacy `STRIPE_PRICE_STARTER/PRO/ENTERPRISE` env vars are still
read by the in-app billing UI (`plan-comparison-grid.tsx`) until that
component is swapped to the tRPC `billing.listPricing` query. Map them
to your Polish-market (PL) price ids so the in-app side keeps working
during the transition.

## 3. Wire the Stripe webhook

Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://app.contractor-ops.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.*`,
  `invoice.paid`, `invoice.payment_failed`,
  `invoice.payment_action_required`, `charge.refunded`
- Reveal the signing secret → paste into `STRIPE_WEBHOOK_SECRET`.

## 4. Configure PostHog dashboard

1. Create the launch funnel from `docs/marketing/POSTHOG-FUNNEL.md`.
2. Create the experiments (one per market):
   - `landing_market_pl_hero_v1` — variants `control`, `A`, `C`
   - `landing_market_de_hero_v1` — variants `control`, `B`, `C`
   - `landing_market_intl_hero_v1` — variants `control`, `A`, `B`
   - `landing_market_uk_hero_v1` — variants `control`, `B`, `C`
   - `landing_market_uae_hero_v1` — variants `control`, `C`, `D`
   - `landing_market_sa_hero_v1` — variants `control`, `C`, `D`
3. Pin the funnel dashboard with breakdowns by market, variant,
   utm_source, utm_campaign.

## 5. Verify trial cron

The web app already schedules `/api/cron/trial-notifications` daily at
09:00 UTC (`apps/web/worker-cron.mjs`). Confirm the worker is running
in Render after deploy.

## 6. DNS cut-over

In your DNS provider, point:

- `contractor-ops.com` and `www.contractor-ops.com` → landing service
  (Render Static Site).
- `app.contractor-ops.com` → web app.
- `*.app.contractor-ops.com` → web app (wildcard for org subdomains).
- `blog.contractor-ops.com` → blog (unchanged).
- `api.contractor-ops.com` → web app (tRPC endpoint).

PostHog distinct-id cookie is scoped to `.contractor-ops.com` so the
landing → app handoff works across these subdomains without changes.

## 7. Smoke check

```bash
BASE_URL=https://contractor-ops.com bash scripts/landing-smoke.sh
```

Should print `OK` for every market and pricing page.

## 8. Synthetic funnel run

End-to-end manual test from a fresh browser:

1. Visit `/pl?utm_source=manual&utm_campaign=launch` — verify cookie
   banner appears.
2. Accept consent → check PostHog Live → see `$pageview` with
   `utm_source=manual`.
3. Click any Pricing CTA → Stripe checkout opens with the correct
   currency for the locale.
4. Complete checkout (test card 4242 4242 4242 4242) → app loads.
5. Add the first contractor → PostHog event `first_contractor_added`
   fires.
6. PostHog funnel dashboard shows the run end-to-end with `market=PL`.

## 9. Rollback

If anything fails verification, swap DNS back to the previous CMS /
landing target. The new landing artefacts are static and can be
re-deployed independently of the web app.
