# Facts — Launch readiness: landing, pricing, analytics

## Scope and markets

- 5 markets live on launch with distinct landings: PL, DE, UK, UAE, SA.
- Each market landing has its own ICP, primary pain, and compliance wedge framing (sources: `MARKET-EXPANSION-ANALYSIS.md`, `docs/marketing/LANDING-AB-STRATEGIES.md`).
- PL landing wedge = KSeF + contractor admin chaos; ICP = ops/finance lead at 10–50 person SMB.
- DE landing wedge = Scheinselbständigkeit risk + ZUGFeRD/XRechnung readiness; ICP per `MARKET-EXPANSION-ANALYSIS.md`.
- UK landing wedge = IR35 / off-payroll compliance + CIS where relevant; ICP per `MARKET-EXPANSION-ANALYSIS.md`.
- UAE landing wedge = Peppol PINT-AE e-invoicing + corporate tax onboarding; ICP per `MARKET-EXPANSION-ANALYSIS.md`.
- SA landing wedge = ZATCA Fatoorah Phase 2 e-invoicing + withholding tax; ICP per `MARKET-EXPANSION-ANALYSIS.md`.
- No market landing mentions other markets in its primary copy (no DE/UK/UAE/SA mentions on PL landing, etc.).
- A "global / other" fallback landing is reachable for traffic outside the 5 markets, with generic EN copy and a single CTA to waitlist.

## Routing and locale

- Each market is reachable via a stable URL pattern (locale path or subdomain) selectable by visitor.
- Default market is inferred from request `Accept-Language` + IP-based country hint on first visit, then persisted in cookie.
- Visitor can switch market manually via a market switcher in nav; choice persists across sessions.
- Direct deep links to a specific market landing always render that market's variant regardless of geo.
- Switching market reloads pricing currency and copy without losing UTM/PostHog session context.

## Copy variants and A/B testing

- Each market runs at least 2 active landing copy variants on launch (A and B) driven by PostHog Experiments + Feature Flags.
- Variant assignment is sticky per visitor (distinct_id), survives page navigation, and is recorded as a PostHog experiment property on every event.
- A/B variants are defined per market (10+ variants total on launch across 5 markets × 2 variants).
- Variant copy seeds are taken from `docs/marketing/LANDING-AB-STRATEGIES.md` (Variant A = pain-first, B = outcome-first, C = compliance-first, D = ICP-narrow).
- Each market designates which variants are eligible — at minimum the locally-relevant compliance variant (C) is always one of the active variants per market.
- New variants can be added/paused/promoted via PostHog UI without code deploys (feature-flag-gated component slots).
- A control/baseline variant exists per market so lift can be computed.

## Pricing

- Pricing page exposes 3 named tiers + monthly/annual toggle with annual discount (numeric values TBD; tier names and structure locked, prices configurable later).
- Annual toggle changes displayed price and Stripe price ID; annual discount is visually labeled (e.g. "Save 2 months").
- Each tier includes a baseline seat count; additional seats are billed per-seat over the included count.
- Prices are displayed in per-market local currency: PLN (PL), EUR (DE), GBP (UK), AED (UAE), SAR (SA).
- Per-market prices are PPP-adjusted (independent price per market, not auto-FX conversion).
- Stripe API is the single source of truth for prices. No prices are hardcoded in landing or app code. A typed fetcher (`packages/billing/src/pricing-fetcher.ts`) reads active Stripe products + prices, validates required metadata (`tier`, `market`, `included_seats`, `credits_included`, `extra_seat_price_id`, `sort_order`), and exposes a normalized `PricingPlan[]` consumed identically by landing pricing page and in-app `plan-comparison-grid.tsx`.
- Stripe products + prices exist for every (tier × market × billing-period) combination at launch; mismatch between displayed price and Stripe price ID at checkout is impossible because both sides read from the same fetcher.
- Price changes happen in Stripe dashboard or via a versioned seed script (`scripts/stripe/products.seed.json` + `scripts/stripe/seed-products.ts`); no code deploy required for price changes.
- A "Contact sales" / enterprise option is reachable from the pricing page (no fourth tier in tier grid — it's a sidecar CTA).
- Pricing FAQ on landing covers: VAT/tax handling per market, seat add/remove mid-cycle, annual upgrade/downgrade, KSeF/ZATCA/Peppol coverage by tier.

## Trial / acquisition offer

- All markets offer a 14-day free trial, no credit card required at signup.
- Trial start triggers a PostHog event with market + variant + plan-considered properties.
- Trial expiry triggers an email sequence (handled by app; landing only sets the user up for it).
- After trial, user enters paywall state; downgrade to a free read-only mode is **not** offered on launch.

## Analytics — PostHog only

- PostHog is the single analytics tool for landing + product funnel (no Plausible, no GA4, no segment).
- PostHog script loads on every landing variant and on every authenticated app page.
- Cookie/consent banner appears for EU/UK markets (PL/DE/UK), gates non-essential PostHog tracking until consent; UAE/SA load by default per local norms.
- PostHog distinct_id persists from landing visit through signup so funnel attribution survives auth handoff.
- UTM params (source, medium, campaign, term, content) are captured on landing and attached to PostHog person properties.
- Server-side Stripe webhook events (`checkout.session.completed`, `customer.subscription.created`, `invoice.paid`) are forwarded to PostHog as identified events with the same distinct_id.
- Server-side product events (`trial_started`, `first_contractor_added`, `first_invoice_issued`, `subscription_activated`, `subscription_cancelled`) emit from app to PostHog tied to user + organization.

## Funnel definition

- The canonical launch funnel is: `landing_view` → `signup_started` → `signup_completed` → `trial_started` → `activated` → `paid_converted`.
- `activated` = first contractor added to the org (single-event activation, per chosen definition).
- `paid_converted` = Stripe `customer.subscription.created` with non-trial status.
- Funnel is queryable in PostHog and broken down by: market, variant, UTM source/campaign, tier-considered.
- Drop-off rate at each step is visible in a PostHog dashboard pinned for the founder.
- Time-to-activate (signup_completed → activated) is tracked and reportable per market/variant.

## Marketing-docs alignment

- Landing copy + pricing + funnel definitions are explicitly cross-checked against `docs/marketing/LANDING-AB-STRATEGIES.md` and `docs/marketing/MARKETING-SALES-LAUNCH-60D.md`; deviations are documented inline in this goal's plan.
- `docs/marketing/GTM-TOOLS-RESEARCH.md` recommendations on analytics/ad tooling are reconciled with the "PostHog only" decision; any conflicts noted.

## Pre-launch readiness gates

- A staging deploy of each market landing is reachable on a non-production URL and reviewable end-to-end before public DNS cutover.
- Lighthouse mobile score for every market landing ≥ 90 on Performance, ≥ 95 on Accessibility, ≥ 90 on Best Practices, ≥ 90 on SEO.
- Each market landing passes axe-core a11y scan with zero serious/critical violations.
- All 5 markets render correctly in Chrome, Safari, Firefox, mobile Safari, mobile Chrome (manual smoke check pre-launch).
- Pricing CTA on every market variant leads to a working signup → trial → app flow end-to-end (no broken redirects, no missing Stripe product).
- Sitemap + robots.txt expose all 5 market landings; canonical URLs are correct per market.
- OG/Twitter meta tags are per-market (correct language, market-specific value prop, image).
- Structured data (Organization, Product, FAQPage) emitted per market in correct locale.

## Explicit non-goals

- Per-market product UI translation beyond what already exists in `apps/web/messages/*.json` is out of scope.
- New product features (beyond pricing/analytics wiring) are out of scope.
- Programmatic SEO pages (e.g. "/ksef-vs-fakturownia") are out of scope.
- Email automation tooling (Customer.io, Loops, etc.) selection is out of scope; trial-expiry email is handled by existing app email infra.
- Sales CRM setup is out of scope.
- Per-market legal/compliance copy review by local Steuerberater/księgowa/solicitor is out of scope (deferred per `MEMORY.md` "local-only legal sign-off deferred").

## Risk flags surfaced to user

- Scope: 5 markets × ≥2 variants × per-market currency + Stripe products + per-market a11y/SEO is a multi-week build for a solo founder against a 3-week deploy target. Plan must propose either descope or phased deploy or accept slipped date.
- Compliance copy correctness across 5 jurisdictions without local legal review carries reputational + refund risk on first wrong claim.
- PPP pricing per market multiplies Stripe product surface area 5× and complicates A/B (price A/B becomes intertwined with copy A/B unless decoupled).
