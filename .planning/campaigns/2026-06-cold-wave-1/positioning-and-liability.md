# Positioning & liability posture — classification de-risking

> **NOT legal advice.** This is the go-to-market positioning decision + a checklist to verify with a lawyer/tax adviser before selling any classification-flavored feature. Items 2 (E&O insurance) and 4 (DE RDG/StBerG) must be cleared with a German lawyer before any classification sale in DE.

## The decision

**Classification-as-verdict is removed from the sales promise.** As a solo founder with no legal team and (currently) no E&O cover, selling a binding "this contractor is/isn't an employee" verdict is the single highest-liability thing we could lead with. The customer offloads risk onto the tool; the tool (the founder) absorbs it. That asymmetry is backwards.

Classification survives only as **decision-support + documentation + advisor-routing** — never a determination we own.

## Why the risk is real (three independent exposures)

1. **Civil recourse.** Customer relies on a verdict → authority/court rules the opposite → customer pays back social-security + tax + penalties → seeks recovery from the vendor who said "OK". A "not advice" disclaimer does not fully shield against negligent-misstatement claims.
2. **Unlicensed regulated practice.**
   - **DE:** RDG (Rechtsdienstleistungsgesetz) + StBerG (Steuerberatungsgesetz) — employment-status determination is *Rechtsberatung / Steuerberatung*, reserved for lawyers / Steuerberater. A solo SaaS issuing verdicts risks an unauthorized-services claim.
   - **PL:** doradztwo podatkowe reserved for licensed *doradca podatkowy*.
   - **UK:** less acute (no reserved activity), but FCA/HMRC reputational risk if marketed as guaranteed.
3. **The verdict is also factually weak.**
   - **DE:** the binding §7a determination is made ONLY by Deutsche Rentenversicherung (Clearingstelle). Any vendor "verdict" is just an opinion.
   - **UK:** since the 2021 off-payroll reform the END CLIENT issues the SDS and carries the "reasonable care" liability. CEST is non-binding; HMRC only stands behind it if answers are accurate + reasonable care applied.
   - So a vendor verdict is legally non-binding AND exposes the vendor — worst of both.

## Liability gradient (low → high)

| # | Surface | Nature | Liability | Sell as lead? |
|---|---------|--------|-----------|---------------|
| 1 | **E-invoicing** (KSeF / Wachstumschancengesetz / ZATCA) | Deterministic schema conformance | Lowest | ✅ Go-to lever |
| 2 | **Ops platform** (onboarding, contracts, payments, timesheets, approvals) | Pure operational software | Low | ✅ Land product |
| 3 | **Saudization tracking** (Nitaqat) | Arithmetic vs public MHRSD bands | Low-med | ✅ Gulf lever |
| 4 | **Compliance documentation** (organizes evidence; customer/adviser decides) | Workflow + audit layer | Medium | ⚠️ De-risked feature only |
| 5 | **Classification verdict** (vendor decides) | Legal determination | Highest | ❌ Never sell / never carry |

## New offer-lever hierarchy

1. **Go-to lever — E-invoicing compliance.** Deterministic, zero judgment, and crucially **deadline-driven mandate = the strongest cold-email hook there is.** PL KSeF (Feb 2026, mandatory for every B2B), DE Wachstumschancengesetz (phased), SA ZATCA (live). Lead here in every geo where a mandate exists.
2. **Land product — Contractor-ops as operational system.** Onboarding, contract repository, payment tracking, timesheets, approvals. Sticky, expandable, zero liability.
3. **De-risked feature — Compliance documentation + risk flagging + adviser routing.** Makes someone *else's* decision defensible in an audit. Never a verdict.
4. **Gulf lever — Saudization tracking.** A dashboard mirroring government data.

## Classification reframe — verdict → decision-support

| Old (risky) | New (de-risked) |
|-------------|-----------------|
| "Verdict per contractor in 5 seconds" | "We organize the evidence + flag 4 of 7 risk indicators → your Steuerberater decides" |
| "A determination, defensible if HMRC challenges" | "Evidence + audit trail demonstrating reasonable care — the client issues the SDS" |
| The tool rules | The tool prepares the §7a package / Clearingstelle application |
| Vendor carries the risk | Licensed partner carries the determination |

**Product-level rules (must ship with the feature):**
- Output is "risk indicators" / "evidence summary" / "audit-readiness score" — never "employee" / "contractor" as a binding label.
- Every risk screen ends with "review with your adviser" + one-click route to a partnered licensed professional.
- Log that the customer was advised to seek professional input (defensibility trail).
- No countdown-to-verdict UX; instead "prepare your application" / "share with your adviser" UX.

## Partnerships as liability shield (not just a channel)

This flips the biggest risk into a strength. **Licensed professionals — Steuerberater / doradca podatkowy / solicitor / DATEV / inFakt — carry the determination** (they are licensed AND insured for it); contractor-ops is the software they run it on.

Consequence for the GTM plan: the partner cells **DE-PAR / PL-PAR / UK-PAR are promoted** from "referral channel" to "the determination-bearing layer that removes liability from us." Prioritize the licensed-adviser + accounting-platform partners (DATEV, inFakt, Lexware, doradca/Steuerberater networks, umbrella companies) accordingly.

## Mandatory solo-founder guardrails

Before any judgment-flavored feature touches a paying customer:

1. **Limited-liability entity** — sp. z o.o. shields personal assets but NOT against gross negligence or willful acts. Necessary, not sufficient.
2. **Professional indemnity / E&O insurance (Berufshaftpflicht)** — €1–3M cover, ~€500–1500/yr. **Must be active before the first paying customer on any judgment module.** Cheaper than one day of litigation. ← verify with broker.
3. **Terms of Service, three clauses:** (a) liability cap = fees paid, (b) "decision-support tool, NOT legal/tax advice", (c) customer indemnification + no warranty of regulatory outcome.
4. **DE — RDG/StBerG-safe positioning:** never label it Rechtsberatung/Steuerberatung. The §7a determination belongs to DRV or to a partnered Steuerberater. We are "Software/Workflow." ← verify with German lawyer.
5. **In-product adviser routing** at every risk step + logged "seek advice" notice.
6. **Marketing copy rule:** "reduce risk / be audit-ready" — NEVER "avoid fines / guaranteed compliant".

## What changed in the campaign artifacts

| File | Change |
|------|--------|
| `cells.csv` | Primary offer angles swapped off `classification-engine` → `e-invoicing` / `contractor-ops-platform` / `compliance-documentation`. Partner cells promoted. Pains reframed away from "verdict". |
| `copy_templates.csv` | DE-AGE + UK-AGE hero copy rewritten: no "verdict / determination in 5 seconds"; now evidence + audit-readiness + adviser routing + (DE) §7a application prep. |
| `GTM_PLAN.md` | Added "Offer lever hierarchy + liability posture" section; partner cells promoted. |
| `partnerships/targets.csv` + `terms.md` | DATEV / inFakt / Steuerberater + doradca partners reframed as determination-bearing liability shield, not just referral. |

## Open verification items (do before selling classification anything)

- [ ] German lawyer sign-off on RDG/StBerG-safe positioning of the documentation feature
- [ ] E&O / Berufshaftpflicht quote + bind (€1–3M)
- [ ] ToS reviewed by lawyer (liability cap + decision-support framing + indemnification)
- [ ] Confirm sp. z o.o. (or equivalent) is the contracting entity, not the individual
- [ ] Per-geo: confirm who the licensed determination-bearer is in the partner stack before routing customers to them
- [ ] **PRODUCT GAP (found 2026-06-03 recon):** classification UI currently outputs binding verdicts (IR35 `inside/outside`, Scheinselbst. `red/green` + score) — contradicts this positioning. Reconcile before demo/sale: wave 1 hide verdict screens (demo e-invoicing + ops + DRV-defense-bundle PDF); before scaling, relabel to risk-indicators + add "not a determination" disclaimer. Tracked as ASSET-25 / `demo-strategy.md` Gate 1.
