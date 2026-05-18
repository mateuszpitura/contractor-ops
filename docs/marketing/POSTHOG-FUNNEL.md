# PostHog launch funnel — reference

Canonical funnel for the Contractor Ops launch. Built in PostHog as the
"Launch funnel" pinned dashboard. Update this file whenever the event
contract changes; treat the funnel as a public API for marketing + sales.

## Stages

| # | Event                         | Fires from                                          | distinct_id          | Notes |
|---|-------------------------------|-----------------------------------------------------|----------------------|-------|
| 1 | `$pageview`                   | `lib/posthog.tsx` PostHogPageTracker                | anon (PH-generated)  | Pageviews always on (soft consent) |
| 2 | `signup_started`              | Landing signup CTA / first signup-form interaction  | anon                 | TODO — wire from signup form |
| 3 | `signup_completed`            | First authenticated app load — fires from web app   | userId               | TODO — `analytics.trackSignupCompleted` mutation |
| 4 | `trial_started`               | `customer.subscription.created` webhook (trialing)  | organizationId       | Wired in packages/api/src/services/billing-webhook.ts |
| 5 | `first_contractor_added`     | `contractor.create` tRPC mutation (count == 1)      | userId               | `activated` step |
| 6 | `paid_converted`              | Subscription transitions to `active`                | organizationId       | Wired in packages/api/src/services/billing-webhook.ts |

Funnel order in PostHog: `$pageview → signup_started → signup_completed →
trial_started → first_contractor_added → paid_converted`.

The user-side events (`signup_*`, `first_contractor_added`) and the
webhook-side events (`trial_started`, `paid_converted`) use different
distinct ids by design — Stripe webhooks only carry `organizationId`.
The two streams join in PostHog via the `organization_id` property,
which every event carries.

Cross-stream identification: on first authenticated app load the
landing-side anonymous distinct id (read from the `ph_distinct_id`
cookie scoped to `.contractor-ops.com`) is aliased to the user via
`aliasAnonToUser(anonId, userId)`. After that, PostHog merges the two
streams automatically.

## Properties on every event

- `market` — one of `PL | DE | INTL | UK | UAE | SA`. Set on first pageview.
- `locale` — BCP-47 locale (e.g. `en-GB`, `ar-SA`).
- `variant` — PostHog experiment variant id (sticky per distinct id) when
  inside a variant slot.
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`,
  `gclid`, `fbclid` — captured from the landing URL on first hit, set
  as person properties so they propagate to every subsequent event.

## Breakdowns

- `market` × `variant` — A/B lift per market.
- `utm_source` × `utm_campaign` — paid acquisition performance.
- `country` (contractor) — geo of activated org's first contractor.

## Definition of activation

`activated` = `first_contractor_added` fired exactly once per org (when
total contractor count == 1 after creation). Chosen over multi-step
definitions (first invoice, first approval) because contractor add is
the single behaviour that proves the user understood the product.

## Definition of paid conversion

`paid_converted` = `customer.subscription` transitions to `active`
status AND the subscription has either no `trial_end` or one in the
past. Trial → paid happens automatically when Stripe charges the first
non-trial invoice; PostHog dedups on event + distinct_id so we never
double-count.

## Event hygiene

- All events go through the `captureEvent` helper in
  `packages/api/src/services/posthog.ts`, which no-ops when
  `POSTHOG_API_KEY` is unset.
- Errors are swallowed and logged with `service: 'posthog-server'`.
- `flushPosthog()` is called from request-completion hooks so events
  are not lost when the worker is suspended.
