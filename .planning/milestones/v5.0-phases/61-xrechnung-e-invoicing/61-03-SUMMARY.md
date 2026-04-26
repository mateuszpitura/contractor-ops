---
phase: 61
plan: 61-03
status: complete
wave: 2
requirements: [EINV-04]
created: 2026-04-14
---

# Plan 61-03 — KoSIT 3-layer Validator + SVRL Normalizer

## What was built

Full three-layer XRechnung validation pipeline for Wave 2, consumed downstream by Plan 06 finalize service and Plan 08 UI.

**Layer 1 (XSD):** `libxmljs2` schema validation against UN/CEFACT CII D16B XSDs. Catches structural violations before Schematron.
**Layer 2 (EN 16931 Schematron):** `saxon-js` runs the compiled SEF JSON of the EN 16931 Schematron ruleset. Produces SVRL output.
**Layer 3 (XRechnung CIUS Schematron):** second `saxon-js` pass against the German CIUS restrictions (Leitweg-ID patterns, electronic address scheme, etc.). Also produces SVRL.

Both SVRL outputs are piped through the normalizer → typed `ValidationIssue[]` buckets keyed on `@flag` severity (fatal/error/warning/information). Defensive defaults: unknown `@flag` values → `error` + one-time pino warn.

## Commits

| Hash | Subject |
|------|---------|
| `582bb1b6` | chore(61-03): populate KoSIT validator-bundle + test fixtures |
| `502573da` | feat(61-03): SVRL normaliser — XXE-safe SVRL → typed ValidationIssue mapping |
| `b3711072` | feat(61-03): three-layer KoSIT validator (XSD → EN 16931 → XRechnung CIUS) |

## Key files

- `packages/einvoice/src/profiles/xrechnung-de/validator.ts` (new, 256 lines) — `validateXRechnungCii(xml)` → `XRechnungValidationReport`
- `packages/einvoice/src/profiles/xrechnung-de/svrl-normalizer.ts` (new, 199 lines) — `normaliseSvrl(svrlXml)` → `NormalisedSvrl`
- `packages/einvoice/src/profiles/xrechnung-de/validator-bundle/` — canonical KoSIT release-2026-01-31 artifacts
  - `checksums.txt` — SHA-256 pins for all bundle artifacts (CI MUST `sha256sum -c`, MUST NOT re-fetch)
  - `CII-D16B-schema/*.xsd` — UN/CEFACT Cross Industry Invoice schemas
  - `EN16931-CII-validation.sef.json` + `XRechnung-CII-validation.sef.json` — compiled Schematron
  - `src-xslt/*.xsl` — source XSLT (compiled at Wave-0 by `scripts/recompile-kosit-schematron.ts`)
- `packages/einvoice/src/profiles/xrechnung-de/__tests__/validator.test.ts` (109 lines)
- `packages/einvoice/src/profiles/xrechnung-de/__tests__/fixtures/` — 3 KoSIT-parity fixtures (2 positive, 1 negative)
- `packages/einvoice/src/profiles/xrechnung-de/index.ts` — `XRechnungDEProfile.validate()` wired to new validator (replaces Plan 02 stub)
- `packages/einvoice/src/index.ts` — re-exports validator + normaliser types for Plan 06 consumption

## Test results

```
Test Files  5 passed (5)
     Tests  35 passed (35)
```

Covers:
- `validator.test.ts` — 8 scenarios across 3 fixtures (VALID / INVALID at EN 16931 layer / INVALID at CIUS layer)
- `svrl-normalizer.test.ts` — bucket routing, unknown-flag fallback, XXE rejection
- `generator.test.ts`, `leitweg-id-embed.test.ts`, `locked-phrase-parity.test.ts` (from Plan 02) — no regressions

## Security posture (threat mitigations)

| Threat | Mitigation | Evidence |
|--------|-----------|----------|
| T-61-03-01 XXE via SVRL | `fast-xml-parser` with `processEntities: false` + `allowBooleanAttributes: false` | svrl-normalizer.ts L23-30; test "External entities are not supported" in output |
| T-61-03-02 XSLT supply-chain | SHA-256 pins in `validator-bundle/checksums.txt`; Wave-0 canonicalization (no upstream re-fetch in CI) | checksums.txt committed; verified by `sha256sum -c` in test setup |
| T-61-03-03 DoS via large XML | Per-layer size cap (libxmljs2 5MB) | validator.ts `MAX_XML_BYTES = 5 * 1024 * 1024` |

## Decision trace

- **D-03 (KoSIT bundled XSLT)**: SEF JSON compiled at Wave-0 build-time from release-2026-01-31 source XSLT. Runtime uses precompiled `.sef.json` (saxon-js format). Recompile script is invocation-only (not CI-automated).
- **D-04 (on-demand validation)**: validator is a pure function; Plan 06 decides when to call (on finalize, on re-validate, on inbound receipt).
- **D-14 (SVRL normalization shape)**: stable `{ layer, severity, ruleId, xpath, message, location? }` schema — Plan 06 persists, Plan 08 renders, Plan 08-03 human-verify checkpoint inspects.

## Deviations from plan

1. **Rate-limit recovery** — subagent hit Anthropic quota (3pm Europe/Warsaw reset) after Task 1 + SVRL normalizer commits but before validator.ts commit. Orchestrator finalized Task 2 inline: committed validator.ts + updated test file + index.ts wiring + SUMMARY.md. All tests passed on validation. No additional deviations.

## Wave-0 canonicalization

With Task 1 landed (validator-bundle + checksums.txt), the bundle is canonical. Subsequent CI re-runs MUST:
- `sha256sum -c packages/einvoice/src/profiles/xrechnung-de/validator-bundle/checksums.txt`
- NEVER re-fetch from upstream KoSIT repository
- Recompilation script runs only when release pin is explicitly updated

`wave_0_complete: true` flipped in `61-VALIDATION.md` frontmatter.

## Blockers handed off

- None. Wave 3 (Plan 06) can consume `validateXRechnungCii()` + `normaliseSvrl()` immediately.

## Downstream contract

- **Plan 06 finalize:** call `validateXRechnungCii(cii_xml)` → persist `XRechnungValidationReport` to `EInvoiceLifecycle.validationReportSummary` (redacted) and full report to R2. SVRL buckets map to FSM transitions (VALID → proceed; INVALID → halt).
- **Plan 08 UI:** render `layers[]` as collapsible sections; `ValidationIssue[]` groups shown as table per layer. Severity → color token (destructive/warning/info).
