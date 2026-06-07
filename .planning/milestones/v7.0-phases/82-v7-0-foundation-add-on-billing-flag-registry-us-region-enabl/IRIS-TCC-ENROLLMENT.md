# IRIS TCC Enrollment — Started Calendar Dependency (SC#4 / D-08)

**Phase:** 82 — v7.0 Foundation
**Type:** Real-world IRS operations action (LOCAL-ONLY: no app code; nothing files until Phase 86)
**Started:** 2026-06-07
**Earliest ready (start + ~45 days):** 2026-07-22
**Owner:** Founder (Responsible Official on the IRS application)
**Consumed by:** Phase 86 — **US-FORM-05** (IRS IRIS XML A2A e-file)

---

## Standing-Constraint annotation

> This is a **real-world IRS ops action the founder takes** outside the codebase. Per the
> Standing Project Constraint (LOCAL-ONLY), the application files **nothing** with the IRS at
> this stage. Phase 82 ships only the gating primitives (add-on middleware, flag registry, US
> region enablement) plus this doc, which records the TCC enrollment as a *started calendar
> dependency* so the ~45-day clock is running before Phase 86 needs the credential.
>
> No in-app onboarding task is seeded (no product theater per D-08). The TCC, the IRS
> e-Services credentials, and the ID.me identity proof are real-world secrets the founder
> holds — they are **never** committed to this repo.

---

## Why a NEW IRIS A2A TCC is required

- **IRS FIRE is decommissioned 2026-12-31.** The legacy FIRE (Filing Information Returns
  Electronically) system stops accepting transmissions after that date. IRIS (Information
  Returns Intake System) becomes the primary/mandatory e-file path.
- **TY2026 information returns are filed in early 2027** — i.e. *after* FIRE is gone. Those
  returns (1099-NEC, 1099-K, 1042-S, etc.) MUST be transmitted via **IRIS XML A2A**
  (Application-to-Application), not FIRE.
- **A FIRE TCC does NOT carry over to IRIS.** Even an existing FIRE Transmitter Control Code
  is not valid for IRIS A2A. A brand-new **IRIS Application for TCC** must be submitted and
  approved before any A2A transmission can succeed.
- FIRE is retained in scope only as a *documented legacy fallback* (US-FORM-05) — the
  transmitter seam in Phase 86 defaults to IRIS A2A.

## Lead time — the load-bearing number

The IRIS Application for TCC has a **~45-day** IRS processing lead time (identity verification
+ Responsible Official designation + application review). This is why the clock starts in
Phase 82 (foundation) rather than Phase 86 (consumption):

| Milestone | Date |
|-----------|------|
| Enrollment started | 2026-06-07 |
| ~45-day IRS processing window | 45 days |
| Earliest TCC-ready | 2026-07-22 |

If the application is delayed, slip the Phase 86 transmit-enable date by the same amount —
the TCC is a hard prerequisite, not a soft one.

## Enrollment steps (real-world, IRS e-Services)

1. **ID.me identity verification.** The Responsible Official completes IRS e-Services identity
   proofing via ID.me (government-ID + selfie + knowledge-based verification). Required before
   any e-Services application is accessible.
2. **Responsible Official designation.** Name the founder as the Responsible Official on the
   IRIS Application for TCC (the individual the IRS holds accountable for transmissions).
3. **IRIS Application for TCC.** Submit the IRIS Application for TCC through IRS e-Services,
   selecting the **A2A (Application-to-Application)** transmission method. Record the assigned
   TCC out-of-band (1Password / founder's secrets store) — **never** in this repo.
4. **Await approval (~45 days).** The IRS reviews and issues the TCC. Until issued, no A2A
   transmission can be tested end-to-end.

Reference: <https://www.irs.gov/e-file-providers/information-returns-intake-system-iris> —
"IRIS Application for TCC".

## Cross-link to Phase 86 (US-FORM-05)

**Phase 86 — US-FORM-05 (IRIS XML A2A e-file)** is the consumer of this dependency. That phase
builds the IRIS XML file builder, the A2A transmit client, and acknowledgement parsing. It
**cannot transmit** without an approved IRIS TCC. The transmitter adapter seam in Phase 86
also carries the FIRE legacy-fallback path, but the default and mandatory route is IRIS A2A
using the TCC enrolled here.

> Verbatim requirement (`.planning/REQUIREMENTS.md`, US-FORM-05): "System e-files year-end
> returns via IRS IRIS (XML A2A, primary/mandatory path) with TCC-enrollment workflow doc,
> automated file build, transmit, and acknowledgement parsing; FIRE retained only as a
> documented legacy fallback."

When Phase 86 begins, verify the TCC has been issued (compare against the **Earliest ready**
date above). If not yet issued, Phase 86's transmit-enable step is blocked on this real-world
dependency — surface it then, not as a code blocker now.
