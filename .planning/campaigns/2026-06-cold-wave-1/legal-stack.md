# Legal & compliance stack — what blocks what

> NOT legal advice. This maps the documents/obligations the campaign + public site + product need, what each one blocks, who produces it, and cost. Verify with a lawyer before the gates marked ⚖️. Complements `positioning-and-liability.md` (product liability) and `compliance.csv` (per-geo cold-email lawful basis).

## TL;DR — three blocking gates

1. **Before wave-1 SEND (24 Jun):** a live **Privacy Policy** (cold-email footer must link it — GDPR Art 14) + **Impressum** for DE + opt-out (have) + cookieless-analytics decision. ← the only legal item that gates the send.
2. **Before public website / content live:** Privacy + Cookie notice + Impressum.
3. **Before first paying customer:** ⚖️ **ToS** + **customer-facing DPA** + lawyer review (liability cap + DE RDG/StBerG) + E&O insurance (from `positioning-and-liability.md`).

Everything else is accountability hygiene that runs alongside.

## Document map

| # | Document | Required because | Blocks | Producer | Cost |
|---|----------|------------------|--------|----------|------|
| A | **Privacy Policy / Datenschutzerklärung** | GDPR Art 13/14 — any personal-data processing incl. cold prospects + site visitors + lead capture. Must list controller, data, purposes, lawful basis, processors, transfers, retention, rights. | **Wave-1 send + website + lead capture** | Generator v1 → ⚖️ lawyer review later | iubenda ~€29–99/yr |
| B | **Terms of Service / AGB** | Contract with paying customers. Liability cap, "decision-support not advice", indemnification, SLA, IP, termination. | **First paying customer / signup** | Generator v1 → ⚖️ lawyer review | incl. in iubenda / ~€500 lawyer |
| C | **Cookie Policy + consent** | ePrivacy / TTDSG (DE) / PECR (UK) / Telecomwet (NL) — non-essential cookies/trackers. | **Website w/ analytics** — but see mitigation ↓ | iubenda cookie tool | incl. |
| D | **DPA — two directions** | (1) You offer one TO customers (you're processor of their contractor data). (2) You accept ones FROM your processors (Apollo/Instantly/Clay/HubSpot/Google/PostHog/MillionVerifier/Cal). | (1) **first customer**; (2) accept now, keep on file | (1) ⚖️ lawyer/template; (2) just sign theirs | low |
| E | **Impressum / Legal Notice** | DE DDG §5 mandatory on DE-facing site + sender identification in DE cold email (UWG). Entity, address, register no., VAT ID, managing director. | **DE website + DE sends** | self (entity facts) | €0 |
| F | **ROPA (Records of Processing, Art 30)** | Accountability — cross-border processing at scale. Internal, not public. | GDPR audit-readiness | self (template) | €0 |
| G | **Sub-processor list** | Transparency — public list of processors. | website / DPA transparency | self (from tool list) | €0 |
| H | **SCC / transfer mechanism** | US processors (Apollo/Instantly/Clay/HubSpot) = EU→US transfer. Rely on their SCCs + Data Privacy Framework cert. | accountability | verify each processor is DPF-certified or has SCCs | €0 |
| I | **Newsletter / marketing consent** | DE double opt-in for newsletters. ⚠️ See correction ↓ | newsletter launch | Substack handles double-opt-in | €0 |
| J | **AI / automated-processing disclosure** | Classification = automated processing of contractor data. GDPR Art 22 disclosure. | privacy policy clause | fold into A | €0 |

## Cookie/analytics — the smart mitigation

Run analytics **cookieless + EU-region** → drastically reduces or eliminates the intrusive consent-banner requirement (no non-essential cookies to consent to).

- PostHog supports cookieless mode (no `$device_id` cookie; memory/session-only) and EU cloud / self-host EU.
- Result: only a short cookie *notice* needed, not a blocking opt-in wall. Higher conversion (no banner friction) + simpler compliance.
- **Decision: go cookieless v1.** Revisit only if you later need cross-session attribution that requires cookies (then add a proper consent layer).
- Caveat: UTM params in URLs are fine (not cookies). Email open/click tracking pixels are separate — see below.

## ⚠️ Corrections to earlier plan

1. **No auto-enrolling cold contacts into the newsletter.** Cold email = B2B legitimate interest; a marketing newsletter = separate marketing consent (DE: double opt-in). You may *invite* cold prospects to subscribe; you may not silently add them. Substack double-opt-in handles this — keep the two lists + lawful bases separate.
2. **Email open-tracking pixels are contentious in DE.** Some DPAs treat open-tracking as needing consent. For cold B2B: either disable open-tracking for DE sends (Instantly toggle) or document a legitimate-interest assessment + accept low risk. Click-tracking via UTM redirect is lower risk. Decide per geo; default to lighter tracking for DE.

## Producer strategy (solo-founder realistic)

- **v1 now (launch):** a reputable multi-jurisdiction generator. **iubenda** recommended — best EU multi-language + cookie consent + auto-updates on law changes; generates Privacy + Cookie + ToS baseline; hosts them. Alternatives: Termly, GetTerms.
- ⚖️ **Lawyer review GATE before first paying customer** — same gate as E&O in `positioning-and-liability.md`. A DE (+ PL) lawyer reviews: liability-cap enforceability, RDG/StBerG-safe framing, ToS indemnification, customer DPA. Budget a few hours (~€500–1500).
- **Self-produced:** Impressum, ROPA, sub-processor list (just facts + a template).

## Processor DPA / DPF checklist (accept theirs, keep on file)

| Processor | Data it touches | Action |
|-----------|-----------------|--------|
| Apollo (US) | prospect personal data | sign their DPA; confirm DPF/SCC |
| Instantly (US) | prospect data + email content | sign DPA; confirm SCC; set DE open-tracking off |
| Clay (US) | enrichment personal data | sign DPA; confirm SCC |
| MillionVerifier | emails for verification | sign DPA; confirm retention/deletion |
| HubSpot (US) | CRM personal data | sign DPA; DPF-certified |
| Google Workspace (US) | mailboxes + Sheets data | DPA via Workspace terms; DPF |
| PostHog | site analytics | EU cloud + cookieless; DPA |
| Cal.com | booking personal data | DPA; EU option |

## Blocking-gate timeline

| Gate | Items | Deadline |
|------|-------|----------|
| **G1 — wave-1 send** | Privacy Policy live + linked in email footer; Impressum (DE); cookieless analytics set; suppression/opt-out (have) | by 24 Jun |
| **G2 — public site/content** | Privacy + Cookie notice + Impressum on contractor-ops.com | before ART-01 publish (W2) |
| **G3 — first paying customer** | ⚖️ ToS + customer DPA + lawyer review + E&O | before any signature |
| **G-ongoing** | ROPA + sub-processor list + processor DPAs on file | rolling |

## Open items (⚖️ = needs lawyer)

- [ ] Buy iubenda (or Termly) → generate Privacy + Cookie + ToS v1; host on contractor-ops.com
- [ ] Write Impressum (DE) from entity details
- [ ] Set PostHog to cookieless + EU
- [ ] Set Instantly DE open-tracking off (or LIA-document it)
- [ ] Collect + file processor DPAs (table above)
- [ ] Write ROPA (Art 30) from the processor + data-flow list
- [ ] ⚖️ Lawyer review before first paying customer (liability cap + RDG/StBerG + customer DPA)
- [ ] Confirm contracting entity is the sp. z o.o., not the individual (also in positioning-and-liability.md)

## Cross-refs

- `positioning-and-liability.md` — product liability, E&O, RDG/StBerG (same lawyer gate)
- `compliance.csv` — per-geo cold-email lawful basis + opt-out mechanics
- `asset_specs.csv` — ASSET-15 unsubscribe page, ASSET-17 brand DMARC
