# Plan — Launch readiness: landing, pricing, analytics

## TL;DR scope reality

5 markets × ≥2 A/B variants × PPP currency × PostHog Experiments + cookie-consent + multi-market routing + landing↔web pricing reconciliation **is a 4–6 week build for a solo founder**, not 3 weeks. This plan ships in **two waves**:

- **Wave 1 (launch — 3 weeks):** PL + DE + EN-international live (3 markets, not 5), PostHog flags + experiments wired, GDPR cookie consent on landing, landing/web pricing reconciled, full funnel events live, 2 A/B variants per market, EUR + PLN currencies only.
- **Wave 2 (post-launch, weeks 4–8):** UK + UAE + SA landings, AED/GBP/SAR Stripe products, PPP-adjusted prices, market-specific variants (D/E/F/G from `LANDING-AB-STRATEGIES.md`).

If the user rejects descope, plan extends to ~6 weeks total — call out before exec.

## Solution approach

1. **Treat landing's existing `i18n/locales/*.json` as the variant primitive.** Each market = locale entry + per-market message override. A/B variants live as PostHog feature-flag-gated component slots reading from market-namespaced message keys.
2. **Promote `packages/feature-flags/` (Unleash) into landing? No.** Landing is static export → server-side Unleash eval impossible. Use **PostHog feature flags + experiments** in landing only; keep Unleash for in-app. PostHog flag SDK loaded client-side; minimize flash by gating only below-fold sections OR using `loadFeatureFlags()` blocking call in root layout (acceptable LCP cost).
3. **Single pricing source of truth = Stripe API.** No hardcoded prices in code. Stripe products carry per-market metadata (`market`, `tier`, `included_seats`, `extra_seat_price_id`, `credits_included`, `period`). One typed fetcher (`packages/billing/src/pricing-fetcher.ts`) reads Stripe, normalizes into `PricingPlan[]`, caches in-process (5 min TTL) + ISR-cached at landing build. Both `apps/landing/src/lib/pricing-content.ts` and `apps/web/src/components/billing/plan-comparison-grid.tsx` consume the same fetcher. Kill divergence (Pro 49 EUR vs Pro 299 PLN) by deleting both `PLAN_CONTENT` and `PLANS` constants.
4. **Strip cross-market mentions from market-specific JSON.** Keep "global / other" fallback in `en.json` as EN-international ICP. PL/DE messages drop all non-self market references.
5. **Activation event = PostHog server-side capture.** Install `posthog-node` in `packages/api/` (or `apps/web/`), fire `first_contractor_added` from contractor.create mutation, fire `signup_completed` from Better Auth post-signup hook, fire Stripe webhook events from billing-webhook service.
6. **Cookie consent on landing.** Reuse `apps/web/src/components/layout/cookie-consent-banner.tsx` pattern; landing variant gates PostHog autocapture + session recording until consent in EU markets.

## Wave 1 — ordered steps

### Step 1 — Stripe-as-source-of-truth pricing fetcher

**Files touched:**
- New: `packages/billing/src/pricing-fetcher.ts` — typed Stripe products → `PricingPlan[]` normalizer.
- New: `packages/billing/src/types.ts` — `PricingPlan`, `Market`, `Tier`, `Period`, `Currency` types.
- `apps/landing/src/lib/stripe.ts:53-91` — delegate to `pricing-fetcher`; keep ISR caching layer.
- `apps/landing/src/lib/pricing-content.ts:32-84` — **delete `PLAN_CONTENT` fallback prices**; keep only non-price marketing content (tagline, bullets, badges) keyed by product slug.
- `apps/web/src/components/billing/plan-comparison-grid.tsx:11-82` — **delete hardcoded `PLANS`**; consume `pricing-fetcher` via server component or tRPC query.
- `packages/api/src/services/billing-constants.ts:14-58` — kept for backward compat, but `PRICE_TO_TIER_MAP` derived from Stripe metadata at runtime instead of env enumeration.
- `packages/api/src/routers/finance/billing.ts` — new tRPC query `billing.listPricing({ market })` returning fetched plans for in-app UI.

**Stripe product schema (set in Stripe dashboard or seed script):**

```
Product: contractor-ops-{tier}-{market}
  metadata:
    tier: 'starter' | 'growth' | 'scale'
    market: 'PL' | 'DE' | 'INTL'        # wave 1; UK/UAE/SA wave 2
    included_seats: '3' | '10' | '25'
    credits_included: '20' | '100' | '500'
    extra_seat_price_id: 'price_xxx'
    sort_order: '1' | '2' | '3'
  Prices (one product, multiple prices):
    price_xxx_monthly  currency: pln | eur  recurring.interval: month
    price_xxx_annual   currency: pln | eur  recurring.interval: year
```

**Fetcher behaviour:**
- Lists active Stripe products with metadata `tier` present.
- Groups by (market, tier), expands prices, surfaces monthly + annual + extra-seat.
- Validates: every active product has all required metadata keys; raises typed error at build/dev time if not.
- Caches: in-process 5 min TTL on server; ISR `revalidate: 300` on landing pages.
- No prices in code. Stripe is canonical.

**Seed script (one-off, idempotent):**
- New: `scripts/stripe/seed-products.ts` — declarative product/price spec read from a JSON file you control; runs against Stripe via `stripe.products.upsert` semantics (Stripe doesn't have upsert; script implements lookup-by-metadata then create-or-update).
- JSON file (`scripts/stripe/products.seed.json`) is your one place to edit prices/tiers before running the script. Not consumed at runtime.

**Verification:**
- `pnpm --filter @contractor-ops/billing typecheck` passes.
- Unit test: `pricing-fetcher` returns expected shape from a mocked Stripe list response.
- Integration test (test mode key): seed script runs against Stripe test mode; fetcher returns all seeded products; counts match expected (3 tiers × 3 markets × 2 periods = 18 prices wave 1).
- Manual: `/pl/pricing`, `/de/pricing`, `/en/pricing` render prices identical to Stripe dashboard.
- Manual: in-app `/billing` page shows same prices as landing for same market.
- Build-time validation: `pnpm build` for landing fails if any active Stripe product is missing required metadata.

### Step 2 — Locale → Market mapping + routing

**Files touched:**
- `apps/landing/src/i18n/config.ts:3,26-64` — extend `locales` and `localeConfigs`. Add `en` (INTL/global EN variant). Map `pl → PL`, `de → DE`, `en → INTL`. Keep `ar` configured but unlinked in nav (wave 2).
- `apps/landing/src/app/[locale]/layout.tsx` — accept market prop derived from locale.
- New: `apps/landing/src/lib/market.ts` — `localeToMarket(locale)` + `getCurrency(market)`.
- `apps/landing/src/components/navbar.tsx` — market switcher (replaces locale switcher if any).
- `apps/landing/src/app/page.tsx:6,15` — root redirect uses `Accept-Language` + IP geo hint (vercel header) to pick default market; static export means this becomes a client-side redirect from a minimal HTML stub.

**Geo detection caveat:** Landing is `output: 'export'` (`apps/landing/next.config.ts:9`) → no middleware, no edge runtime. Geo hint must come from a client-side IP lookup on first visit (e.g. `ipapi.co` or Cloudflare `cf-ipcountry` header if behind CF), cached in cookie. Add this to `apps/landing/src/app/page.tsx` as a small client component.

**Verification:**
- Visit `/pl/`, `/de/`, `/en/` — each renders correctly with own market context.
- Switching market in nav persists in cookie and updates pricing currency without losing PostHog distinct_id.
- Deep-linking to a market URL ignores geo preference.

### Step 3 — Strip cross-market mentions; rewrite per-market copy

**Files touched:**
- `apps/landing/src/i18n/locales/en.json:16,156` — neutralize (INTL variant), drop KSeF specifics from hero.
- `apps/landing/src/i18n/locales/de.json:16,156` — drop "KSeF" (PL-specific), replace with ZUGFeRD / Scheinselbständigkeit hooks per `MARKET-EXPANSION-ANALYSIS.md`.
- `apps/landing/src/i18n/locales/pl.json:16,66-67,107` — keep KSeF, drop non-PL references.
- `apps/landing/src/components/pricing/pricing-faq.tsx:32` — make "AWS Frankfurt" line conditional per market or move to per-market JSON.
- `apps/landing/src/components/social-proof.tsx` — testimonials per market (or hide section pending real ones).
- `apps/landing/src/components/footer.tsx` — links per market (jurisdiction-specific privacy/terms anchors).
- `apps/landing/src/components/structured-data.tsx` — per-market `Organization` `addressCountry`.

**Verification:**
- `grep -rE "KSeF|Polen|Poland|Polska" apps/landing/src/i18n/locales/{en,de}.json` returns no false-positive mentions on non-PL markets.
- `grep -rE "DE|UK|UAE|SA|Saudi|Emirates|Germany" apps/landing/src/i18n/locales/pl.json` returns no cross-market mentions on PL.
- Visual review of `/pl/`, `/de/`, `/en/` confirms single-market positioning per page.

### Step 4 — Wire Stripe-backed pricing UI on landing + web

**Files touched:**
- `apps/landing/src/components/pricing.tsx` — accept market prop, render currency from Stripe-fetched plans.
- `apps/landing/src/components/pricing/feature-comparison.tsx` — same.
- `apps/landing/src/app/[locale]/pricing/page.tsx` — server-component, calls `pricing-fetcher` with derived market, passes plans + market to children.
- Add monthly/annual toggle UI (client component); default monthly. Annual badge "Save 2 months" (label computed from actual Stripe annual vs monthly×12 delta — no hardcoded 16.7%).
- `apps/web/src/components/billing/plan-comparison-grid.tsx` — fetch via tRPC `billing.listPricing({ market })`; render identical layout to landing for visual consistency.

**Verification:**
- Toggle monthly↔annual on `/pl/pricing` swaps PLN prices + Stripe price IDs in CTA URLs.
- Toggle on `/de/pricing` shows EUR.
- `pnpm --filter @contractor-ops/landing build` passes (fetcher runs against Stripe at build, fails if any product missing metadata).
- Click "Subscribe" on each tier opens Stripe checkout with matching `price_id` from Stripe dashboard.
- Edit a price in Stripe dashboard → wait 5 min (cache TTL) → landing reflects new price without redeploy.

### Step 5 — Install posthog-node + wire server-side events

**Files touched:**
- `apps/web/package.json` + `packages/api/package.json` — add `posthog-node`.
- New: `packages/api/src/services/posthog.ts` — singleton `posthog` instance, env-driven (`POSTHOG_API_KEY`, `POSTHOG_HOST`).
- `packages/auth/src/config.ts:253-267` — post-signup hook fires `signup_completed` to PostHog with distinct_id = userId. Identify call ties anonymous landing distinct_id to userId via `posthog.alias()`.
- `packages/api/src/routers/core/contractor.ts:628-688` — fire `first_contractor_added` on first contractor for org (check count == 1 inside transaction).
- `packages/api/src/services/billing-webhook.ts` — fire PostHog events for `checkout.session.completed`, `customer.subscription.created`, `invoice.paid`, `subscription.deleted`.
- `apps/web/src/app/[locale]/layout.tsx` — inject PostHog distinct_id from landing cookie (`ph_distinct_id`) into web app so funnel survives auth handoff.

**Distinct ID handoff:** confirmed DNS = `contractor-ops.com` (landing), `app.contractor-ops.com` (app), `*.app.contractor-ops.com` (org wildcard), `blog.contractor-ops.com`, `api.contractor-ops.com`. Landing PostHog writes anonymous `distinct_id` to cookie scoped to `.contractor-ops.com` (Domain attribute, root) so it's readable by `app.*` and `blog.*`. Wildcard org subdomains under `*.app.contractor-ops.com` inherit via `.app.contractor-ops.com` secondary cookie set on first authenticated visit. SameSite=Lax, Secure, HttpOnly=false (PostHog needs JS read). Web app reads cookie on first load, calls `posthog.identify(userId, { $anon_distinct_id: cookieValue })` — server-side `posthog-node` then aliases.

**Verification:**
- Trigger fresh visit → signup → create contractor → upgrade → confirm PostHog funnel `landing_view → signup_completed → trial_started → activated → paid_converted` shows 1 user end-to-end.
- Server logs show no PostHog send failures.
- Unit test on contractor.create: spy on `posthog.capture`, verify `first_contractor_added` fires only when org contractor count == 1.

### Step 6 — PostHog flags + experiments + variant rendering

**Files touched:**
- `apps/landing/src/lib/posthog.tsx:33-72` — ensure `loadFeatureFlags()` is awaited or blocked before first paint of variant slots, OR mark all variant slots as below-fold to avoid flash.
- New: `apps/landing/src/lib/experiments.ts` — typed wrapper around `posthog.getFeatureFlag('landing_market_<market>_variant')`.
- New: `apps/landing/src/components/variant-slot.tsx` — renders one of N children based on flag value; emits `$feature_flag_called` event.
- `apps/landing/src/components/hero.tsx`, `problem.tsx`, `features.tsx`, `cta.tsx` — wrap variant-able sections in `<VariantSlot experimentKey="..." variants={{a: <HeroA/>, b: <HeroB/>}}/>`.
- Define experiments in PostHog UI: `landing_market_pl_hero_v1` (A vs B), `landing_market_de_hero_v1`, `landing_market_intl_hero_v1`. Sticky per distinct_id.
- Variant copy seeds per `docs/marketing/LANDING-AB-STRATEGIES.md` variants A (pain-first) + C (compliance-first) for PL; B (outcome) + C for DE; A + B for INTL.

**Note on `LANDING-AB-STRATEGIES.md`:** doc actually has 7 variants (A–G), not 4 as facts.md said. Wave 1 ships 2 per market; wave 2 introduces D/E/F/G as market matures.

**Verification:**
- Force-set flag via PostHog dashboard, reload — variant changes.
- PostHog event `$feature_flag_called` shows variant assignment on every relevant event.
- Cookie persistence: clear cookies → revisit → assigned to new variant; reload → same variant.

### Step 7 — Landing cookie consent (GDPR)

**Files touched:**
- New: `apps/landing/src/components/cookie-consent-banner.tsx` — port pattern from `apps/web/src/components/layout/cookie-consent-banner.tsx`.
- `apps/landing/src/lib/posthog.tsx` — gate `autocapture`, `session_recording`, `capture_pageview` behind consent; load minimal pageview-only mode until consent for EU markets.
- `apps/landing/src/app/[locale]/layout.tsx` — render banner for EU markets (PL/DE/INTL when geo is EU). UAE/SA skip banner per local norms (wave 2 concern).
- Privacy + terms pages exist? Check `apps/landing/src/app/[locale]/` — if missing, scaffold static pages.

**Verification:**
- Fresh visit on `/pl` shows consent banner; reject = no PostHog network calls beyond pageview. Accept = full autocapture.
- Banner choice persists in localStorage + cookie; not re-shown for 12 months.
- Lighthouse score not degraded by banner.

### Step 8 — Funnel dashboard + UTM capture

**Files touched:**
- `apps/landing/src/lib/posthog.tsx` — on init, capture UTM params from URL → `posthog.register({utm_*})` so they attach to every event.
- PostHog UI: build funnel `landing_view → signup_started → signup_completed → trial_started → activated → paid_converted`. Save as pinned dashboard. Breakdowns: market, variant, utm_source, utm_campaign.
- Document funnel definition in `docs/marketing/POSTHOG-FUNNEL.md` (1-page reference) — what each event means, where it fires.

**Verification:**
- Visit `/pl?utm_source=test&utm_campaign=manual` → events in PostHog carry both params.
- Funnel dashboard renders without errors.

### Step 9 — Staging + Lighthouse + smoke

**Files touched:**
- `render.yaml` — confirm landing service deploys with `output: 'export'`.
- New: `lighthouserc.json` at landing root.
- CI: GitHub Action `lighthouse-ci-landing.yml` — runs against staging URL on each PR touching `apps/landing/**`.
- `apps/landing/package.json` scripts — add `lhci`, optional `smoke` (curl-based 200 check across all 5 market URLs).

**Verification:**
- Lighthouse CI fails build if Perf < 90 / a11y < 95 / SEO < 90 on any of `/pl`, `/de`, `/en` for desktop + mobile.
- Manual cross-browser pass on Chrome/Safari/Firefox + mobile Safari/Chrome.
- Sitemap + robots include all live markets; OG/Twitter meta render per-market in social debuggers.

### Step 10 — Cut over

**Files touched:** `render.yaml` (DNS), env vars for Stripe price IDs (PL + DE + INTL), `POSTHOG_API_KEY` (server), `NEXT_PUBLIC_POSTHOG_KEY` (landing already has).

**Verification:**
- DNS points to landing service.
- All 5 funnel events fire from synthetic test purchase.
- Stripe checkout creates trial subscription end-to-end.
- Trial cron (`apps/web/src/app/api/cron/trial-notifications/route.ts`) configured.

## Wave 2 — UK + UAE + SA (post-launch)

### Step 11 — Add UK landing variant

- Extend `pricing-registry.ts` with UK market (GBP, PPP-adjusted).
- New env Stripe price IDs for GBP products.
- Locale: re-use `en.json` and add `en-GB.json` override OR introduce market-segment in URL (`/uk/`).
- IR35-specific copy per `MARKET-EXPANSION-ANALYSIS.md` Market 2.
- Active variants: C (compliance, IR35-led) + B (outcome).

### Step 12 — Add UAE landing variant

- `ae.json` (Arabic primary, EN secondary) — re-use `ar.json` partly.
- AED currency, PPP-adjusted.
- Peppol PINT-AE wedge copy.
- RTL layout already supported (`apps/landing/src/components/locale-html-attributes.tsx`).

### Step 13 — Add SA landing variant

- `sa.json` (Arabic) — variant of `ar.json`.
- SAR currency.
- ZATCA Fatoorah Phase 2 wedge.
- Saudi Arabia content rules: avoid imagery/copy issues (legal review needed).

### Step 14 — Pricing localization fairness audit

- Cross-check PPP prices don't conflict with Stripe restrictions on cross-currency subscriptions.
- Test currency switching doesn't allow gaming (user setting locale to cheaper market mid-subscription).

## Pre-launch checklist alignment (will close)

- `contractor-ops-launch-checklist.md:101` cookie banner on landing → step 7.
- `contractor-ops-launch-checklist.md:465` landing page live → step 10.
- `docs/PRODUCTION-CHECKLIST.md:173` web vitals on landing → bonus in step 5 (wire to `/api/web-vitals`).
- `docs/PRODUCTION-CHECKLIST.md:239` subprocessor list page on landing → out-of-scope flag, do separately.

## Risks + open questions

1. **Static export limits server-side flag eval.** Variant slots may flash control briefly. Mitigation: blocking `loadFeatureFlags()` in root client component, or render all variants hidden and reveal post-flag. Decide week 1.
2. ~~**Distinct-id handoff cookie domain.**~~ RESOLVED — DNS layout confirmed: `contractor-ops.com` (landing), `app.contractor-ops.com`, `*.app.contractor-ops.com` (org wildcard), `blog.contractor-ops.com`, `api.contractor-ops.com`. Cookie scope `.contractor-ops.com` works for landing↔app↔blog handoff.
3. ~~**`PLAN_CONTENT` vs `plan-comparison-grid.tsx` divergence.**~~ RESOLVED — Stripe API is the single source of truth; both hardcoded constants deleted in step 1. Prices live only in Stripe dashboard.
4. **PostHog cookie banner UX.** Strict consent default = lost pageview tracking pre-consent. Acceptable trade-off? Confirm.
5. **Solo + 3 weeks vs scope.** Wave-1 descope (5→3 markets) preserves date. If user wants all 5 on day 1, plan extends ~3 weeks.
6. **Legal copy correctness.** No local legal review on launch (per `MEMORY.md`). One wrong compliance claim per market → reputational + refund risk. Mitigation: every compliance claim phrased as "ready for / supports" not "guarantees compliance" + disclaimer line + link to docs.
7. **Stripe trial activation event timing.** Stripe sends `customer.subscription.created` for trial subs immediately. Distinguish `trial_started` (status='trialing') vs `paid_converted` (status='active' AND not trial). Specified in step 5 but worth testing first.
8. **Currency A/B confounding.** PPP-adjusted prices means a PL user seeing PLN can't be compared to a DE user seeing EUR on conversion lift. Keep A/B copy variant tests scoped per market (already in plan).

## Out of scope (call-outs)

- Email automation tool selection (Customer.io / Loops / etc.) — separate goal.
- Sales CRM (Pipedrive / HubSpot / Attio) — separate goal.
- Programmatic SEO pages — separate goal.
- Per-market legal review by Steuerberater / księgowa / solicitor — deferred per `MEMORY.md`.
- New product features beyond pricing/analytics wiring.
- Subprocessor list page (split out, do separately).
