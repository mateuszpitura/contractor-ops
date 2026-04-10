# Phase 28: Stripe Billing Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 28-Stripe Billing Foundation
**Areas discussed:** Pricing tier design, Trial & conversion flow, OCR credit model, Billing UX placement

---

## Pricing Tier Design

### Seat pricing model

| Option | Description | Selected |
|--------|-------------|----------|
| Flat + per-seat add-on | Base platform fee + per-seat fee above included count | ✓ |
| Pure per-seat tiers | No flat fee, price scales entirely by seat count | |
| Flat only, seats unlimited | Fixed monthly price, no seat-based scaling | |

**User's choice:** Flat + per-seat add-on
**Notes:** None

### Tier differentiation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Capacity-based | Same features everywhere, tiers differ by limits | |
| Feature-gated | Higher tiers unlock capabilities | |
| Hybrid (capacity + features) | Both more capacity AND more features per tier | ✓ |

**User's choice:** Hybrid (capacity + features)
**Notes:** None

### OCR credit allowance per tier

| Option | Description | Selected |
|--------|-------------|----------|
| Starter: 20, Pro: 100, Enterprise: 500 | Conservative — nudges heavy users to upgrade | ✓ |
| Starter: 50, Pro: 200, Enterprise: unlimited | Generous — reduces friction | |
| You decide | Claude picks reasonable defaults | |

**User's choice:** Starter: 20, Pro: 100, Enterprise: 500
**Notes:** None

### Price points

| Option | Description | Selected |
|--------|-------------|----------|
| 349 / 549 / 999 PLN/mo | Matches PROJECT.md target range | |
| 199 / 449 / 849 PLN/mo | Lower entry point to maximize conversions | ✓ |
| You decide | Claude sets placeholder prices | |

**User's choice:** 199 / 449 / 849 PLN/mo
**Notes:** None

### Included seats per tier

| Option | Description | Selected |
|--------|-------------|----------|
| Starter: 2, Pro: 5, Enterprise: 15 | Tight — per-seat revenue starts early | ✓ |
| Starter: 3, Pro: 10, Enterprise: 25 | Generous — most small orgs won't hit fees | |
| You decide | Claude picks reasonable defaults | |

**User's choice:** Starter: 2, Pro: 5, Enterprise: 15
**Notes:** None

### Per-seat pricing model

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform (e.g., 29 PLN/seat) | Same per-seat regardless of tier | |
| Tier-specific (e.g., 19/29/49 PLN) | Higher tiers have higher per-seat cost | ✓ |

**User's choice:** Tier-specific
**Notes:** None

### Feature gates

| Option | Description | Selected |
|--------|-------------|----------|
| Pro: integrations + OCR. Enterprise: audit export + API | Starter = core ops, Pro = integrations + AI, Enterprise = compliance + API | ✓ |
| Pro: OCR + advanced workflows. Enterprise: integrations + API | Different split of features | |
| You decide | Claude designs feature matrix | |

**User's choice:** Pro: integrations + OCR. Enterprise: audit export + API
**Notes:** None

---

## Trial & Conversion Flow

### Trial end behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block with grace period | 7-day grace period (read-only) then full block | |
| Immediate soft block | App works but every action shows upgrade modal | ✓ |
| Hard cutoff | Locked out entirely until subscription | |

**User's choice:** Immediate soft block
**Notes:** None

### Trial length

| Option | Description | Selected |
|--------|-------------|----------|
| 14 days | Standard B2B SaaS duration | ✓ |
| 30 days | Full month for real billing cycle | |
| 7 days | Short and aggressive | |

**User's choice:** 14 days
**Notes:** None

### Trial feature restrictions

| Option | Description | Selected |
|--------|-------------|----------|
| Full Pro features, capacity limited | All Pro features, capped at 2 users + 5 contractors + 5 OCR credits | ✓ |
| Starter features only | Trial matches Starter tier exactly | |
| All features unlocked, no limits | Full Enterprise experience | |

**User's choice:** Full Pro features, capacity limited
**Notes:** None

### Notification schedule

| Option | Description | Selected |
|--------|-------------|----------|
| 7, 3, 1 days before | Three touchpoints: awareness, urgency, final warning | ✓ |
| 7, 3, 1, 0 days | Same plus expiry-day notification | |
| You decide | Claude picks schedule | |

**User's choice:** 7, 3, 1 days before
**Notes:** None

---

## OCR Credit Model

### Credit unit

| Option | Description | Selected |
|--------|-------------|----------|
| Per extraction | 1 credit = 1 invoice extraction regardless of page count | ✓ |
| Per page | 1 credit = 1 page processed | |
| Per API call | 1 credit per Claude Vision API call | |

**User's choice:** Per extraction
**Notes:** None

### Top-up bundle model

| Option | Description | Selected |
|--------|-------------|----------|
| Manual purchase only | Admin buys credit packs on demand | |
| Auto-renewal option | Auto-purchase when credits drop below threshold | |
| Both (manual + auto option) | Manual for all, auto-renewal for Pro/Enterprise | ✓ |

**User's choice:** Both (manual + auto option)
**Notes:** None

### Hard-block experience

| Option | Description | Selected |
|--------|-------------|----------|
| Inline block at OCR trigger | Inline message with upgrade/top-up buttons | ✓ |
| Modal with options | Modal showing credit count, plan, upgrade/top-up CTAs | |
| You decide | Claude designs block UX | |

**User's choice:** Inline block at OCR trigger
**Notes:** None

---

## Billing UX Placement

### Billing page location

| Option | Description | Selected |
|--------|-------------|----------|
| Settings sub-tab | New "Billing" tab under Settings | ✓ |
| Dedicated /billing route | Top-level route in sidebar | |
| Settings inline section | Within existing Settings > Profile page | |

**User's choice:** Settings sub-tab
**Notes:** None

### Upgrade prompts

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual inline prompts | Subtle inline message at feature gates | |
| Global banner + inline | Persistent top banner + inline prompts | |
| Inline + settings badge | Inline prompts + badge on Settings nav | |

**User's choice:** Custom — contextual inline prompts with diamond icon on premium features, global banner only during trial-ending period (last 7 days)
**Notes:** User specified: premium actions should have diamond icon. Global banner appears only during trial-ending period, not permanently.

### Upgrade flow

| Option | Description | Selected |
|--------|-------------|----------|
| In-app plan picker + Stripe Checkout | Custom plan comparison UI, Stripe Checkout for payment | ✓ |
| Stripe-hosted pricing page | Redirect to Stripe's hosted pricing table | |
| In-app via Stripe Elements | Full in-app with embedded Stripe Elements | |

**User's choice:** In-app plan picker + Stripe Checkout
**Notes:** None

---

## Claude's Discretion

- Stripe product/price object structure and naming conventions
- Database schema for subscription and credit tracking models
- Webhook event handling implementation details
- Top-up bundle sizes and pricing
- Plan comparison UI layout and responsive behavior
- Proration calculation display format
- Soft-block modal design and copy
- Credit reset timing

## Deferred Ideas

- BILL-09 (feature gating middleware) — Phase 35
- BILL-10 (usage dashboard) — Phase 35
- Stripe Connect for contractor payouts — out of scope
