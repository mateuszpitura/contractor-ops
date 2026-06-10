# Conversion model — what 1000 companies actually yields

> CMO honest funnel math, not a buzzkill. The "2% → 20 paying" instinct is right as a *destination* and wrong as a *first-cold-blast* number. This doc separates the two so runway + expectations sit on real numbers.

## The core correction

"2% of 1000 = 20 paying" assumes **sent → paid = 2%**. For cold outbound, first campaign, that's ~3–10× too high. Realistic cold-only sent→paid is **0.2–0.6%** = 2–6 paying per 1000. The 2% (20 paying) is achievable — but as a **12-month, all-channel, multi-touch cumulative** number, not from one sequence.

Both are good. They're just different points in time.

## The honest cascade (per 1000 cold sent, first wave)

| Stage | Rate | Count | Why |
|-------|------|-------|-----|
| Sent (verified) | — | 1000 | after MillionVerifier drops bad |
| Delivered | ~95% | ~950 | warmup + verification protect this |
| Opened | 40–55% | 380–520 | subject + sender reputation |
| Replied (all) | 4–8% of sent | 40–80 | first campaigns trend to the low end |
| **Positive reply** | ~30% of replies | 12–24 | rest = pass / wrong-person / unsubscribe |
| **Meeting booked** | 1.5–3% of sent | 15–30 | the number that matters |
| SQL (qualified) | 50–65% of meetings | 8–20 | fit + budget + timing |
| **Closed (pilot/paying)** | 15–30% of SQL | 2–6 | first wave, unproven copy |

**First-wave cold-only: 2–6 paying per 1000 (0.2–0.6%).**

## Why the destination (20) is still real — over time

The same 1000 companies, worked across all channels for 12 months, converts far higher than one blast — because:

1. **The "not now" pile is the goldmine.** Most of the 40–80 repliers + the silent-but-opened are not "no," they're "not yet." Content + nurture + a re-touch at the deadline converts a chunk of them later.
2. **Deadline forcing function (we have a real one).** KSeF (Feb 2026), DE E-Rechnung, 1099/IRIS (Jan 2027) force a decision by a date. Generic SaaS pitches lack this. It compresses cycles and rescues "not now" leads at the deadline.
3. **Partner-referred portion closes 2–3× higher** than cold. As the Steuerberater/doradca/CPA channel matures, a slice of the 1000 arrives warm.
4. **Iterated copy.** Wave 2+ copy (post-W6 A/B) lifts every rate above first-wave baseline.

**12-month full-funnel cumulative: 1–2% = 10–20 paying per 1000** — IF sustained, multi-touch, deadline-timed, partner-assisted.

## Scenario table (per 1000)

| Horizon / mode | Sent→paid | Paying | Conditions |
|----------------|-----------|--------|------------|
| First wave, cold only | 0.2–0.6% | 2–6 | one sequence, unproven copy |
| First wave + triggers + deadline | 0.4–1.0% | 4–10 | hot hiring-trigger lists + KSeF urgency |
| 12-month, all channels | 1–2% | 10–20 | cold + content + partner + nurture + deadline re-touch |
| 12-month, exceptional | 2–3% | 20–30 | proven offer + strong partner channel + multiple deadlines |

So **20 paying = the 12-month all-channel target**, and it's a *good* one — not the first-month cold number.

## What hitting 2% actually requires (the checklist)

- [x] A deadline forcing function — KSeF / 1099 / E-Rechnung (we have it; rivals mostly don't)
- [x] Intent-trigger lists, not cold-cold (sourcing-triggers.md)
- [x] Partner channel for a warm slice (Steuerberater / doradca / CPA)
- [ ] Multiple touches over months, not one sequence (nurture + content re-touch)
- [ ] Iterated, proven copy (wave 2+)
- [ ] Fast onboarding + a product that delivers the deadline outcome
- [ ] Re-touch every lead AT its deadline (KSeF Feb, 1099 Jan)

The first three we've designed in. The rest is execution over time.

## Revenue translation (why even the conservative number is fine)

At a plausible ACV of €300–2,000/mo:

| Paying | MRR @ €300 | MRR @ €1,000 | MRR @ €2,000 |
|--------|-----------|--------------|--------------|
| 2 (low first-wave) | €600 | €2,000 | €4,000 |
| 6 (good first-wave) | €1,800 | €6,000 | €12,000 |
| 20 (12-mo target) | €6,000 | €20,000 | €40,000 |

For a solo founder, even 2–6 paying in wave 1 = real MRR + references + the flywheel starting. 20 over 12 months = a genuine business. Both outcomes are worth the campaign; just don't budget month-2 runway on the month-12 number.

## The trap to avoid

Anchoring runway / hiring / spend on "20 paying soon." If wave 1 yields 3 and you planned for 20, you'll call it failure when it's actually on-track. Plan against **2–6 in wave 1**, treat **10–20 as the 12-month goal**, and let the deadline + partner channel + nurure pull you up the range.

## How this maps to our plan

- Wave 1 (480 EU/Gulf leads): expect **1–4 paying** + 8–16 meetings + pipeline. (GTM_PLAN W12 targets already reflect this — coherent.)
- Add US-OUT + US-domestic 1099 (Q4 deadline) + content + partners over 12 months → the cumulative climbs toward the 1–2% destination.
- The KSeF (Feb) and 1099 (Jan) deadlines are the two moments to re-touch the entire "not now" pile — that's where the destination number gets made.

## Cross-refs

- `GTM_PLAN.md` — milestone targets (aligned to wave-1 conservative numbers)
- `sourcing-triggers.md` — the trigger lists that lift conversion toward the upper range
- `dashboard_spec.md` — measure actual rates against this model; correct the model with real data after W6
