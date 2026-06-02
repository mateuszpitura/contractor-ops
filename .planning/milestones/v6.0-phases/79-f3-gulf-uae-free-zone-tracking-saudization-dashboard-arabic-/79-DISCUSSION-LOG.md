# Phase 79: F3 Gulf — UAE Free-Zone Tracking + Saudization Dashboard + Arabic + RTL - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic-
**Areas discussed:** Free-zone model + severity, Permitted-activity matching, Saudization data + trajectory, Arabic/RTL + locked phrases

---

## Free-zone model + severity

### FreeZoneAssignment granularity
| Option | Description | Selected |
|--------|-------------|----------|
| Per-contractor | License belongs to the contractor's legal entity; check on any contract create | ✓ |
| Per-engagement | License tied to each ContractorAssignment; re-entry/drift risk | |
| You decide | Researcher picks | |

### Relationship to existing freeform countryFields
| Option | Description | Selected |
|--------|-------------|----------|
| Migrate + supersede | Backfill into FreeZoneAssignment, single source of truth, hide old inputs | ✓ |
| Coexist side-by-side | Keep freeform + structured; drift risk | |
| You decide | Researcher picks | |

### Severity for free-zone license payment-block
| Option | Description | Selected |
|--------|-------------|----------|
| Bump to BLOCKING @v2 | Version-bump existing WARNING rule via supersession | ✓ |
| Add separate BLOCKING rule | Two overlapping free-zone rules | |
| You decide | Researcher picks | |

### Mainland handling
| Option | Description | Selected |
|--------|-------------|----------|
| No FZ item for Mainland | appliesIf narrows to real free-zone zones; no false block | ✓ |
| Track Mainland the same way | Mainland also blocks on expiry | |
| You decide | Researcher picks | |

**User's choice:** per-contractor · migrate+supersede · BLOCKING @v2 · no FZ item for Mainland
**Notes:** Existing `uae.free_zone_license@v1` is WARNING + `appliesIf:()=>true`; phase must bump severity AND narrow applicability together. "CRITICAL" in ROADMAP = `BLOCKING` enum (no CRITICAL value exists).

---

## Permitted-activity matching

### Storage
| Option | Description | Selected |
|--------|-------------|----------|
| Text + optional ISIC tags | Human-readable text + admin-tagged codes; codes drive matching | ✓ |
| ISIC codes only | Structured-only; heavy/lossy entry | |
| Freeform text only | Keyword/fuzzy; high false-positive | |
| You decide | Researcher picks | |

### Match logic
| Option | Description | Selected |
|--------|-------------|----------|
| ISIC-code overlap, miss → advisory | Deterministic, low false-positive | ✓ |
| Keyword/substring on text | Fuzzy, noisy | |
| You decide | Researcher picks | |

### Advisory action
| Option | Description | Selected |
|--------|-------------|----------|
| Non-block banner + auto-add NOC item | Banner + auto-create NOC required-doc; contract proceeds | ✓ |
| Banner only, no auto-doc | Manual NOC add | |
| Hard-block contract creation | Over-rotates; ROADMAP says advisory | |
| You decide | Researcher picks | |

### Uncertain (uncoded) case
| Option | Description | Selected |
|--------|-------------|----------|
| Skip — no code, no check | No false alarm (Pitfall 15) | ✓ |
| MANUAL_REVIEW tristate | Distinct review state; more noise | |
| You decide | Researcher picks | |

**User's choice:** text + optional ISIC tags · ISIC-code overlap · non-block banner + auto-NOC · skip when uncoded

---

## Saudization data + trajectory

### Per-engagement Saudi fields location
| Option | Description | Selected |
|--------|-------------|----------|
| Extend ContractorAssignment | Add isSaudi/nationality/qiwaContractAuthenticated columns | ✓ |
| New 1:1 SaudiEngagementProfile | Separate model + join | |
| You decide | Researcher picks | |

### Headcount source
| Option | Description | Selected |
|--------|-------------|----------|
| Manual SaudiHeadcount + derived cross-check | Admin enters org-wide headcount; show platform-derived alongside | ✓ |
| Auto-derive from platform contractors | Understates real workforce | |
| You decide | Researcher picks | |

### Qiwa-auth coverage gap
| Option | Description | Selected |
|--------|-------------|----------|
| Visibility-only count | Dashboard count of unauthenticated contracts | ✓ |
| Per-engagement WARNING item | Per-contractor surfacing; more noise | |
| You decide | Researcher picks | |

### Offboarding band-trajectory banner
| Option | Description | Selected |
|--------|-------------|----------|
| Live ephemeral recompute, advisory wording | Project from current headcount −1 Saudi; non-authoritative | ✓ |
| Snapshot on WorkflowRun | Persisted; stale-read risk, implies authoritative band | |
| You decide | Researcher picks | |

**User's choice:** extend ContractorAssignment · manual SaudiHeadcount + derived cross-check · visibility-only Qiwa gap · live ephemeral advisory trajectory
**Notes:** Nitaqat is whole-workforce; platform only sees contractors → headcount must be manual. Band manual forever; trajectory may only *suggest*, never set.

---

## Arabic/RTL + locked phrases

### RTL infra
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse v4.0 RTL infra | CSS logical props, ar.json, use-rtl-chart-config, ml-/mr- guard | ✓ |
| Gulf-specific RTL handling | Redundant | |
| You decide | Researcher picks | |

### Locked-phrase scope
| Option | Description | Selected |
|--------|-------------|----------|
| Lock statutory identifiers only | Authority names, band labels, Qiwa status → constants; rest translatable | ✓ |
| Lock all Gulf Arabic copy | Over-locks | |
| Lock nothing | Drift risk | |
| You decide | Researcher picks | |

### Registry file structure
| Option | Description | Selected |
|--------|-------------|----------|
| Separate legal/ae.ts + legal/sa.ts | Mirror LOCKED_GB/DE_PHRASES | ✓ |
| One combined legal/gulf.ts | Diverges from convention | |
| You decide | Researcher picks | |

### de/pl i18n parity
| Option | Description | Selected |
|--------|-------------|----------|
| Keys in all 4, en-placeholder for de/pl | Parity satisfied; de/pl placeholders | |
| Real translations in all 4 locales | Genuine de + pl values | ✓ |
| You decide | Researcher picks | |

**User's choice:** reuse v4.0 RTL · lock statutory identifiers only · separate ae.ts + sa.ts · **real de+pl translations** (overrode placeholder default)

---

## Claude's Discretion

FreeZoneAssignment field set/indexes + UaeFreeZone seed; NOC item severity (default WARNING); ISIC code-set depth + where contract activity code lives; SaudizationConfig/SaudiHeadcount schema + quarterly re-entry prompt; region-routing annotation mechanics + cross-region-leakage schema-lint; GULF-10 drift-override storage/audit shape; web-vite dashboard data-layer wiring + loading/empty/error states; exact locked Arabic statutory strings (PENDING legal review); Iqama expiry roll-up reuse of F1 expiry data.

## Deferred Ideas

None — discussion stayed within phase scope. (Auto-computed Saudization band = locked anti-feature, GULF-FUTURE-02.)

## Additional user mandate

Follow coding standards, DB/lint/biome gates, DRY/SOLID, reuse existing codebase, careful minimal diffs (captured as D-17 in CONTEXT.md).
