# Classification legal cost — per region

> ⚠️ ESTIMATES, NOT QUOTES. Ballpark 2026 ranges to budget with; actual fees vary widely by firm, scope, and how clean your positioning is. Get real quotes from local counsel before committing. NOT legal advice. Pairs with `positioning-and-liability.md` + `legal-stack.md` + `us-gtm-plan.md`.

## The reframe that controls the cost (read first)

You are NOT buying "an opinion that we can issue binding classification verdicts." That product — a vendor that legally adjudicates employment status — is expensive-to-impossible for a solo founder and is exactly the liability we designed away.

You ARE buying the cheaper thing: a **positioning opinion** confirming the de-risked design is sound in each jurisdiction —

1. "contractor-ops is software + documentation, NOT legal/tax advice" (the regulated-practice question: DE RDG/StBerG, PL doradztwo podatkowe, US UPL, etc.)
2. the licensed **partner** (Steuerberater / doradca / CPA / EA / solicitor) carries the determination
3. ToS liability cap + indemnification + "decision-support not advice" holds up
4. E&O insurance backstops the residual

Because the partner bears the determination, the per-region legal is a **fraction** of the "we adjudicate" version. And you only pay it **where you actually ship the classification-documentation feature** — not in regions where you lead with e-invoicing / ops / 1099 (those need only the basic Privacy + ToS, almost no classification legal).

## The cheapest path: don't ship a classifier at v1 (ZERO classification legal)

Even the "fraction" above is optional at launch. If v1 **shows + organizes + generates documents but makes no inference** (classification engine OFF — which is already the default production state, flag `module.classification-engine` dark for normal customers), you are pure SaaS outside the regulated grey zone, and the **per-region classification legal in this whole document drops to €0 until you choose to turn it on.**

| Launch posture | Classification legal at launch |
|----------------|--------------------------------|
| Ship classifier live (Level 2–3) | per-region opinions below (€3.5–10k each) |
| **Ship "shows, doesn't classify" (Level 0–1)** | **€0 classification legal** — only base SaaS: iubenda Privacy+ToS (~€100/yr) + base tech E&O (~€0.8–2k/yr) |

The per-region figures below apply **only when/where you later switch the classifier on** — one region at a time, gated on a signed determination-bearing partner. See `positioning-and-liability.md` → "shows, doesn't classify" for the full spectrum + trade-off. This is the recommended v1 path and makes the rest of this document a *future* budget, not a *launch* budget.

## Cost components (what "classification legal" actually bundles)

| Component | Type | What it is |
|-----------|------|------------|
| Positioning opinion | one-time | Counsel confirms "software-not-advice" + partner-carries-determination is lawful in-region |
| ToS/DPA increment | one-time | The classification-specific clauses on top of base ToS (cap, indemnity, no-warranty-of-outcome) |
| E&O / professional indemnity | annual | Insurance backstop; scales with coverage limit + perceived risk |
| Entity / nexus (if needed) | one-time + annual | Only where selling needs a local entity/registered agent |
| Ongoing watch | annual | Re-review when the law shifts |

## Per-region estimates

All ranges assume the **de-risked / partner-shield** model (not vendor-adjudicates). Local currency noted; EUR-equivalent for comparison.

### Germany (DE) — highest regulated-practice sensitivity
| Component | Estimate |
|-----------|----------|
| Positioning opinion (RDG/StBerG-safe, IT/Wirtschaftskanzlei) | €2,000–6,000 one-time |
| AGB/ToS + DPA (German law) classification increment | €1,500–4,000 one-time |
| Berufs-/Vermögensschadenhaftpflicht (E&O), €1–3M | €800–2,500 /yr |
| Ongoing watch | €1,000–3,000 /yr |
| **DE total** | **~€3,500–10,000 one-time + ~€1,800–5,500 /yr** |

RDG/StBerG is the serious one — the positioning opinion here is non-negotiable before any DE classification-doc sale.

### Poland (PL) — doradztwo podatkowe reserved
| Component | Estimate (PLN) | EUR-eq |
|-----------|----------------|--------|
| Positioning opinion (radca prawny / doradca podatkowy) | PLN 8,000–25,000 one-time | ~€1,800–5,800 |
| ToS + RODO DPA classification increment | PLN 5,000–15,000 one-time | ~€1,200–3,500 |
| OC zawodowe (PI), ~€1M | PLN 2,000–8,000 /yr | ~€460–1,850 |
| Ongoing | PLN 3,000–8,000 /yr | ~€700–1,850 |
| **PL total** | | **~€3,000–9,300 one-time + ~€1,200–3,700 /yr** |

### United Kingdom (UK) — no reserved activity for classification; lighter
| Component | Estimate (GBP) | EUR-eq |
|-----------|----------------|--------|
| Positioning / IR35-marketing review (solicitor) | £1,500–5,000 one-time | ~€1,750–5,800 |
| ToS + UK GDPR DPA increment | £1,500–4,000 one-time | ~€1,750–4,650 |
| Professional indemnity, £1–2M | £600–2,000 /yr | ~€700–2,350 |
| Ongoing | £800–2,500 /yr | ~€930–2,900 |
| **UK total** | | **~€3,500–10,500 one-time + ~€700–2,350 /yr** |

UK is the least regulated for this — the client carries the SDS by statute, so your exposure is mostly marketing-claims + contract, not reserved practice.

### Netherlands (NL) — Wet DBA
| Component | Estimate |
|-----------|----------|
| Positioning opinion (DBA-safe, documentation-not-determination) | €2,000–5,000 one-time |
| ToS + AVG DPA increment | €1,500–3,500 one-time |
| Beroepsaansprakelijkheidsverzekering (PI) | €700–2,000 /yr |
| Ongoing | €1,000–2,500 /yr |
| **NL total** | **~€3,500–8,500 one-time + ~€700–2,000 /yr** |

### Gulf (UAE + SA) — two jurisdictions; classification less central (Saudization is arithmetic)
| Component | Estimate (USD) |
|-----------|----------------|
| Local counsel opinion — UAE (labor + PDPL + commercial) | $3,000–10,000 one-time |
| Local counsel opinion — KSA (labor + PDPL + Saudization context) | $3,000–10,000 one-time |
| ToS + PDPL DPA increment | $2,000–6,000 one-time |
| Local PI insurance (less mature market) | variable, ~$1,000–4,000 /yr |
| Entity / commercial presence (often required to contract locally) | $5,000–15,000+ setup + annual — SEPARATE, bigger item |
| **Gulf total (legal only, both)** | **~$8,000–26,000 one-time + ~$1,000–4,000 /yr** (entity extra) |

Gulf nuance: your Gulf lever is **Saudization tracking** (arithmetic vs public bands) = low legal need on the classification axis. The real Gulf cost is **commercial presence / entity**, not classification legal. Don't over-spend on classification opinions here; spend on entity if/when you commit.

### United States (US) — most fragmented + most expensive
| Component | Estimate (USD) |
|-----------|----------------|
| Positioning opinion (UPL — "documentation not legal advice") + classification-doc framing across key states | $5,000–20,000 one-time |
| ToS + US DPA + state privacy (CCPA/CPRA) increment | $3,000–10,000 one-time |
| Tech E&O / professional liability, $1–2M | $1,500–6,000 /yr (higher with classification exposure) |
| US entity (Delaware C-corp/LLC) + registered agent | $500–2,000 setup + $100–300/yr + franchise tax |
| Ongoing (50-state patchwork watch) | $2,000–6,000 /yr |
| **US total** | **~$8,500–32,000 one-time + ~$1,800–6,500 /yr** (entity extra) |

US is the priciest because of UPL + the 50-state classification patchwork (CA ABC/AB5 etc.) + class-action culture. This is precisely why the **US-PAR (CPA/EA) partner shield is mandatory** before selling US classification — the CPA bears the determination, slashing your opinion scope. Full "we adjudicate US classification" legal would be multiples of the above and is off the table.

## Roll-up

| Region | One-time (legal) | Annual (insurance + watch) | Notes |
|--------|------------------|----------------------------|-------|
| DE | €3.5k–10k | €1.8k–5.5k | RDG/StBerG = mandatory opinion |
| PL | €3k–9.3k | €1.2k–3.7k | doradztwo podatkowe reserved |
| UK | €3.5k–10.5k | €0.7k–2.4k | lightest (client carries SDS) |
| NL | €3.5k–8.5k | €0.7k–2k | Wet DBA |
| Gulf (UAE+SA) | $8k–26k | $1k–4k | + entity (bigger); classification low-need |
| US | $8.5k–32k | $1.8k–6.5k | + entity; CPA shield mandatory |

**If you did ALL six regions' classification legal up front (you should NOT):** very roughly **~€35k–110k one-time + ~€10k–28k/yr**. That's the maximalist number — and the wrong way to spend.

## How to actually spend it (CMO sequencing)

1. **Wave 1 (24 Jun) needs ~none of this.** You lead with e-invoicing / ops / 1099 / Saudization — deterministic, low-liability. Required legal = base **Privacy + ToS via iubenda (~€29–99/yr)** + DE Impressum. Classification-doc feature is NOT live yet → no classification opinion needed to launch.
2. **Pay per region only when the classification-documentation feature actually ships + sells there.** First likely = wherever your first classification-curious customer + a signed partner appear. Probably 1 region, not 6.
3. **Sign the partner first (Steuerberater / doradca / CPA).** A signed determination-bearer shrinks the opinion scope (and cost) and is the thing that actually de-risks you.
4. **Bundle E&O across regions.** One pan-EU tech-E&O policy often covers DE+PL+NL+UK cheaper than four local policies — ask a broker for a multi-territory quote. US usually separate.
5. **Stage the opinions.** Start with ONE positioning opinion in your primary classification market (likely DE or PL), reuse the structure/template for the next region at lower marginal cost.

**Realistic near-term spend to be safe through wave 1 + first classification region:** iubenda ~€100/yr + one positioning opinion (~€2–6k) + one E&O policy (~€1–2.5k/yr) + ToS increment (~€1.5–4k) ≈ **~€5–13k one-time + ~€1–2.5k/yr** — not the €35k+ maximalist figure.

## Open items

- [ ] Pick the FIRST classification region (where feature + partner land first) — pay only that one initially
- [ ] Broker: multi-territory EU tech-E&O quote (DE+PL+NL+UK) vs per-country
- [ ] Sign determination-bearer partner before commissioning that region's opinion
- [ ] Reuse opinion template across regions to cut marginal cost
- [ ] US: defer until US-domestic classification (Wave 3.5 / Q1 2027) + CPA partner signed
