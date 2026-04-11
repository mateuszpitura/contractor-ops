# Phase 50: Arabic Localization & RTL Layout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 50-Arabic Localization & RTL Layout
**Areas discussed:** RTL conversion strategy, Arabic translation approach, Bidirectional text handling, Charts & data viz in RTL

---

## RTL Conversion Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Tailwind CSS logical properties | Native logical props (ps/pe/ms/me). Tailwind handles flip. | ✓ |
| PostCSS RTL plugin | Auto-generate RTL variants. Less manual work. | |
| You decide | Claude picks | |

**User's choice:** Tailwind CSS logical properties

| Option | Description | Selected |
|--------|-------------|----------|
| Big-bang in this phase | Convert all directional CSS at once. Clean break. | ✓ |
| Incremental per page/route | Convert one section at a time. | |
| You decide | Claude picks | |

**User's choice:** Big-bang in this phase

---

## Arabic Translation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| AI translation + professional review | Claude/GPT first pass, human reviewer for financial terms. | ✓ |
| Professional translator only | All strings to professional. Slower, more expensive. | |
| Machine translation only | AI-only. Fast but risky for financial terms. | |
| You decide | Claude picks | |

**User's choice:** AI translation + professional review

| Option | Description | Selected |
|--------|-------------|----------|
| Western/Latin numerals for financial | 1,2,3 for all financial data. Gulf business convention. | ✓ |
| Eastern Arabic throughout | ١,٢,٣ everywhere. Authentic but unfamiliar. | |
| You decide | Claude picks | |

**User's choice:** Western/Latin numerals for financial

---

## Bidirectional Text Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Systematic <bdi> wrapping | Bdi React component for all user content. | ✓ |
| Unicode bidi markers | Control characters. Harder to debug. | |
| You decide | Claude picks | |

**User's choice:** Systematic <bdi> wrapping

---

## Charts & Data Viz in RTL

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror axes + RTL wrapper | RTL-aware wrapper. Recharts reversed prop. Auto-detects locale. | ✓ |
| CSS transform mirror | scaleX(-1) hack. Breaks interactions. | |
| You decide | Claude picks | |

**User's choice:** Mirror axes + RTL wrapper

---

## Claude's Discretion

- i18n file structure, codemod approach, Arabic font
- Date formatting (Hijri vs Gregorian)
- TanStack Table RTL alignment

## Deferred Ideas

None — discussion stayed within phase scope.
