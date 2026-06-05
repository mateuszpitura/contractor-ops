# GTM Wave 1 — June–September 2026

> **Scope expanded.** This directory now covers the full 3-channel GTM Wave 1: cold email + content/SEO + payment partnerships, plus a unified observability dashboard. The original cold-email-only plan still lives in the cold-email files; new content + partnerships workstreams in subdirectories.

**Start here:** `GTM_PLAN.md` — master plan tying all 3 channels together.

## Channels

| Channel | Lead artifact | Files |
|---------|---------------|-------|
| **Cold email** | `prospects.csv` + `copy_templates.csv` + `cells.csv` | this dir (root) |
| **Content / SEO** | `content-seo/calendar.csv` + `content-seo/spec.md` | `content-seo/` |
| **Payment partnerships** | `partnerships/targets.csv` + `partnerships/pitches.csv` + `partnerships/terms.md` | `partnerships/` |
| **Observability** | `dashboard_spec.md` + `tools_stack.csv` | this dir (root) |

## Full file index

### Cold email
| File | Purpose | Sheets tab |
|------|---------|------------|
| `prospects.csv` | Lead-level data (30 cols). 8 sample rows; Apollo fills the rest. | `prospects` |
| `copy_templates.csv` | Email sequences per cell × variant × step. 4 worked examples (DE-AGE, PL-SMB, UK-AGE, SA-SMB). | `copy_templates` |
| `cells.csv` | 16 ICP cells with volume target + offer angle + persona. | `cells` |
| `suppression.csv` | Opt-outs, bounces, do-not-contact. | `suppression` |
| `compliance.csv` | GDPR / PDPL lawful basis + opt-out mechanics per geo. | `compliance` |
| `domains.csv` | 2 proposed sending domains + full DNS record set. | `domains` |
| `asset_specs.csv` | What Mateusz produces (demo, deck, calendar, mailboxes, subscriptions). | `asset_specs` |
| `timeline.csv` | 6-week milestone schedule for cold-mail track. | `timeline` |

### Content / SEO
| File | Purpose | Sheets tab |
|------|---------|------------|
| `content-seo/calendar.csv` | 12-week editorial calendar — 12 articles with keywords, distribution channels, internal links. | `content_calendar` |
| `content-seo/spec.md` | Strategy + production process + distribution plan + measurement. | — |

### Partnerships
| File | Purpose | Sheets tab |
|------|---------|------------|
| `partnerships/targets.csv` | 24 partner candidates × 4 geos × 4 types — payment / accounting / HR / EOR-adjacent. | `partnership_targets` |
| `partnerships/pitches.csv` | 7 pitch templates: PL invoicing, DE accounting, EN payment-revshare, EN HR integration, EN competitor-marketplace, plus universal step-2 + step-3 follow-ups. | `partnership_pitches` |
| `partnerships/terms.md` | Revenue-share framework + integration tier definitions + MOU outline. | — |

### Observability + tools
| File | Purpose | Sheets tab |
|------|---------|------------|
| `tools_stack.csv` | Master tool list — 25 tools across cold mail + content + partnerships + dashboard, with cost + when-to-add + alternatives. | `tools_stack` |
| `dashboard_spec.md` | Looker Studio 5-tab spec + PostHog event taxonomy + Slack channel routing + decision-gate rules. | — |
| `sheets-spec.md` | Dropdowns, formulas, conditional formatting to apply after Sheets import. | — |

### Master + supporting
| File | Purpose |
|------|---------|
| `GTM_PLAN.md` | Master plan tying all 3 channels. Resource allocation, milestones, decision gates W3/W6/W9/W12, cross-channel mechanics, risks. **Read first.** |
| `README.md` | This file. |

## How to use

1. **Read `GTM_PLAN.md`** — master plan + decision gates + milestone targets.
2. **Read `tools_stack.csv`** — every tool decision with cost + alternative.
3. **Read `dashboard_spec.md`** — how observability ties channels together.
4. **Read `timeline.csv`** — cold-mail-specific milestones (W0 → W5).
5. **Read each subdir spec.md / terms.md** — per-channel deep dive.
6. **Approve `domains.csv`** — confirm the 2 alt domain names before buying.
7. **Import all CSVs into one Google Sheet** named `gtm-wave-1` as tabs per the file index above. See `sheets-spec.md` for post-import setup (~15 min).
8. **Subscribe to Plan A tools** in `asset_specs.csv` order: Cloudflare → Workspace → Apollo → Instantly → MillionVerifier → Cal.com + HubSpot + Substack + Fathom + Slack (all free).
9. **Start warmup** the day mailboxes go live. 3-week gate before any cold send.
10. **Begin content production** W1 (don't wait for cold send) — first article (ART-01 PL KSeF guide) targets W2 publish.
11. **Begin partnership outreach** W3 (after first cold sends prove deliverability) — first batch P0 + P1 targets.
12. **Launch sub-wave 1 cold mail** end of week 3 (2026-06-24); evaluate per dashboard verdict rules at W6 gate.

## What is NOT here yet — needs your decision

| Decision | Why blocked | Default if you do not decide |
|----------|-------------|------------------------------|
| Final 2 alt-domain names | Need registrar availability check + your taste | `getcontractorops.com` + `contractorops.io` |
| Email signature copy (3 langs) | Need your name presentation + role title | I draft from your LinkedIn |
| Pitch deck / one-pager designer | Mateusz solo or hire? | Solo Canva v1; designer pass v2 |
| DE + PL native proofreader | Need hire | Fiverr (~$30 per language per pass) |
| Brand domain DMARC change | Mateusz must update DNS on `contractor-ops.com` | — |
| One-pager hosting | Where on contractor-ops.com? | `/one-pager-{lang}.pdf` |

## What is NOT here yet — built when triggered

- 12 remaining copy sequences (filled after first 4 prove direction)
- 472 remaining prospects (Apollo exports per cell during W1)
- B variant copy (built after A measures baseline reply rate)
- Arabic copy (Gulf wave 2 - explicit user decision needed to enable)

## Budget summary (Medium tier — verified 2026-06-03 against live pricing)

### Plan A — lean start (recommended for first wave)

| Item | Monthly | One-time | Notes |
|------|---------|----------|-------|
| Apollo Basic | $59 | — | 2,500 credits/mo covers ~500 lead reveals + waterfall. NOT Professional ($99) — extras unused first wave. |
| Clay Free | $0 | — | 500 actions/mo + 100 credits + 200 rows/table. Run personalization A/B on 100-lead test batch. |
| Instantly Growth | $47 | — | Unlimited mailboxes + warmup, 5,000 emails/mo, 1,000 contacts. NOT Hypergrowth ($97) yet. |
| Google Workspace × 2 (Starter, PLN billing) | ~$9.50 (first 90 days promo) → ~$19 normal | — | 18.90 zł/inbox promo / 37.80 zł normal × 2. Skip Standard/Plus — 30 GB + Gmail SMTP enough. Monthly billing first 3 mo (lock 50% promo) then annual (+16% off). |
| 2 alt domains (Cloudflare registrar) | ~$4 | — | `.com` ~$10/yr + `.io` ~$36/yr amortized |
| Cal.com Individuals | $0 | — | Free tier covers all features needed |
| MillionVerifier — 10k credits | $0 | $39 | One-time, never-expire. Skip Automated $15/mo tier — batch verify. |
| Fiverr DE + PL proofread | $0 | ~$60 | One-pass both langs |
| Optional designer (one-pager) | $0 | ~$150 | Skip for v1, Canva solo works |
| **Total Plan A** | **~$119/mo (first 90 days) → ~$129/mo (normal)** | **~$249 setup** | |

### Plan B — full enrichment (only after W3 signal)

Add **Clay Launch +$185/mo** (15k actions, 2.5k credits) ONLY if W3 metrics show Clay-enriched batch beats unenriched by ≥2 pp on reply rate.

| Item | Monthly (promo / normal) | One-time |
|------|--------------------------|----------|
| Plan A baseline | $119 / $129 | $249 |
| Clay Launch (upgrade) | +$185 | — |
| **Total Plan B** | **~$304/mo (promo) → ~$314/mo (normal)** | **~$249 setup** |

### Pricing deltas from earlier estimate

| Tool | Old estimate | Actual (2026-06-03) | Delta |
|------|--------------|---------------------|-------|
| Apollo Basic | $99 | $59 | **−$40** |
| Clay Starter | $149 | gone — cheapest paid now Launch $185 | conditional |
| Instantly Growth | $37 | $47 | +$10 |
| MillionVerifier 10k | $30 once | $39 once | +$9 |
| Cal.com | $0 | $0 | 0 |

Expected output of first 480-lead wave at baseline (5-10% reply, 30-50% reply→meeting):
- 24-50 total replies
- 8-25 qualified meetings
- 2-6 pilots / partnerships

Iterate copy on W3 data, expect 1.5-2x improvement by wave 2.

## Compliance reminders

- Every email must include: sender name, contractor-ops, physical address (for DE Impressum), one-click unsubscribe.
- Honor opt-outs within 7 days (add to `suppression.csv` immediately).
- Do not send to DE/PL `info@` / `kontakt@` generic addresses without role context (UWG §7 risk).
- UK PECR allows B2B but individual sole traders need consent — skip them on `seniority = IC` for UK self-employed targets.
- Saudi PDPL: keep audit log of every send (Instantly does this; export monthly to `audit/` if needed).

## Next action

1. Open `domains.csv` → approve or replace the 2 proposed domains.
2. Open `asset_specs.csv` → confirm target dates per row or push them out.
3. Tell me which of these to do first when you are back: (a) buy domains + DNS, (b) draft one-pager content, (c) record Loom script.
