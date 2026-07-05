# Payroll export golden fixtures

Each `*.golden.*` file is the byte-exact expected output of a payroll export
profile for the shared feed in `feeds.ts`. The profile generators are pure
functions of the feed, so the golden locks the target's column/record contract.

All identifiers are synthetic — no real PESEL / SSN / SV-Nr / NINO. The feed is
PII-masked: national IDs appear only as `nationalIdLast4` (PL/US) or inside
`countryFields` market references (DE `svNummer`/`steuerIdNr`, GB `niNumber`).

CSV goldens contain the body only (no UTF-8 BOM); the profile prepends the BOM
and the test asserts the BOM bytes separately, then compares the post-BOM body
to the golden.

| Fixture | Target | Source spec (adviser-verify — legal sign-off deferred, local-only) |
|---------|--------|--------------------------------------------------------------------|
| `symfonia.golden.csv` / `.xml` | Symfonia Kadry i Płace (PL) | Symfonia import column contract; PL `employeeCountryFieldsSchemaMap` |
| `comarch.golden.csv` | Comarch ERP Optima "Płace" import (PL) | Comarch Optima employee-import layout |
| `enova.golden.csv` | enova365 Kadry i Płace import (PL) | enova365 import layout |
| `datev.golden.txt` | DATEV Lohn und Gehalt / LODAS ASCII (DE) | DATEV LODAS fixed-width layout; header + fixed-length detail records |
| `sage-de.golden.csv` | Sage HR / Personalwirtschaft (DE) | Sage DE Personalwirtschaft import CSV |
| `rti-fps.golden.xml` | HMRC RTI Full Payment Submission (UK) | GovTalkMessage → IRenvelope → FullPaymentSubmission |
| `rti-eps.golden.xml` | HMRC RTI Employer Payment Summary (UK) | GovTalkMessage → IRenvelope → EmployerPaymentSummary |
| `adp.golden.csv` | ADP Workforce Now employee import (US) | ADP import column contract (native ADP push deferred to v7.1) |
| `gusto.golden.csv` | Gusto employee import (US) | Gusto CSV import column contract (native OAuth push flag-deferred) |
| `quickbooks.golden.csv` | QuickBooks Payroll employee import (US) | QuickBooks Payroll import column contract (native OAuth push flag-deferred) |

These exports carry employee master data only — the incumbent system computes
gross→net and files. Structural fidelity is proven here; statutory/legal
correctness is a deferred adviser-verify checkpoint (Steuerberater / doradca /
HMRC agent), never a hard block on the build.
