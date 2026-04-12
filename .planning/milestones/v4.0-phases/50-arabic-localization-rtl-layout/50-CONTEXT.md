# Phase 50: Arabic Localization & RTL Layout - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Arabic as the third locale (alongside Polish and English) with full RTL layout support. Convert all CSS to logical properties, handle bidirectional text with systematic `<bdi>` wrapping, mirror charts and data visualizations, and use locale-appropriate formatting with Western/Latin numerals for financial data.

</domain>

<decisions>
## Implementation Decisions

### RTL Conversion Strategy
- **D-01:** Tailwind CSS logical properties — refactor all directional utilities to logical equivalents (ps/pe/ms/me/start/end instead of pl/pr/ml/mr/left/right). Set `dir="rtl"` on `<html>` when Arabic is selected. Tailwind v3.3+ handles the flip natively.
- **D-02:** Big-bang conversion in this phase — convert all directional CSS across the entire codebase in one pass. No incremental rollout. Clean break ensures RTL works everywhere once done.

### Arabic Translation
- **D-03:** AI translation + professional review — use Claude/GPT for initial Arabic translations from English strings, then have a professional Arabic financial domain translator review and correct. Cost-effective first pass with quality assured by human review.
- **D-04:** Western/Latin numerals (1,2,3) for all financial data — invoice amounts, payment totals, reports. Eastern Arabic numerals (١,٢,٣) NOT used for financial data. Aligns with Gulf business software conventions and success criteria.

### Bidirectional Text
- **D-05:** Systematic `<bdi>` wrapping — create a `<Bdi>` React component. Wrap all user-generated content (contractor names, invoice numbers, free-text fields) in `<bdi>` elements across all data display components. Prevents LTR text from disrupting RTL flow.

### Charts & Data Visualization
- **D-06:** RTL-aware chart wrapper component — detects locale and applies RTL config automatically: flips X-axis direction (right-to-left reading via Recharts `reversed` prop), mirrors legend placement, adjusts tooltip positioning. No CSS transform hacks.

### Claude's Discretion
- i18n file structure for Arabic locale (extending existing PL/EN pattern)
- Tailwind logical property codemod approach (automated regex/AST vs manual)
- Arabic font selection (Noto Sans Arabic, Inter Arabic, etc.)
- Date formatting for Arabic locale (Hijri calendar support or Gregorian-only)
- TanStack Table column alignment in RTL mode

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing i18n infrastructure
- Existing Polish + English locale files (pattern to extend with Arabic)
- Next.js locale routing configuration

### Prior phase context
- `.planning/phases/45-pluggable-e-invoicing-engine-core/45-CONTEXT.md` — Engine with e-invoicing types (Arabic invoice display)
- `.planning/phases/46-multi-currency-foundation-swift-payment-export/46-CONTEXT.md` — Dinero.js formatting (currency display in Arabic)

### Requirements
- `.planning/REQUIREMENTS.md` — L10N-01 through L10N-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing i18n setup (Polish + English) — extend with Arabic locale
- Next.js locale routing — add 'ar' locale
- Recharts dashboard components — wrap with RTL-aware chart component
- TanStack Table — configure column alignment for RTL

### Established Patterns
- i18n key structure from v1.0
- Tailwind CSS utility classes throughout (target for logical property conversion)
- shadcn/ui components (need RTL audit)

### Integration Points
- Every page/component with directional CSS — big-bang refactor target
- All data display components — need `<Bdi>` wrapping
- Dashboard charts (Recharts) — need RTL wrapper
- Next.js middleware — locale detection and `dir` attribute setting
- HTML `<html>` element — `dir` and `lang` attributes

</code_context>

<specifics>
## Specific Ideas

- STATE.md notes: "Arabic strings before RTL layout" — but since this is one phase, do strings and RTL together
- STATE.md blocker: "Arabic translation requires professional financial domain translator — scope and budget before Phase 50"
- Western/Latin numerals are critical — Gulf business users expect 1,2,3 for money, not ١,٢,٣

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-arabic-localization-rtl-layout*
*Context gathered: 2026-04-11*
