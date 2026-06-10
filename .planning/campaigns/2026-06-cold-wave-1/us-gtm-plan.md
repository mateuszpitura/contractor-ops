# US GTM — full plan, phase-aligned (v7.0 Phases 82–88)

> The complete US go-to-market: all segments, levers, partnerships, and waves, tied to product ship phases. Builds on `us-market.md` (the two-wedge rationale). NOT legal advice — US liability gates are MORE important than EU, not less (misclassification = penalties + class actions). Full breadth, liability discipline intact.

## US lever hierarchy (same logic as global, US-flavoured)

The US has no e-invoicing mandate — but it has a **deterministic deadline analog**: 1099-NEC e-filing. That becomes the go-to.

| Priority | Lever | Why it's the US analog | Liability | Product gate |
|----------|-------|------------------------|-----------|--------------|
| 1 — go-to | **1099-NEC e-file deadline + IRIS transition** | Deterministic, deadline-driven (recipient copies due Jan 31; IRS FIRE decommissions 2026-12-31 → IRIS mandatory for TY2026; e-file threshold dropped to **10+ forms** = far more cos forced to e-file). This is the US "KSeF." | Lowest | Phase 86 (1099-NEC + IRIS) |
| 2 — land | **Contractor-ops platform** (W-9 intake, onboarding, payments/ACH, 1099 prep) | Sticky ops; W-9 collection alone is a real pain | Low | Phase 85 (W-forms) + 88 (ACH) |
| 3 — outbound | **US-OUT** (US cos w/ EU/Gulf contractors) | Sells existing EU/Gulf depth; zero US product dependency | Low | none — ships now |
| 4 — feature only | **Classification documentation** (ABC/AB5/IRS-20-factor evidence → routed to CPA/EA) | Makes the CPA's determination defensible; never our verdict | Medium | Phase 87 |
| ❌ never | US worker-classification verdict | Misclassification penalties + class actions; solo non-US founder = max exposure | Highest | — |

**US determination-bearer = licensed CPA / Enrolled Agent (EA).** Same shield logic as Steuerberater/doradca: the CPA/EA carries the 1099-vs-W-2 call (licensed + insured); we are the software + evidence layer. US-PAR (CPA/EA/bookkeeper) cell is the liability shield AND a fast referral channel.

## Product phase → GTM gate map (recon-grounded, 2026-06-08)

| Phase | Ships | Unlocks for GTM | Status (recon) |
|-------|-------|-----------------|----------------|
| 82 Foundation | planning done | region enablement, billing | not executed |
| 83 US infra | planning done | US org routing, R2 bucket, 1099 retention | not executed |
| 84 US profile fields + en-US locale | context gathered | US contractor onboarding, en-US copy | planning not started |
| 85 W-form intake (W-9/W-8) | backlog | **W-9 collection demo + land lever** | not started |
| 86 TIN-match + 1099-NEC + IRIS e-file | backlog | **go-to lever (1099 deadline) + 1099 demo** | not started |
| 87 1042-S + US classification | backlog | classification documentation feature | not started |
| 88 ACH payment rails | backlog | US payouts | not started |

**Implication:** US-OUT goes now (no gate). US-domestic land/go-to waits for Phases 85–86. Realistic: Phase 86 lands H2 2026 → US-domestic 1099 wave ramps **Nov–Dec 2026 toward the Jan 31 2027 deadline.** That timing is perfect — the deadline IS the hook, and it's freshest in Q4.

## US cell set (6 cells)

| Cell | Segment | Lever | Wave | Product gate | Liability |
|------|---------|-------|------|--------------|-----------|
| **US-OUT** | US-HQ, EU/Gulf contractors | ops + EU/Gulf e-invoice | Wave 2 (~mid-Jul) | none | low |
| **US-SMB** | US SMB hiring 1099 contractors | 1099 e-file deadline | Q4 2026 | Phase 85+86 | low |
| **US-AGE** | US staffing/recruiting agencies | 1099 at scale + classification doc | Q4 2026 | Phase 86 (+87) | low-med |
| **US-SWH** | US tech startups, contractor-heavy | ops + 1099 + ACH | Q4 2026 | Phase 85+86+88 | low |
| **US-PAR** | US CPAs / EAs / bookkeeping firms | partnership-determination-layer | Wave 2 (relationship) → Q4 (volume) | none to start | shield |
| **US-ADJ** | US HR/fintech platforms | partnership/integration | Wave 2+ | none | low |

All English, CAN-SPAM (opt-out), reuse `contractorops.io` (or dedicated `.com` if US volume justifies a clean domain — decision below).

## Wave timing

| Wave | Cells | When | Gate |
|------|-------|------|------|
| **US Wave 2 (relationship/outbound)** | US-OUT, US-PAR, US-ADJ | ~mid-July onward | `contractorops.io` warm + CAN-SPAM footer + US address. No product dep. |
| **US Wave 3 (domestic 1099 ramp)** | US-SMB, US-AGE, US-SWH | Nov–Dec 2026 | Phases 85+86 shipped; lead with TY2026 1099 deadline (Jan 31 2027) |
| **US Wave 3.5 (payments + classification)** | upsell existing + US-AGE deep | Q1 2027 | Phases 87 (classification doc) + 88 (ACH) shipped |

## US legal / compliance (lighter outreach, heavier product)

| Area | Rule | Action |
|------|------|--------|
| Cold email | **CAN-SPAM** — opt-out, sender ID, real physical address, opt-out ≤10 biz days, no deceptive headers. No prior consent. | Lighter than GDPR. Need US physical/registered-agent address for footer. |
| Website privacy | **CCPA/CPRA** (CA) + ~20 state laws | iubenda covers (`legal-stack.md`) |
| Product — 1099 filing | IRS e-file via **IRIS** (FIRE sunsets 2026-12-31). Requires a **new IRIS TCC** (~45-day application). | ⚖️ Apply for IRIS TCC early — 45-day lead blocks the 1099 wave. File this as a hard pre-Q4 gate. |
| Product — classification | State patchwork (CA ABC/AB5, others) | Documentation + CPA-routed; never our verdict. ⚖️ US legal review before selling classification doc. |
| Product — payments | ACH NACHA rules (Phase 88) | product concern, not outreach |
| Money transmission | If we touch funds flow, possible MTL exposure | ⚖️ legal review before ACH go-live (Phase 88) |

## US partnerships (determination-bearers + integration channels)

Added to `partnerships/targets.csv`:

| Partner | Type | Deal | Why |
|---------|------|------|-----|
| **Gusto** | payroll/contractor | integration + referral | SMB contractor payroll leader; their customers need deeper 1099 + intl |
| **Intuit QuickBooks (US)** | accounting | marketplace listing | US SMB accounting standard; 1099 prep adjacency |
| **Bill.com** | AP/payments | integration | contractor payouts + 1099 data |
| **Ramp / Brex / Mercury** | fintech (startups) | referral/integration | US startup banking/spend; contractor-heavy customer base |
| **Track1099 / Tax1099 / TaxBandits** | 1099 e-file specialists | integration OR compete-adjacent | IRIS transition pain; either integrate or position against |
| **Avalara** | tax compliance | integration | tax automation ecosystem |
| **ADP / Paychex** | payroll giants | marketplace | enterprise reach; contractor module gaps |
| **US CPA / EA networks (AICPA-adjacent, bookkeeping franchises)** | determination-bearer | revshare/referral | THE liability shield + warm channel; CPAs carry the 1099/W-2 call |

## US demo (once phases ship)

| Phase shipped | Demoable |
|---------------|----------|
| now (83) | US region selection, US org creation, generic ops |
| +85 | W-9 collection flow, contractor onboarding US fields, en-US UI |
| +86 | **1099-NEC generation + IRIS e-file (sandbox) — the hero US demo** |
| +87 | classification documentation + CPA-routing (NOT verdict screen) |
| +88 | ACH payout flow |

Until Phases 85–86 ship, US-domestic demo = region selection + roadmap narrative + US-OUT pitch (EU/Gulf golden tenant). Don't fake 1099 screens that don't exist.

## US-specific levers (added to levers.csv)

- LV-23 US-OUTBOUND (wave 2, confirmed)
- LV-24 US-DOMESTIC 1099-NEC deadline (Q4, gated Phase 86) — **promoted to go-to once shipped**
- LV-25 US-DOMESTIC classification (not led; documentation-only, gated Phase 87 + legal)
- LV-26 IRIS TCC 45-day application (operational gate, not a market lever but blocks the 1099 wave)
- LV-27 US-PAR CPA/EA partner channel (determination shield + referral)
- LV-28 US fintech-startup vertical (US-SWH; Ramp/Brex/Mercury co-marketing)

## Hard gates before US-domestic sells (⚖️ = legal/ops)

- [ ] ⚖️ IRIS TCC application filed (~45-day lead) — blocks 1099 e-file
- [ ] Phases 85 + 86 shipped + tested in IRIS sandbox
- [ ] ⚖️ US legal review: classification-doc framing (state ABC/AB5) + ToS + customer DPA (US)
- [ ] E&O insurance extended to US exposure (`positioning-and-liability.md`)
- [ ] US physical/registered-agent address (CAN-SPAM footer + business presence)
- [ ] ⚖️ Money-transmitter / NACHA review before ACH go-live (Phase 88)
- [ ] US entity / tax-nexus question reviewed (do we need a US entity to contract US customers?)
- [ ] CPA/EA partner signed as determination-bearer before routing US classification

## Revenue framing

US-domestic is a bigger TAM than any single EU geo, but it's gated + competitive + later. Sequencing:
- **Now–Q3:** US-OUT + US-PAR + US-ADJ — relationship + outbound, zero product gate, builds the CPA channel that de-risks domestic.
- **Q4 2026:** US-domestic 1099 ramp on the deadline hook — by then the CPA partnerships carry the determination liability.
- **Q1 2027:** payments + classification-doc upsell to the installed base.

This way the highest-liability surface (US classification) only sells once (a) the product exists, (b) E&O + US legal clear it, (c) CPA partners bear the determination — never the solo founder cold.

## Cross-refs

- `us-market.md` — two-wedge rationale + recon
- `positioning-and-liability.md` — verdict liability, E&O, determination-bearer logic
- `legal-stack.md` — CAN-SPAM, CCPA, ToS/DPA
- `cells.csv` / `copy_templates.csv` / `levers.csv` / `partnerships/targets.csv` / `timeline.csv` — US rows
