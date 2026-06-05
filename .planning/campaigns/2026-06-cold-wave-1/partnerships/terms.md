# Partnerships — terms framework

Reusable deal templates so every partnership conversation starts from a clear ask rather than negotiating from zero. Not legal contracts — those come after MOU. This is the offer matrix.

## Three deal types

### Type A — Marketplace listing

**What:** Our app appears in their app store / integrations directory. Their customers self-discover.

**Our deliverable:** Maintained integration via their API / connector; certification process; co-marketing one-pager.

**Their deliverable:** Listing approval; standard marketplace placement; (optionally) featured slot for launch.

**Commercial:** Usually free. Some platforms charge listing fee or take rev share on app-store-installed customers (Shopify-style 20%).

**Cycle:** 2–8 weeks to listing. Slowest with: Intuit (QuickBooks), Stripe.

**Where this fits:** Stripe Connect, Mollie, Xero, QuickBooks, Zoho, Deel, Remote, Personio, HiBob.

### Type B — Integration partner with referral

**What:** Deep technical integration (whitelabel embed / API / SSO / SCIM / webhooks). Their CSM / account manager actively refers customers.

**Our deliverable:** Production-grade integration; SLA for joint customers; dedicated partner-success engineer (Mateusz first, hire later).

**Their deliverable:** Refer joint customers via tracked link; QBR; co-marketed case studies; (optionally) joint webinars.

**Commercial:** Default revenue share **20% MRR on referred customer for first 12 months**, then 10% for life. Tiered by referral volume:
- 1–5 active referred customers: 20% / 10%
- 6–15: 25% / 12%
- 16+: 30% / 15%

**Cycle:** 6–16 weeks to first refer. Faster: Wise, Mollie, inFakt. Slower: DATEV, Stripe.

**Where this fits:** Wise Business, Mollie, Revolut, inFakt, Fakturownia, DATEV, Lexware, Personio, Bayzat, Hala, Wafeq.

### Type C — Pure revshare / referral (no integration)

**What:** Their BD / CSM team flags customers with classification / compliance pain; warm intro to us; no technical integration.

**Our deliverable:** Defined commission tracking via Sheet → Rewardful later; joint commercial review; case studies.

**Their deliverable:** Quarterly refer-list shared; warm intros; CRM tagging.

**Commercial:** **25% MRR for 12 months, 12% lifetime.** No integration = higher refer-quality required; higher commission compensates.

**Cycle:** 2–6 weeks to first refer. Fastest path to revenue.

**Where this fits:** Velocity Global rejection-queue refer, niche accounting firms, freelance recruiters, Steuerberater networks, PL biuro rachunkowe networks, UK umbrella companies.

## Revenue-share mechanics

| Term | Default |
|------|---------|
| Attribution window | 90 days from first click / intro |
| Tracking | UTM `utm_source=partner&utm_campaign={{partner_id}}` + manual CRM tagging on warm intros |
| Calculation base | MRR only (not setup fees, not one-time pilot fees) |
| Payment frequency | Quarterly in arrears |
| Payment method | Stripe / SEPA / Wise depending on partner |
| Minimum payout | €100 (avoid micro-transaction overhead) |
| Reporting | Quarterly statement: referred customers + ARR + commission earned |
| Audit right | Partner may request statement detail with 14-day notice |
| Termination | Either party 30-day notice. Existing customers grandfathered to 12-month tail. |

## Integration tiers (when Type B)

| Tier | Effort | What it includes |
|------|--------|------------------|
| **Lightweight** | 1–2 weeks | Single SSO + webhook from partner → contractor-ops; partner customers click a link, lands on co-branded signup |
| **Standard** | 3–6 weeks | API bidirectional sync (customers + contractors + invoices); embedded UI for compliance workflow; SCIM if applicable |
| **Deep / OEM** | 8–16 weeks | Whitelabel embedded experience; native SDK or React component library in partner app; data residency aligned; joint roadmap |

Default offer: Lightweight first → upgrade to Standard after 5 joint customers prove demand → Deep only with enterprise partner (DATEV, Personio).

## Joint marketing standard offer

- One co-branded case study within 90 days of first joint customer
- One joint webinar / quarter (we run, partner promotes)
- Mutual logo placement on partnerships pages
- Co-authored content piece per quarter (one of our 12 articles per quarter is partner-cobranded)
- Joint LinkedIn campaign at launch (we boost, partner reposts)

## Anti-patterns to refuse

- Exclusivity in any geo (we serve all geos via direct sales; no partner gets sole rights)
- Free or discounted licenses for the partner themselves (separate negotiation)
- Take-rate above 30% on first 12 months (kills unit economics)
- Non-compete clauses
- Brand-control rights over our roadmap or pricing

## Negotiation guard-rails

| If partner asks | Counter |
|-----------------|---------|
| "We want 40% revshare" | "30% top tier after 16 active referrals; volume-tiered" |
| "Lifetime revshare instead of 12-month + lifetime taper" | "12-month is industry standard for sustained product investment" |
| "Exclusivity in {{geo}}" | "Decline. We serve all geos direct. Marketplace listing is non-exclusive by structure." |
| "Free pilot license for our team" | "Offer 50% off year 1 for their team's actual use; not free" |
| "Build a custom feature for us" | "Add to roadmap if it serves ≥3 joint customers; we don't build single-tenant features" |

## MOU template (post-handshake, pre-contract)

Two-page MOU covering: parties, deal type, revshare %, attribution mechanics, integration tier, minimum commitments, term, termination notice. Send Tally / PandaDoc Free version after first 30-min call confirms mutual interest. Legal contract follows MOU signature within 30 days.

## What partnerships pipeline drives in 3 months — realistic

- **Outreach sent:** 24 partners × 3 steps = 72 emails over 4 weeks
- **Conversations live:** 6–10
- **MOUs signed:** 2–4
- **First refers received:** 1–3
- **First refer-attributed paying customers:** 0–2

Most partnerships pay off in months 4–9, not 1–3. The 3-month bet: **secure 2–4 MOUs that compound through Q4.**
