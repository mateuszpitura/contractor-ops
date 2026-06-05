# Intent-trigger sourcing — the multiplier layer

> CMO note: this is the single highest-ROI addition to Wave 1. It does not add new cells or new copy — it re-orders the SAME hero-cell lists by *who is in pain right now*. Trigger-based cold outreach replies at 2–4× the rate of static firmographic lists. Runs in parallel to warmup — zero impact on the 24 Jun release date.

## The shift

| Old sourcing | New sourcing |
|--------------|--------------|
| Apollo firmographic filter → 30 companies that *look* like ICP | Apollo/Clay/scrape → 30 companies showing an *active buying signal* this month |
| Static. Pain may be dormant. | Dynamic. Pain is live → reply window open |

We still send the same hero-cell copy. We just send it to people whose problem is on fire today.

## Trigger tiers (priority order)

### Tier 1 — Active contractor/freelance hiring (LV-01) — primary signal

A company posting multiple contractor / freelance / B2B / Werkvertrag / umowa B2B job ads is *actively scaling contractor headcount* — which means classification + invoicing + onboarding pain is happening NOW.

| Geo | Source | Search query |
|-----|--------|--------------|
| PL | Pracuj.pl, JustJoin.it, NoFluffJobs, LinkedIn Jobs | "B2B" + "kontraktor" / "freelancer" filter; JustJoin/NoFluff are B2B-contract-native = goldmine |
| DE | StepStone, LinkedIn Jobs, Freelancermap, Gulp | "Freiberufler" / "freie Mitarbeit" / "Werkvertrag" / "Contractor" |
| UK | LinkedIn Jobs, CWJobs, Indeed | "contract" / "outside IR35" / "day rate" / "limited company" |
| Gulf | Bayt, LinkedIn Jobs, Naukrigulf | "contract" / "freelance" / "project basis" + Saudi-national-preferred flags for SA |

**Capture method:**
- Manual (surgical, first 120): LinkedIn Jobs + JustJoin.it / NoFluffJobs filter → note companies posting 3+ contractor roles → enrich contact in Apollo.
- Semi-automated: PhantomBuster / Evaboot LinkedIn Jobs scraper → company list → Clay enrich → Apollo email.
- Score: 5+ active contractor posts = HOT, 2–4 = WARM, route both ahead of static leads.

**Why this is the lever:** "I saw {{company_name}} is hiring 6 contractors on JustJoin right now — KSeF from Feb hits exactly that motion" is a personalization hook that *cannot be faked* and signals you did homework. Reply rates jump.

### Tier 2 — New-in-role exec <90 days (LV-02)

New Head of People / Finance Director / Head of Ops = actively looking for quick wins to prove themselves. 90-day honeymoon = buying window.

- Source: Apollo "changed jobs in last 90 days" filter + Clay job-change tracking + LinkedIn "started new position".
- Hook prefix: soft congrats + "most {{role}}s in your first quarter inherit a messy contractor/e-invoicing setup — happy to share what good looks like."
- Route to the matching hero cell's copy with the new-exec prefix swapped in.

### Tier 3 — Recent funding (LV-03)

Just-raised company scales headcount fast → contractor mix grows → compliance debt accrues.

- Source: Crunchbase / Dealroom (EU) / Magnitt (Gulf) — filter seed–Series B, last 6 months, target geos.
- Hook: "congrats on the raise — the scaling phase is exactly when contractor classification + invoicing debt piles up quietly."

## Scoring model (add columns to prospects.csv)

| New column | Values | Use |
|------------|--------|-----|
| `trigger_type` | hiring_post / new_exec / funding / none | which signal fired |
| `trigger_detail` | free text (e.g. "6 B2B roles on JustJoin, posted <14d") | the personalization fuel |
| `trigger_score` | hot / warm / cold | send order: hot first |
| `trigger_date` | date observed | freshness (decay after ~30d) |

**Send order rule:** within each hero cell, send `hot` triggers first, then `warm`, then static `cold` fill. Burns the highest-intent prospects while warmup capacity is scarce.

## Workflow integration

1. Build hero-cell base list in Apollo (firmographic) → ~50 per cell.
2. Overlay triggers: cross-reference against hiring-post scrape + Apollo job-change/funding filters.
3. Tag `trigger_*` columns. Hot/warm float to top.
4. Personalize step-1 opener with `trigger_detail` (the one line that proves you looked).
5. Static-cold leads fill remaining daily warmup capacity.

## Effort estimate (fits 2-week buffer)

| Task | Time |
|------|------|
| Set up JustJoin/NoFluff/Pracuj + StepStone + LinkedIn Jobs saved searches per hero geo | 2 h |
| First manual hiring-post pass for 4 hero cells (120 leads) | 4 h |
| Apollo job-change + funding filters configured | 1 h |
| Add trigger columns to Sheet + send-order rule | 30 min |
| **Total** | **~7.5 h** across W1–W2, parallel to warmup |

## What this changes in expected results

Static-list baseline reply rate (first campaign): 3–6%. With Tier-1 hiring-trigger overlay on the hero cells: realistically 8–15% on the hot segment. That is the difference between 6 meetings and 15 from the same 120 sends — without touching the release date.
