# Phase 90: Theme B — Employee Registry per Market (×6) - Discussion Log

> **Audit trail only.** Not consumed by downstream agents. Decisions are in CONTEXT.md.

**Date:** 2026-06-21
**Phase:** 90-theme-b-employee-registry-per-market-6
**Areas discussed:** EmployeeProfile storage model, PII encryption boundary, Validator depth + external-lookup boundary, UI dispatch

---

## EmployeeProfile Storage Model
| Option | Selected |
|--------|----------|
| Hybrid: JSONB countryFields + encrypted PII columns + promoted typed columns | ✓ |
| Pure JSONB countryFields | |
| All typed columns per market | |

**Choice:** New `EmployeeProfile` (1:1, countryCode). `countryFields Json?` (per-country Zod, mirror Contractor.countryFields) for bulk non-PII + AES-256-GCM encrypted columns for PII IDs + promoted typed/indexed columns (Saudization category, etat fraction, employment status) for HR-dashboard/payroll queries. Tenant-owning, cross-org leak test.

## PII Encryption Boundary
| Option | Selected |
|--------|----------|
| National-person IDs encrypted; tax/social IDs RBAC-read-only | ✓ |
| Encrypt ALL statutory person/tax/social IDs | |
| SSN only (reuse P84 as-is) | |

**Choice:** Encrypt+masked+`employeePii:read`-reveal+audit the national-person IDs (PESEL/SSN/Iqama/Emirates-ID, mirror P84 ssn-crypto). Tax/social (Steuer-IdNr/SV-Nummer/NI/PAYE) plain but RBAC-gated (employer-operational, ride payslips). Re-identification-risk vs payroll-export utility is the boundary.

## Validator Depth + External-Lookup
| Option | Selected |
|--------|----------|
| Full checksum/structural + reference-list pickers + stub lookup hooks | ✓ |
| Format-only validation | |

**Choice:** Full depth (PESEL mod-11+DOB, NI+DWP ranges, tax-code 1257L+flags), enums (Lohnsteuerklasse, Saudization), seeded reference-list pickers (ZUS/NFZ oddział, urząd skarbowy), stub ELStAM hook — NO live gov calls (local-only); seed lists adviser-verify.

## UI Dispatch
| Option | Selected |
|--------|----------|
| Per-market hand-built components (mirror CountryComplianceSection) | ✓ |
| Config-driven single dynamic form | |

**Choice:** New components/employees/compliance/ with a CountryFieldsDispatch-style switch → per-market field components; reuse masked-reveal for PII + reference pickers; web-vite layering + i18n + WCAG.

---

## Claude's Discretion
- EmployeeProfile column-vs-JSON split (which non-PII promoted typed beyond Saudization/etat/status); per-market sub-table (mirror FreeZoneAssignment) for AE/SA visa/WPS/GOSI vs JSON.
- Reference-list seed-data source/shape + maintenance.
- Parallel employee schema map vs shared worker-type-keyed registry.
- Per-market required-vs-optional matrix.
- employeePii:read grant set across the 4 new HR roles + existing roles.
- ELStAM stub-hook interface.

## Deferred Ideas
- Full 50-state US withholding → 10 + free-text now.
- Live gov lookups (ELStAM/ZUS/NFZ/GOSI) → stub hooks + reference lists now.
- Akta/leave/time/onboarding/payroll/HRIS/portal/dashboard → P91–97.
- Per-market sub-tables for visa/WPS/GOSI → planner discretion.

## Dependency Note
- HARD dependency on Phase 89 (Worker/Employee abstraction) — EmployeeProfile attaches to the Employee; plan/execute only after 89 lands.
