# 97-05 SUMMARY — per-country nationalisation rollup (KSA + UAE Emiratisation)

**Wave:** 3 · **Status:** done · delivered in the same backend commit as 97-03.

## What landed
- **`services/saudization-dashboard.ts`** — a thin `computeNationalisationDashboard(country, params)` wrapper that generalizes the
  F3 Saudization rollup per country. The KSA math (`computeSaudizationDashboard`) is **byte-for-byte unchanged** (back-compat); the
  wrapper tags the result with its country and reuses the identical derivation for UAE (manual Emirati headcount as `saudiHeadcount`,
  visa/Emirates-ID rows as the permit rollup). The locked anti-features hold for BOTH countries by construction: the rate comes ONLY
  from the manual headcount (never an `EmployeeProfile` groupBy) and the band is read-through, never inferred.
- **`hrDashboard.getNationalisationRollup`** (HR-DASH-05) — composes `{ ksa?, uae? }`. KSA reads the existing manual `SaudiHeadcount`
  (latest by `recordedAt`) + `SaudizationConfig` band. Each country is present only when its manual headcount exists → the UI shows
  the "record manual headcount" prompt otherwise (the plan's own Widget Gating Map empty state).

## Honest scoping note
There is **no UAE manual-headcount store at HEAD** — `SaudiHeadcount` has no country discriminator and `SaudizationConfig` is
one-per-org (`@@unique([organizationId])`). Adding a country discriminator would be an invasive change to the F3 gulf schema + the
gulf saudization router (out of this phase's scope). So the **service** fully supports UAE Emiratisation (proven by
`hr-dashboard-nationalisation.test.ts`), and the **router** returns `uae: undefined` (the documented prompt state) until a UAE
headcount store is added. This preserves the anti-feature and delivers HR-DASH-05's KSA rollup + the ready UAE structure.
The KSA rollup passes empty `platformContractors`/`iqamaItems` (rate + band are the load-bearing signal; the full iqama detail
stays on the existing gulf saudization dashboard — not duplicated here).

## Verification
- `hr-dashboard-nationalisation.test.ts` proves KSA + UAE manual-input rate + read-through band + null-when-no-headcount.
