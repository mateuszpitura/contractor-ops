# Product

## Register

product

> Scope note: this file describes the **operational app** (`apps/web-vite`, plus the
> external `/portal` surface) — the primary design target. `apps/landing` (Next.js
> marketing) is a separate **brand**-register surface and overrides this default per task.

## Users

Three audiences, weighted internal + external roughly equally:

- **Internal ops / finance staff (daily driver).** Run multi-jurisdiction contractor
  operations across EU / UK / Gulf: e-invoicing, payments, contracts, engagements,
  timesheets, approvals, classification triage. Task-focused, returning many times a
  day, working dense data. Speed and density matter; they know the domain.
- **External contractors (portal).** The separate `/portal` surface — lighter, guided,
  infrequent use. They are not power users; clarity beats density.
- **Founder-operator / admin.** Configures orgs, integrations, jurisdictions, and
  settings. Needs the system to be legible end-to-end, not just per-screen.

**Context:** compliance-sensitive work involving money and legal-adjacent data, across
four locales (en / de / pl / ar) including Arabic **RTL**. Often on wide screens with
dense tables; sometimes guided single-task flows.

**Job to be done:** keep contractor operations compliant and paid across jurisdictions
without manual spreadsheet juggling — connect the flow, surface the next action.

## Product Purpose

A B2B contractor-operations platform. The lead value is **e-invoicing + operations
orchestration** across EU / UK / Gulf regimes (KSeF, Peppol, ZATCA, …) — **not**
classification-as-verdict, which is partner-carried (Steuerberater / doradca / DATEV)
to keep liability off the product. Success = staff complete compliance and billing
flows quickly and correctly, trust the tool with money and sensitive data, and stay
(low churn). It is bootstrapped for sustainable MRR, so retention and autonomous value
outrank flashy acquisition surfaces.

## Brand Personality

**Precise. Quietly premium. Trustworthy.**

Voice is clear, expert, and calm — financial-grade confidence without hype. The craft
shows in the details (spacing rhythm, complete interaction states, motion that conveys
state) rather than in decoration. Restraint is the flex: the interface should feel
expensive because it is *exact*, not because it is loud.

## Anti-references

- **Sterile enterprise gray** (SAP / legacy admin): dead gray, flat hierarchy,
  dense-but-ugly, zero polish. We are denser than consumer apps but never ugly.
- **Crypto / fintech dark-neon**: black canvas + saturated neon, glassmorphism
  everywhere, hype aesthetic. Trust here is earned by clarity, not spectacle.
- **The decorative-atelier trap (internal).** The shared CSS ships a maximalist kit —
  `aurora-bg`, `conic-border`, `neon-card`, `gradient-text`, animated `hero-metric`
  glow, broad glass. Used liberally on operational screens these read as exactly the
  neon/hype lane above. Reserve heavy effects for marketing/landing and rare hero
  moments; operational surfaces stay calm.

## Design Principles

1. **Orchestration over tools.** The UI connects flows (engagement → invoice → payment →
   compliance), it doesn't just expose isolated features. Every screen answers "what's
   the next action?"
2. **Premium = restraint.** Craft lives in spacing, complete states, and feedback motion
   — decoration must earn its place or be cut. Quietly premium, never loud.
3. **Financial-grade trust.** Money and legal screens are unambiguous, reversible where
   possible, and honest in their errors. The critical path is held to AAA clarity.
4. **Locale parity is first-class.** en / de / pl / ar (RTL) are equal citizens. Layouts
   use logical properties and are direction-safe; copy is translated, never hardcoded.
5. **Density that serves the task.** Match information density to the audience — staff
   dense and fast, portal guided and light. Skeletons not spinners; empty states that
   teach the interface.

## Accessibility & Inclusion

- **WCAG 2.2 AA baseline** app-wide: contrast, full keyboard operability, visible focus,
  semantic HTML.
- **AAA on financial / legal flows** — invoices, payments, classification, sign-off:
  stricter contrast and copy clarity on the screens where mistakes cost money.
- **RTL + i18n first-class.** Arabic RTL and de / pl parity are non-negotiable, not
  afterthoughts (Noto Sans Arabic + `dir="rtl"` already wired).
- **Reduced motion & reduced transparency** fully honored
  (`prefers-reduced-motion`, `prefers-reduced-transparency`) — every animated or glassy
  primitive degrades to a calm, legible fallback.
