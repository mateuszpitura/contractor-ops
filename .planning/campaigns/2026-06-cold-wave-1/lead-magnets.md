# Lead magnets — liability-free demand capture

> CMO note: a gated readiness checklist is the highest-leverage low-effort asset we can ship in the buffer. It (1) captures leads from content + LinkedIn, (2) gives cold email a lower-friction CTA than "book a call", (3) is 100% liability-free because it is educational + deterministic — never a verdict. Mateusz produces the artifacts; I draft the content.

## Why lead magnets now

- **Lower-friction CTA.** "Reply and I'll send the KSeF readiness checklist" converts colder prospects than "book 15 min" — then the checklist itself sells the call.
- **List building.** Gated download → email → newsletter → nurture. Feeds the content channel's subscriber goal.
- **Liability-safe.** Checklists/calculators are deterministic and educational. No employment-status verdict. Safe to ship before E&O/RDG sign-off.
- **Shareable.** A good checklist gets forwarded internally (finance → ops → legal), multiplying reach per download.

## The 4 magnets (priority order)

### LM-01 — PL: "KSeF Readiness Checklist dla firm z kontraktorami B2B"
- **Format:** 1–2 page PDF + optional Notion/Google Doc version.
- **Content:** deterministic checklist — czy masz NIP-y kontraktorów zweryfikowane? czy faktury mają wymagane pola KSeF? czy przepływ kontrakt→faktura→akceptacja jest spięty? deadline luty 2026 timeline. ~15 checkbox items.
- **CTA inside:** "Spięcie tego w jednym workflow zajmuje dzień zamiast kwartału — 15 min: {{cal_link}}"
- **Liability:** none — it is a compliance-prep checklist, not tax advice. Footer: "materiał edukacyjny, nie stanowi porady podatkowej."
- **Use:** PL-SMB + PL-SWH cold CTA, PL content gate, LinkedIn PL lead gen.

### LM-02 — DE: "E-Rechnung 2026/2027 Readiness-Check (XRechnung / ZUGFeRD)"
- **Format:** 1–2 page PDF.
- **Content:** deterministic readiness checklist — Empfangsfähigkeit ab 2025? Format-Konformität (XRechnung/ZUGFeRD)? B2B-Ausstellungspflicht-Timeline? Schnittstelle zu Contractor-Stammdaten? ~15 items.
- **CTA inside:** "Ein Workflow statt drei Tools — 15 Min: {{cal_link}}"
- **Liability:** none. Footer: "Informationsmaterial, keine Steuerberatung."
- **Use:** DE-SMB cold CTA, DE content gate, XING lead gen.

### LM-03 — Gulf: "Saudization Band Self-Calculator"
- **Format:** interactive — Google Sheet template OR a small embedded calculator on the landing page. Input headcount + Saudi nationals + sector → output current Nitaqat band + distance to next band.
- **Content:** pure arithmetic vs published MHRSD band thresholds. No legal judgment.
- **CTA inside:** "Track this live + project 90 days out — 15 min: {{cal_link}}"
- **Liability:** none — arithmetic mirroring public government bands. Footer: "indicative only; official band is determined by Qiwa/MHRSD."
- **Use:** SA-SMB + SA-AGE cold CTA, Gulf content, viral shareable (calculators get shared).

### LM-04 — UK: "IR35 Reasonable-Care Evidence Checklist"
- **Format:** 1–2 page PDF.
- **Content:** process checklist for demonstrating reasonable care on SDS — is each determination evidenced? is the SDS communicated down the chain? is there an audit trail? appeal process documented? ~12 items. About *process*, not the determination itself.
- **CTA inside:** "Automate the evidence trail — 15 min: {{cal_link}}"
- **Liability:** low — it is about process/documentation, not issuing a status verdict. Footer: "general information, not legal or tax advice; the client is responsible for the SDS."
- **Use:** UK-AGE/SMB cold CTA (wave 2 hero), UK content gate.

## Production spec (for asset_specs)

| Magnet | Owner | Effort | Tool | Hosting |
|--------|-------|--------|------|---------|
| LM-01 PL | Mateusz + me (draft) + PL proofread | 2 h + $30 proof | Canva / Google Doc → PDF | contractor-ops.com/pl/ksef-checklist (gated via simple email form → Substack/HubSpot) |
| LM-02 DE | Mateusz + me + DE proofread | 2 h + $30 proof | Canva → PDF | contractor-ops.com/de/erechnung-check |
| LM-03 Gulf | Mateusz + me | 3 h (interactive) | Google Sheet template OR landing embed | contractor-ops.com/sa/saudization-calculator |
| LM-04 UK | Mateusz + me + light legal eye | 2 h | Canva → PDF | contractor-ops.com/uk/ir35-evidence-checklist (wave 2) |

## Distribution

- **Cold email:** offer as alternative CTA in step 1 or step 2 ("happy to just send the checklist — no call needed"). Lowers reply barrier.
- **Content:** gate behind email capture at the foot of the matching hero article (LM-01 ↔ ART-01, LM-02 ↔ ART-02, LM-03 ↔ ART-04).
- **LinkedIn:** "Built a KSeF readiness checklist for B2B-heavy teams — comment 'KSeF' and I'll send it." Classic LinkedIn lead-gen motion. Free reach.
- **Newsletter:** first issue = deliver the checklist, establishes value.

## Measurement

- `lead_magnet_download` PostHog event `{magnet_id, geo, source}`
- Download → demo-booking conversion (target 5–15%)
- Download → newsletter retention
- Which magnet pulls most → signals where market pressure is (ties into the "where is the pressure" dashboard question)
