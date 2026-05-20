# Goal — Launch readiness: landing, pricing, analytics

## Goal

Ship a launch-ready public surface for Contractor Ops: per-market landings (PL, DE, INTL on wave 1; UK, UAE, SA on wave 2) with distinct ICP/pain/compliance positioning, 3-tier pricing with monthly/annual toggle reconciled across landing and app, PPP-adjusted per-market currency, PostHog-only analytics with a full landing→signup→activation→paid funnel, A/B variants per market via PostHog Experiments + Feature Flags, and GDPR-compliant consent handling.

## Shared understanding

See [`facts.md`](./facts.md) — testable outcomes covering scope, markets, routing, copy variants, pricing, trial, analytics, funnel definition, marketing-docs alignment, pre-launch gates, and explicit non-goals.

## Execution plan

See [`plan.md`](./plan.md) — two-wave delivery:
- **Wave 1 (3 weeks, launch):** PL + DE + EN-international live; PostHog flags/experiments + GDPR consent + pricing reconciliation + full funnel events.
- **Wave 2 (weeks 4–8, post-launch):** UK + UAE + SA landings with GBP/AED/SAR.

Plan flags 8 risks + open questions, including pricing-divergence reconciliation (landing fallback Pro 49 EUR vs web 299 PLN), distinct-id cookie domain, static-export flag flash, and PPP-pricing A/B confounding.

## Done condition

Wave 1 considered done when, on the production landing domain:

1. `/pl`, `/de`, `/en` each render their own ICP, pain, and compliance wedge with no cross-market mentions on the primary copy.
2. Pricing page on each market shows 3 tiers + monthly/annual toggle in the correct currency (PLN / EUR / EUR) sourced from a single `pricing-registry.ts` consumed by both landing and `apps/web` billing UI.
3. Clicking "Subscribe" on each tier (each market × period) routes to a working Stripe checkout that creates a 14-day no-card trial subscription end-to-end.
4. PostHog dashboard shows the funnel `landing_view → signup_started → signup_completed → trial_started → activated → paid_converted` with breakdowns by market, variant, and UTM source, populated by a synthetic test journey.
5. At least 2 PostHog experiment variants are active per market with sticky assignment by `distinct_id`, recorded on every event via `$feature_flag_called`.
6. GDPR cookie consent banner gates PostHog autocapture + session recording on EU markets; reject choice persists, accept enables full tracking.
7. Lighthouse CI on each market landing passes Perf ≥ 90, A11y ≥ 95, SEO ≥ 90 for both mobile and desktop.
8. `contractor-ops-launch-checklist.md:101` (landing cookie banner) and `:465` (landing live) are checked.

Wave 2 done when UK + UAE + SA markets meet the same criteria with their respective ICP, currency, and compliance wedge.
