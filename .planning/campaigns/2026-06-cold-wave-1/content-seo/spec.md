# Content / SEO workstream — 12-week plan

Parallel channel to cold email. Compounds asymptotically — cold mail decays. By end M3, well-executed content drives pipeline equal to or larger than cold mail with 1/3 maintenance time.

## Goals (3-month)

| Metric | Target | Measure via |
|--------|--------|-------------|
| Ranked keywords (top-20 SERP) | 6–10 long-tail jurisdictional | GSC |
| Organic visitors / month per geo | 200–800 | GSC + PostHog `article_view` |
| Newsletter subscribers | 50–150 | Substack |
| Content-attributed SQLs | 5–15 | PostHog → HubSpot deal source |
| Pieces published | 12 | calendar.csv |

## Stack (all Tier 0 free for first 3 months)

| Tool | Use | Cost |
|------|-----|------|
| Google Search Console | Impressions, clicks, queries per article | $0 |
| Google Keyword Planner (via $0 Ads account) | Search volume + competition | $0 |
| AnswerThePublic free | Question-style keyword ideas | $0 |
| Ahrefs Webmaster Tools | Own-site backlink + tech audit | $0 |
| Claude (Code / API) | Article briefs + drafts | already paid |
| Substack | Newsletter + distribution network | $0 |
| LinkedIn (personal Mateusz) | Hero distribution channel | $0 |
| PostHog | On-site engagement + conversion | $0 (in stack) |
| Looker Studio | Cross-source dashboard | $0 |

**Upgrade trigger:** Ahrefs Lite $108/mo only when organic traffic ≥ 1k/mo justifies competitive research. M3+ decision.

## Production process per article

1. **Keyword pick** — pull 5 candidates from GSC opportunities + Keyword Planner + AnswerThePublic. Filter: volume ≥ 200/mo (DE/PL/UK) OR ≥ 50/mo (Gulf). Difficulty proxy ≤ 50.
2. **Intent classification** — informational / commercial / navigational. Match to funnel stage.
3. **Brief** — title, target keyword, sub-headings, word count, key sources to cite, internal links, CTA. Mateusz + Claude. ~30 min.
4. **Draft** — Claude API or Cursor → first draft from brief. Mateusz edits for voice + accuracy. ~90 min.
5. **Expert review** — accuracy pass. For DE: Steuerberater check on jurisdiction claims (paid Fiverr ~$50/article). For PL: native + accountant check. For UK: solicitor or IR35 specialist check (Fiverr ~$50). For SA: bilingual Saudization consultant (LinkedIn freelance ~$80).
6. **SEO polish** — H2/H3 structure, schema markup, alt text, internal links, FAQ structured data where relevant.
7. **Publish** — `apps/landing` (Next.js 16) under `/{geo}/{slug}` or CMS via Payload (apps/cms). Each article has UTM-tagged CTAs to one-pager + Cal.com.
8. **Distribution** — see distribution plan below.
9. **Track** — GSC daily + PostHog `article_read_complete` + Substack subs + Cal bookings attributed.

**Estimated time per article:** 4–6 hr Mateusz + $50–80 expert review.

## Distribution plan (distribution-first, not SEO-first)

| Channel | What | Cadence | Why |
|---------|------|---------|-----|
| LinkedIn (personal) | Native post summarizing each article + link | Day-of publish + repromote D+7 + D+30 | Highest single-channel ROI for B2B founder content |
| Substack | Newsletter issue with article excerpt + CTA | Weekly Friday | Builds direct subscriber list + Substack network amplification |
| Reddit | Genuine reply with article link in `r/staffing` `r/contractoruk` `r/iworkforumbrella` `r/de_EDV` | Within 7 days of publish | High-intent discovery; mod policies require value-add not spam |
| XING (DE) | DE HR groups + Steuerberater groups | Day-of publish | DE-specific; LinkedIn has lower penetration in DE Mittelstand |
| GoldenLine + Wykop.pl (PL) | PL B2B + IT freelancer groups | Day-of publish | PL prefer local networks |
| Hacker News (selectively) | Only the playbook + comparison pieces | Day-of, Tuesday 09:00 EST | Hit-or-miss; one HN front page = 5k visits |
| Twitter / X | Thread-format excerpt | Day-of | Minor channel; cross-post effort low |
| Quora | Answer 2–3 existing high-traffic questions + link to relevant article | Once per article | Long-tail compounds; AI-summarized answers still link out |
| Forum + Discord communities | Founder + GTM communities (Pavilion, Demand Curve, Bestpractices.io) | Discussion thread + share | Lower-volume, higher-quality discussion |
| Outbound LinkedIn DM (warm) | Send article to 5 hand-picked prospects + warm intros | Per article | Soft re-engagement of cold list |

## Hub-and-spoke structure

```
/compliance (hub - ART-10)
  ├── /de (geo hub)
  │   ├── /scheinselbst-pruefung-software (ART-02)
  │   ├── /§7a-sgb-iv-fehler (ART-08)
  │   └── ...
  ├── /pl
  │   ├── /ksef-b2b-kontraktorzy (ART-01)
  │   ├── /b2b-vs-uop-2026 (ART-07)
  │   └── /case-study-pilot-1 (ART-11)
  ├── /uk
  │   ├── /ir35-sds-guide (ART-03)
  │   └── /cest-tool-limitations (ART-09)
  └── /sa
      └── /nitaqat-tracking-2026 (ART-04)
/compare/
  ├── /contractor-ops-vs-deel (ART-05)
  └── /contractor-ops-vs-remote (ART-06)
/playbook/
  └── /multi-jurisdiction-2026 (ART-12)
```

Every article internal-links to:
- 1 hub page above it
- 2 sibling articles in same geo
- 1 cross-geo comparison if relevant
- Demo CTA + one-pager download CTA + Cal.com booking CTA — UTM-tagged differently for attribution

## Measurement

| Metric | Source | Target by W12 |
|--------|--------|---------------|
| Articles published | calendar.csv | 12 |
| Impressions / mo | GSC | 5k–20k |
| Clicks / mo | GSC | 200–800 |
| Keywords in top-20 | GSC | 6–10 |
| Newsletter subs | Substack | 50–150 |
| Avg time on article | PostHog | ≥ 90 sec |
| Article → demo booking | PostHog + HubSpot | 1–5% |
| Total content-attributed SQLs | HubSpot deal source | 5–15 |

Weekly: GSC export → `content_metrics` tab in Sheet → Looker Studio Tab 5.

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| AI-generated content kills rankings via Google updates | medium | Native expert pass + voice editing + original research / data |
| LinkedIn algo demotes external links | high | Always native-post the summary; link in first comment |
| Substack reaches 0 organic | medium | Cross-promote on LinkedIn; pitch crosspost to Bayzat / Personio / inFakt blogs |
| Polish + German keyword volumes lower than estimated | medium | Long-tail strategy embraces low-volume; focus on intent quality not volume |
| Pilot case study (ART-11) blocked if no pilot signed | medium | Anonymous "design partner X" case OR pivot to industry-data piece |

## Deferred to phase 2 (M3+)

- Paid LinkedIn promotion ($50–200/mo per top article)
- Programmatic SEO pages (jurisdiction × industry matrix — 50–100 pages)
- Guest posts on Personio / inFakt / Lexware blogs (warm pitch only after relationships built)
- Video content (YouTube short-form explaining each pain)
- Podcast guesting (founder appearances on SaaS / HR Tech / contractor podcasts)
