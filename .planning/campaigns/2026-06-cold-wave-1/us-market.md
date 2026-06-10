# US market — can we add it? Two wedges, one answer.

> Grounded in a 2026-06-08 codebase recon. NOT legal advice. CMO analysis of whether/how US enters the campaign.

## The core problem: our #1 lever doesn't exist in the US

Everywhere else the go-to hook is a **deadline-driven e-invoicing mandate** (KSeF / Wachstumschancengesetz / ZATCA / Peppol). The US has **no federal e-invoicing mandate** — that hook evaporates. So US is not "another geo cell"; it needs a different thesis.

## Two completely different "US" plays — do not conflate

### Wedge A — US-DOMESTIC (1099 vs W-2, AB5/ABC classification) → ❌ NOT NOW

| Blocker | Detail |
|---------|--------|
| Product not built | Recon: W-9/W-8, 1099-NEC, IRIS e-file = Phase 86; US worker-classification = Phase 87; ACH = Phase 88. All ~H2 2026, none shipped. Nothing US-domestic to demo. |
| Highest-liability surface | US worker misclassification = massive penalties + class actions. This is exactly the classification-verdict liability we engineered away (`positioning-and-liability.md`) — and worse in the US for a solo non-US founder. |
| No mandate hook | No e-invoicing deadline. The only deterministic US analog is the 1099-NEC e-file deadline (Jan 31) — see "Future" below. |
| Brutal competition | Deel / Rippling / Gusto / Justworks home turf. Head-on US-domestic = a knife fight on their ground. |

**Verdict:** defer. Revisit as a **Q4 2026 → Jan 2027 wave**, gated on Phase 86 shipping (1099-NEC + IRIS e-file). That deadline (FIRE decommissions 2026-12-31 → IRIS mandatory for TY2026; recipient 1099s due Jan 31 2027; IRS e-file threshold now 10+ forms) IS a real deterministic hook — but only once the feature exists and only in the Nov–Jan window. Not a June/summer play.

### Wedge B — US-OUTBOUND (US companies hiring contractors in EU/PL/Gulf) → ✅ ADD

This flips US from "compete on their turf with no product" to "sell our existing strength to a new buyer."

| Why it works | Detail |
|--------------|--------|
| Plays our differentiator | A US startup with devs in Poland, a contractor in Germany, someone in Dubai needs KSeF, Scheinselbst documentation, Saudization, EU/Gulf e-invoicing. That's our jurisdictional edge vs generic US tools. Deel does it but generic/pricey; we're the compliance-depth play. |
| Zero new product | Sells the EXISTING EU/Gulf features to a US-HQ buyer. No Phase 86+ dependency. |
| Demo gap disappears | They're buying EU/Gulf compliance → you demo the EU/Gulf flow (golden tenant). No US-specific product needed. |
| Low liability | Lead = e-invoicing + ops + documentation, NOT US classification. Same de-risked posture as everywhere. |
| Lighter compliance | US cold email = CAN-SPAM (opt-OUT), far lighter than GDPR — see legal below. |
| No new infra | English; reuse `contractorops.io` (EN+Gulf inbox already warming). No 4th domain. |

**Verdict:** add as a **Wave 2 cell (US-OUT)**, English, CAN-SPAM. Not in sub-wave 1 (don't dilute the proven 24 Jun EU/Gulf launch); folds into the W4–W5 expansion or a dedicated US-OUT mini-wave once `contractorops.io` reputation is established by Gulf sends.

## US-OUT ICP

- **Who:** US-HQ companies (Seed–Series C, 20–300 ppl) with a distributed contractor/dev workforce in EU/PL/Gulf.
- **Persona:** Founder / COO / Head of Finance / Head of People — whoever owns "we pay people in 6 countries and compliance is a mess."
- **Signal triggers:** hiring remote/EU contractor roles on US job boards; "remote (EU/global)" postings; recently raised + scaling internationally; already using Deel/Remote (category-aware = warmer).
- **Pain:** patchwork of local invoicing/classification rules their US stack ignores; Deel bill climbing; no audit trail for EU/Gulf-side compliance.

## Legal for US (lighter than EU — good news)

| Item | US rule | vs our EU posture |
|------|---------|-------------------|
| Cold email | **CAN-SPAM** — opt-OUT model: identify sender, valid physical postal address, working opt-out honored ≤10 business days, no deceptive subject/headers. No prior consent needed. | EASIER than GDPR legitimate-interest. |
| Website privacy | **CCPA/CPRA** (California) + ~20 state laws — "Do Not Sell/Share" + privacy notice if targeting CA residents at threshold. | iubenda covers US state laws too (`legal-stack.md`). |
| Data transfer | US buyer data → fine; our EU processors already DPF/SCC. | No new transfer issue. |
| Sender ID | CAN-SPAM physical address in footer (already doing for DE Impressum). | Reuse footer. |

**Net:** US-OUT adds almost no legal overhead — CAN-SPAM footer (already have address) + CCPA covered by iubenda. Add a US physical address or use a registered-agent/virtual address in the footer.

## Demo posture for US-OUT

Demo = the **same golden tenant**, walked from the angle "here's your Polish dev's KSeF invoice + your German contractor's Scheinselbst evidence pack + your Dubai contractor's Saudization view — one dashboard, your US entity on top." No US product needed. The EU/Gulf depth IS the pitch.

## What I changed / added

| File | Change |
|------|--------|
| `cells.csv` | +US-OUT cell (wave 2, English, e-invoicing/ops lever, US-HQ + EU/Gulf contractors ICP) |
| `copy_templates.csv` | +US-OUT 3-step sequence (English, US-outbound angle, CAN-SPAM footer note) |
| `compliance.csv` | +US row (CAN-SPAM + CCPA) |
| `levers.csv` | +LV-23 US-OUTBOUND (add wave 2) + LV-24 US-DOMESTIC-1099 (Q4, gated Phase 86) |
| `GTM_PLAN.md` | US note in lever-expansion section |

## Timing summary

| Play | When | Gate |
|------|------|------|
| US-OUT (outbound) | Wave 2 / W4–W5 (~mid-July onward) | `contractorops.io` reputation warm + CAN-SPAM footer + US address |
| US-domestic 1099 | Q4 2026 → Jan 2027 wave | Phase 86 ships (1099-NEC + IRIS e-file) |
| US-domestic classification | not planned for campaign | Phase 87 + E&O + US legal review (high liability) |

## Open items

- [ ] US physical/registered-agent address for CAN-SPAM footer
- [ ] iubenda: enable US/CCPA in the privacy + cookie config (`legal-stack.md`)
- [ ] Decide US-OUT inbox: reuse `contractorops.io` (recommended) vs dedicated `.com`
- [ ] Q4 reminder: re-evaluate US-domestic 1099 wave when Phase 86 lands
