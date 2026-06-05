# Phase 80: v6.0 Consolidated Post-Deploy Legal Sign-Off List

**Produced:** 2026-06-05
**Phase:** 80-v6-0-verification-hardening-manual-uat (Plan 80-03, SC#3 / D-05)
**Status:** Catalogued — NOT obtained

> **Standing Project Constraint — read first.** The platform is **LOCAL-ONLY**. Legal
> sign-off is **catalogued here, not obtained**. Every item below is **DEFERRED** until
> the LOCAL-ONLY status flips and the founder is ready to hand one document per adviser.
> **No item on this list hard-blocks v6.0 milestone closure** — they are all **post-deploy**
> review tasks, exactly as the v5.0 Phase 69 "Post-Deploy Items (Non-Blocking)" precedent
> records them. None arms a CI gate; none gates a phase verdict.

This document consolidates every "Needs verification by legal entity" annotation across the
v6.0 milestone (phases 70–79) into **one section per adviser**. The canonical source rows are
the per-namespace `notes` fields in two in-repo registries — both read-only here:

- `packages/feature-flags/src/signoff-registry-flags.json` — the 24 PENDING Unleash flag entries.
- `packages/validators/src/legal/signoff-registry.json` — the parallel PENDING disclaimer +
  IP-clause + COMPL-docname registry (`getAllPending()` helper, `signoff-registry.ts:40`).

Each row names **the artifact/copy to verify**, **its source namespace/file**, and **the
post-deploy queue it joins**. Where a flag is the source, the registry `notes` text is restated.

Production flags ship **dark** (`FLAG_SIGNOFF_BYPASS=local` for dev) and only flip
`PENDING → APPROVED` after the named adviser confirms the copy.

---

## DE Steuerberater

German tax / Werkvertrag-aware adviser. Verifies §48b EStG, A1, residence-permit, and the
Werkvertrag IP-assignment wording.

1. **Steuerberater review of the §48b EStG Freistellungsbescheinigung document-name copy + rule** —
   verify the construction-sector exemption-certificate framing and the conditional-on-construction
   rule. Source flag `compliance-policy-engine.de.eight_b_estg`
   (`signoff-registry-flags.json`); doc-name key `COMPL_DOCNAME_de_eight_b_estg_v1`
   (`validators/.../signoff-registry.json`). Joins the DE Steuerberater queue (Phase 73 D-16).
2. **Steuerberater review of the A1-Bescheinigung copy + 24-month cap** — verify the Deutsche
   Rentenversicherung framing and the "24-month max per EU Reg 883/2004 Art 12" rule wording.
   Source flag `compliance-policy-engine.de.a1`; doc-name key `COMPL_DOCNAME_de_a1_v1`. Phase 73 D-16.
3. **Steuerberater review of the Aufenthaltstitel residence-permit copy** — verify the AufenthG §4
   framing and the conditional-on-non-EU-nationality rule. Source flag
   `compliance-policy-engine.de.aufenthaltstitel`; doc-name key
   `COMPL_DOCNAME_de_aufenthaltstitel_v1`. Phase 73 D-16.
4. **Steuerberater + Werkvertrag-aware adviser review of the IP-assignment / Schöpferprinzip
   clause wording (UrhG §31)** — verify the four DE IP-clause phrases before production deploy:
   `urheberrecht_einraeumung` (UrhG §31), `ausschliessliches_nutzungsrecht` (UrhG §31 Abs. 3),
   `einfaches_nutzungsrecht` (UrhG §31 Abs. 2), and `werkvertrag_zweckuebertragung`
   (UrhG §31 Abs. 5, Zweckübertragungsregel). Source keys
   `legal-signoff.ip_clauses.de.*@v1` + doc-name `COMPL_DOCNAME_de_werkvertrag_ip_v1`
   (`validators/.../signoff-registry.json`). Phase 75 D-15 / Phase 73 D-16.
5. **Steuerberater review of the offboarding override-dialog acknowledgement copy (Werkvertrag
   wording context)** — verify the override-blocking-task acknowledgement copy used when an IP
   ratification gate is overridden. Source flag `offboarding-ip-foundation` notes:
   *"Needs verification by legal entity before production deploy (override-dialog acknowledgement
   copy)."* Joins the DE Steuerberater queue (Werkvertrag-sensitive); Phase 74/75.

## UK tax / legal adviser

UK contractor-tax / legal adviser. Verifies IR35/ITEPA (SDS), Border Security Act
right-to-work framing, and the UK IP-assignment clause wording.

1. **UK adviser review of the Status Determination Statement (SDS) copy** — verify the
   "Chapter 10 ITEPA 2003" framing required for **IR35**-INSIDE outcomes. Source flag
   `compliance-policy-engine.uk.sds`; doc-name key `COMPL_DOCNAME_uk_sds_v1`. Phase 73 D-16.
2. **UK adviser review of the Right-to-Work share-code copy + 90-day expiry** — verify the
   share-code generation-expiry framing against current Home Office / **Border Security Act**
   guidance. Source flag `compliance-policy-engine.uk.right_to_work`; doc-name key
   `COMPL_DOCNAME_uk_right_to_work_v1`. Phase 73 D-16.
3. **UK adviser review of the HMRC UTR + Companies House registration copy** — verify the
   10-digit UTR (non-expiring) and 8-digit company-number framing. Source flags
   `compliance-policy-engine.uk.utr` + `compliance-policy-engine.uk.business_registration`;
   doc-name keys `COMPL_DOCNAME_uk_utr_v1` + `COMPL_DOCNAME_uk_business_registration_v1`.
   Phase 73 D-16.
4. **UK adviser review of the IP-assignment clause wording (CDPA 1988)** — verify the three UK
   IP-clause phrases: `hereby_assigns` (CDPA 1988 s.90(1)), `assignment_present_and_future`
   (CDPA 1988 s.91), and `moral_rights_waiver` (CDPA 1988 s.87). Source keys
   `legal-signoff.ip_clauses.uk.*@v1` + doc-name `COMPL_DOCNAME_uk_ip_assignment_v1`. Phase 75 D-14.

## UAE legal adviser

UAE local legal adviser. Verifies free-zone permitted-activity catalogues + authority legal
names, NOC wording, the payment-block lockout copy, the Emirates ID copy, and the AE Arabic
statutory phrases.

1. **UAE adviser review of the free-zone authority legal names + permitted-activity scope
   advisory + NOC wording + payment-block lockout copy** — verify the free-zone authority legal
   names, the permitted-activity scope advisory, the auto-NOC item wording, and the lockout copy
   that arms a payment hard-block on expired free-zone licenses. Source flag
   `gulf.free-zone-tracking` notes: *"Legal-sensitive … flip to APPROVED post-deploy after legal
   review of the free-zone authority legal names + payment-block lockout copy + NOC wording."*
   Phase 79.
2. **UAE adviser review of the free-zone trade-license document-name copy** — verify the
   "DMCC, ADGM, etc.; annually renewed" framing; the rule was bumped to **BLOCKING @v2** in
   Phase 79. Source flag `compliance-policy-engine.uae.free_zone_license`; doc-name key
   `COMPL_DOCNAME_uae_free_zone_license_v2` (Phase 73 D-16 / Phase 79 D-03).
3. **UAE adviser review of the Emirates ID document-name copy** — verify the ICA-issued
   Emirates ID framing. Source flag `compliance-policy-engine.uae.emirates_id`; doc-name key
   `COMPL_DOCNAME_uae_emirates_id_v1`. Phase 73 D-16.
4. **UAE adviser review of the AE Arabic statutory copy (`LOCKED_AE_PHRASES`)** — verify the
   11 locked authority-legal-name Arabic phrases before any non-local deploy:
   DIFC, DMCC, IFZA, Dubai Internet City, Dubai Media City, Meydan FZ, JAFZA, SHAMS, RAKEZ,
   ADGM, Mainland (keys in `RESERVED_AE_LEGAL_KEYS`, `packages/validators/src/legal/ae.ts`).
   The Phase 79 HUMAN-UAT "Arabic statutory copy legal sign-off" item routes explicitly here
   (`79-HUMAN-UAT.md:23-24`). Joins the UAE legal-adviser queue.
5. **UAE adviser review of the UAE IP-assignment clause wording (Federal Law No. 38 of 2021)** —
   verify `disposition_of_economic_rights` (Art. 9) + `written_form` (Art. 9 form requirements).
   Source keys `legal-signoff.ip_clauses.uae.*@v1` + doc-name `COMPL_DOCNAME_uae_ip_assignment_v1`.
   Phase 75.

## KSA MOL/HRSD + legal adviser

Saudi Ministry of Labour / HRSD + local legal adviser. Verifies Saudization / **Nitaqat** band
labels + trajectory advisory, the **Qiwa**-auth flow, the **Iqama** copy, and the SA Arabic
statutory phrases.

1. **KSA MOL/HRSD + adviser review of the Saudization dashboard band/trajectory advisory copy** —
   verify the **Nitaqat** band labels + offboarding-trajectory advisory copy; the system never
   auto-computes the band (locked anti-feature). Source flag `gulf.saudization-dashboard` notes:
   *"Legal-sensitive: surfaces Nitaqat band labels + Qiwa-auth status … flip to APPROVED
   post-deploy after legal review of the band/trajectory advisory copy."* Phase 79.
2. **KSA adviser review of the work-permit + Qiwa-portal authorisation copy** — verify the
   **Qiwa** portal-authorisation boolean framing (Phase 79 wires the API). Source flag
   `compliance-policy-engine.ksa.work_permit_qiwa`; doc-name key
   `COMPL_DOCNAME_ksa_work_permit_qiwa_v1`. Phase 73 D-16.
3. **KSA adviser review of the Iqama residency-permit copy + 1-year cap** — verify the
   **Iqama** framing, the "1-year max per Saudi MOI rule", and the 00:00 Asia/Riyadh expiry
   boundary. Source flag `compliance-policy-engine.ksa.iqama`; doc-name key
   `COMPL_DOCNAME_ksa_iqama_v1`. Phase 73 D-16.
4. **KSA adviser review of the SA Arabic statutory copy (`LOCKED_SA_PHRASES`)** — verify the
   8 locked phrases before any non-local deploy: the six **Nitaqat** band labels
   (Platinum / High-Green / Mid-Green / Low-Green / Yellow / Red) + the two **Qiwa**
   contract-authentication labels (authenticated / not-authenticated)
   (keys in `RESERVED_SA_LEGAL_KEYS`, `packages/validators/src/legal/sa.ts`). Joins the
   KSA legal-adviser queue alongside the AE Arabic statutory item.
5. **KSA adviser review of the KSA IP-assignment clause wording (Royal Decree M/41)** — verify
   `transfer_of_economic_rights` (Saudi Copyright Law Art. 22) + `scope_and_term`
   (Art. 22 writing requirement). Source keys `legal-signoff.ip_clauses.ksa.*@v1` + doc-name
   `COMPL_DOCNAME_ksa_ip_assignment_v1`. Phase 75.

---

### Cross-cutting flags (route to the adviser per jurisdiction served)

These PENDING flags from `signoff-registry-flags.json` are not jurisdiction-specific; each row
above already references them where a jurisdiction adviser owns the verification. Listed here so
all 24 PENDING flag namespaces are accounted for:

- `compliance-payment-block` — F1 hard payment-block admin-lockout copy. Production stays OFF
  (would-block soft-warn) **until the legal entity verifies admin-lockout copy** (Phase 72).
  Routed to the jurisdiction adviser whose BLOCKING item triggers the block (UAE free-zone is the
  v6.0 composed case; see UAE row 1).
- `compliance-portal-self-service` — F1 contractor portal self-service upload-replacement +
  admin-review flow + notification copy (Phase 73). Post-deploy legal review of the self-service
  flow + notification copy; cross-jurisdiction.
- `offboarding-ip-foundation` — F4 override-dialog acknowledgement copy (DE Steuerberater row 5),
  also relevant to every IP jurisdiction adviser above.
- `idp-deprovisioning` + `module.idp-deprovisioning-{gws,slack,entra,okta,github}` — F2 IdP
  deprovisioning (6 flags). Each notes a **cross-border data-handling** legal review (suspend +
  session-revoke semantics), DEFERRED per Standing Constraint. These are **data-protection /
  privacy-counsel** items rather than jurisdiction-tax items — they join a separate
  data-protection review queue, not one of the four tax/labour advisers above. Listed for
  completeness of the 24-flag inventory.

### Other-jurisdiction IP-clause + doc-name rows (no dedicated v6.0 adviser section)

The validators registry also carries PENDING **PL** and **US** rows that have no jurisdiction
section above (no PL/US adviser is named in D-05's four-section structure). They remain catalogued
post-deploy and join their respective local-adviser queues when those jurisdictions go live:

- **PL (doradca podatkowy):** flags `compliance-policy-engine.pl.zus_a1` (ZUS A1, 12-month max) +
  `compliance-policy-engine.pl.udt` (UDT, regulated-equipment); IP-clause keys
  `legal-signoff.ip_clauses.pl.{przeniesienie_majatkowych,pola_eksploatacji,licencja_wylaczna}@v1`
  (Ustawa o prawie autorskim art. 41 / 50 / 67 ust. 2); doc-names `COMPL_DOCNAME_pl_{zus_a1,udt,ip_assignment}_v1`.
- **US (US tax/IP adviser):** IP-clause keys
  `legal-signoff.ip_clauses.us.{work_made_for_hire,assignment_in_lieu,further_assurances}@v1`
  (17 U.S.C. §201(b) / §204(a)); doc-name `COMPL_DOCNAME_us_ip_assignment_v1`.

### Generic disclaimer copy (cross-jurisdiction, no flag)

The validators registry's non-IP PENDING disclaimer keys (`DISCLAIMER_IR35_*`,
`DISCLAIMER_SCHEIN_*`, `SDS_DISCLAIMER_EN`, `DRV_*_DISCLAIMER_DE`, `BANNER_IR35_ADVISORY_EN`,
`BANNER_SCHEIN_ADVISORY_DE`, `SDS_APPROVAL_STATEMENT_EN`, `SOFTWARE_NOT_LEGAL_ADVICE_{EN,DE}`)
are "software is not legal advice" + IR35/Scheinselbständigkeit advisory banners. They route to
the UK adviser (IR35 banners) and the DE Steuerberater (Schein banners) respectively, alongside
the rows above.

---

**All items above are post-deploy and non-blocking. None blocks v6.0 milestone closure**
(Standing Constraint: legal review is DEFERRED under LOCAL-ONLY, never hard-blocks a phase or the
milestone). When LOCAL-ONLY flips, the founder hands one consolidated section per adviser
(DE Steuerberater / UK tax-legal / UAE legal / KSA MOL-HRSD+legal); each flag flips
`PENDING → APPROVED` in the registry only after that adviser confirms the copy.
