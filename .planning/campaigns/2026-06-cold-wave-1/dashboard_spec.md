# GTM Dashboard — observability spec

Single Looker Studio dashboard (`cold-wave-1-dashboard`) pulling from the Google Sheet, plus PostHog event taxonomy + Slack routing. Built so you can answer "where is the biggest pressure?" across 16 cells × 3 channels at a glance.

---

## 1. Looker Studio — 5 tabs

### Tab 1 — Wave overview

Single-page exec view. Top section = "right now this month."

| Widget | Metric | Source | Refresh |
|--------|--------|--------|---------|
| Scorecard | Emails sent total | `prospects.send_status` count where ≠ `not_started` | 1 hr |
| Scorecard | Open rate | (sum opens / sum sent) — Instantly export | daily |
| Scorecard | Reply rate | (`replied` + `booked`) / sent | 1 hr |
| Scorecard | Meetings booked | `prospects.send_status = booked` | 1 hr |
| Scorecard | Pilots signed | `prospects.notes` flagged `PILOT_SIGNED` OR HubSpot deal stage | daily |
| Scorecard | MRR live | manual entry tab `mrr_log` | weekly |
| Line chart | Sent + replies + meetings weekly | aggregated | weekly |
| Funnel | Sent → Open → Reply → Meeting → Pilot → Paid | aggregated | daily |

### Tab 2 — Cells leaderboard

16-row table. One row per cell. Sortable. Auto-color-coded.

| Column | Calc | Threshold |
|--------|------|-----------|
| Cell ID | from `cells.csv` | — |
| Sent | count in `prospects` | — |
| Reply rate | replies / sent | green ≥ 8%, yellow 4–8%, red < 4% |
| Meeting rate | bookings / sent | green ≥ 2%, yellow 1–2%, red < 1% |
| Meeting / reply | booked / replied | green ≥ 30% (high-intent), yellow 15–30%, red < 15% |
| Pilot count | from cells + deals | — |
| Cost-per-meeting | (Apollo + Instantly + Workspace allocation) / meetings | red if > $200 |
| Verdict | rule (see below) | `SCALE / HOLD / KILL` |

**Verdict rule:**
- `SCALE` if reply_rate ≥ 8% AND sent ≥ 30
- `KILL` if reply_rate < 2% AND sent ≥ 60
- `HOLD` otherwise (default during warmup phase, sub-60 sample)

Quadrant chart bottom of tab: x = volume sent, y = reply rate. Each cell is a dot labeled by `cell_id`. Top-right = scale candidates, bottom-left = kill candidates.

### Tab 3 — Geo heatmap

Country choropleth + table.

| Widget | Detail |
|--------|--------|
| Map | DE / PL / UK / AE / SA shaded by reply_rate. |
| Bar chart | Bookings + pilots per country |
| Table | Geo × segment cross-tab. Identifies whether DE-AGE vs DE-SMB drives DE signal. |
| Anomaly | Country with reply_rate > median × 1.5 flagged "lean in here." |

### Tab 4 — Copy A/B

Per-cell variant performance. Once B variant ships W4+.

| Column | |
|--------|--|
| Cell | |
| Variant A: sent / reply / book / book-rate | |
| Variant B: sent / reply / book / book-rate | |
| Winner | rule: winner if 95% confidence + > 1pp absolute reply-rate gap |
| Subject line stats | open rate per subject (Instantly column) |

### Tab 5 — Channel mix

Cross-channel rollup: cold email + content/SEO + partnerships.

| Channel | Touchpoints | Meetings | Pilots | $ in pipeline |
|---------|-------------|----------|--------|---------------|
| Cold email | sum sent | sum booked | from HubSpot | from HubSpot |
| Content/SEO | GSC clicks + newsletter subs | content-attrib meetings | content-attrib pilots | content-attrib $ |
| Partnerships | partner conversations live | partner-referred meetings | partner-referred pilots | partner-referred $ |
| LinkedIn (M3+) | (off until phase 2) | | | |

Cost-per-pipeline-dollar per channel = monthly spend / $ in pipeline. Auto-rank.

---

## 2. PostHog event taxonomy

Already in stack per CLAUDE.md. Reuse existing instance. Add these events with consistent UTM/properties tagging.

| Event | Properties | Where fired |
|-------|------------|-------------|
| `landing_view` | `geo, lang, utm_source, utm_medium, utm_campaign, utm_content (cell_id)` | All landing pages |
| `one_pager_download` | `geo, lang, source_lead_id (optional)` | One-pager link click |
| `cal_booking_started` | `geo, utm_campaign, source` | Cal.com embed first interaction |
| `cal_booking_completed` | `geo, utm_campaign, source, slot_time` | Cal.com webhook → POST to `/api/posthog-bridge` |
| `unsubscribe_submitted` | `email_domain, geo, source_lead_id` | Unsubscribe form submit |
| `partner_form_submit` | `partner_type, geo, contact_role` | Partnership-interest form |
| `article_view` | `slug, geo, lang` | Content article page load |
| `article_read_complete` | `slug, geo, lang, scroll_depth_pct, time_on_page_sec` | 75% scroll OR 3 min on page |
| `newsletter_subscribed` | `geo, source_article, lang` | Substack signup webhook |
| `demo_clicked` | `geo, location_in_funnel, utm_campaign` | Any "Book demo" / "Demo" CTA |
| `pricing_viewed` | `geo, lang, scroll_depth_pct` | Pricing page (when exists) |

**UTM convention for all email + content links:**

```
utm_source=email|content|partner|linkedin|newsletter
utm_medium=cold|organic|referral|paid
utm_campaign=<cell_id>|<article_slug>|<partner_id>
utm_content=<variant_id_or_step_number>
```

Example link in cold email step 1: `https://contractor-ops.com/de/scheinselbst?utm_source=email&utm_medium=cold&utm_campaign=DE-AGE&utm_content=variantA-step1`

---

## 3. Slack channel routing

5 channels in free workspace. All notifications via webhook (Zapier/Make free tier OR `apps/cron-worker` job — internal preferred per CLAUDE.md).

| Channel | Events | Volume | Action expected |
|---------|--------|--------|------------------|
| `#gtm-replies` | Instantly reply detected | high (5–25/wk during wave) | Eyeball within 4 hr, manually qualify in HubSpot |
| `#gtm-bookings` | Cal.com booking completed | medium (3–10/wk) | Auto-tag in HubSpot + research prospect 24 hr pre-meeting |
| `#gtm-content` | Article published / GSC ranking change ≥ 5 positions / newsletter milestone | low (1–3/wk) | Celebrate + repost to LinkedIn |
| `#gtm-partnerships` | Partnership reply / MOU update / first refer from partner | low (1–5/wk) | Manual response same-day |
| `#gtm-alerts` | bounce rate > 3% (24 hr window) / deliverability drop / unsubscribe spike (>2x 7-day avg) / domain blacklist hit / Apollo credit < 100 | rare | Pause sends, diagnose root cause same-day |

**Webhook source map:**
- Instantly → `#gtm-replies`, `#gtm-alerts` (native integration)
- Cal.com → `#gtm-bookings` (native)
- HubSpot → `#gtm-bookings`, `#gtm-partnerships` (deal stage change)
- GSC API → `#gtm-content` (custom cron job in `apps/cron-worker` reading GSC daily)
- PostHog → `#gtm-alerts` (anomaly via insight subscription)

---

## 4. Decision-gate rules (auto-enforced via dashboard verdict column)

Per cell:

| Condition | Verdict | Action |
|-----------|---------|--------|
| `sent < 30` | `WARMUP` | Wait for sample. No copy iteration yet. |
| `sent ≥ 30 AND reply_rate < 2%` | `KILL` | Rewrite copy + re-test on 30 more |
| `sent ≥ 60 AND reply_rate < 2%` after rewrite | `DEAD` | Drop cell for this wave. Re-attempt wave 2 with different angle. |
| `sent ≥ 30 AND reply_rate 4–8%` | `HOLD` | Continue at current cadence |
| `sent ≥ 30 AND reply_rate ≥ 8%` | `SCALE` | Double next wave's volume for this cell |
| `meeting_rate / reply_rate < 15%` | `LOW-INTENT` | Replies but no meetings = wrong CTA. A/B-test CTA before scaling. |

Per channel (Tab 5):

| Condition | Action |
|-----------|--------|
| Cold email $ per booked meeting > $250 | Investigate copy + verifier; pause if persists 2 weeks |
| Content visits / mo < 100 by end M2 | Distribution problem, not content problem — double down on LinkedIn + forum posting |
| Zero partner replies after 2 weeks of pitches | Wrong contact targeting; re-research partnership-lead role per company |

---

## 5. Cadence

| Cadence | What | Who |
|---------|------|-----|
| Daily 09:00 | Glance `#gtm-replies` + `#gtm-bookings` + `#gtm-alerts` | Mateusz |
| Weekly Friday | Open dashboard, review Tab 2 (cells leaderboard) + Tab 5 (channel mix). Note verdicts. Write 3-bullet weekly recap to `wkly_recap.md` | Mateusz |
| Bi-weekly | Per-cell verdict decisions: scale, hold, kill. Update `cells.csv` columns + Instantly campaign caps. | Mateusz + Claude |
| W3 / W6 / W9 / W12 gates | Channel reallocation decision per `GTM_PLAN.md` gate spec | Mateusz |

---

## 6. Setup checklist (one-time, ~3 hours)

1. Looker Studio: create blank report → connect Google Sheet `cold-wave-1` → build 5 tabs above. **~90 min**
2. PostHog: add event definitions + property whitelist for UTM convention. **~30 min**
3. Cron worker: write small job `apps/cron-worker/src/jobs/gsc-daily-export.ts` to push GSC data to Sheet daily. **~45 min**
4. Slack: create workspace + 5 channels + webhooks for Instantly + Cal + HubSpot. **~30 min**
5. Make.com / Zapier free tier: one zap for Cal.com webhook → PostHog event POST (if not building bridge route). **~15 min**

Total: **~3.5 hours** distributed across W0–W1.
