# Portal UI Polish — Facts

## Scope

- Pass covers every route under `apps/web/src/app/[locale]/(portal)/`: login, verify, org-picker, overview, contracts (list+detail), invoices (list+detail+submit+success), documents, time, equipment, payments, settings.
- All components under `apps/web/src/components/portal/` are in scope.
- No new tRPC routers unless directly required for org-switching (`portal.listMyOrgs`, `portal.switchOrg`).
- No content/copy rewrites — i18n string additions only for new empty-state + switcher microcopy.
- No new npm dependencies; only existing shadcn, lucide, Tailwind, `@contractor-ops/ui` Atelier set.

## Layout & Spacing

- Portal shell container stays `max-w-[1200px] p-6` on all routes (no per-route widths).
- Every route's root child is centered horizontally inside the shell with no double-padding.
- Vertical rhythm across routes uses a single spacing scale (root `space-y-6` between top-level page sections, `space-y-4` inside sections).
- No route has horizontal overflow at 360px, 390px, 430px, 768px, 1024px, 1280px viewports.
- No route triggers cumulative layout shift > 0.1 between skeleton and loaded state.

## Top Bar & Navigation

- Top bar height stays 56px (`h-14`) and remains sticky.
- Active nav item is visually distinct (background tint + bold weight + active text color) and uses `aria-current="page"`.
- All nav items have visible focus rings (keyboard `Tab`) matching the global focus token.
- Org name + logo on the left of the top bar are not a link to org switcher anymore; the org switcher lives inside the profile dropdown.

## Org Switching (multi-org contractors)

- Profile dropdown shows a "Switch organization" submenu item only when the contractor has 2+ org associations.
- Submenu lists every org the contractor belongs to with the org's logo (or initial fallback) and name.
- Current org is marked with a checkmark and is disabled.
- Selecting a different org calls a tRPC mutation that issues a new portal session for the chosen `contractorId`/`organizationId`, sets the `portal_session` cookie, and reloads to `/portal`.
- During switching, the submenu item shows a spinner and is not clickable.
- Switch flow works on mobile via the mobile sheet menu (same submenu surface).
- Contractors with exactly 1 org never see the switcher entry.

## Org Branding

- `organization.settingsJson.brandColor` (if present, valid hex/HSL) is exposed as a CSS variable on the portal shell (e.g., `--portal-brand`) and is the source of truth for primary accent inside the portal.
- Brand color override never leaks outside `(portal)` route group (dashboard/admin stay on default theme).
- Brand color tint applied to: active nav item indicator, primary buttons, focus rings, status pills marked "primary", inline illustration `currentColor`.
- Brand color falls back to the default primary token when missing or unparseable.
- Org logo on the top bar shows the org's `Image` when set, otherwise a circular initial badge with the first letter.
- Org branding cache uses a dedicated cache row (not the broad `getOrgMeta` envelope) per `apps/web/src/app/[locale]/(portal)/layout.tsx:60`.

## Empty States

- Every list/table/grid route renders `AtelierEmptyState` from `@contractor-ops/ui` (no ad-hoc text-only empties).
- Each empty state has: illustration (one of the existing `*Illustration` exports or a new monoline SVG), heading, supporting body line, primary action button when an action exists.
- Routes with required empty states: contracts (no contracts), invoices (no invoices), invoices/submit (no contracts to submit against), documents (no documents), time (no time entries), equipment (no assignments), payments (no payments), settings audit log (no events).
- Each empty state has an i18n key under `Portal.emptyStates.<surface>` with title + body + (optional) actionLabel.
- Empty-state illustrations use `currentColor` so they tint with the org brand color.

## Illustrations

- All net-new illustrations are inline monoline SVGs added to `packages/ui/src/components/workbench/empty-state-illustrations.tsx` (or its existing colocated file) — no external assets.
- New illustrations: `PaymentsIllustration`, `TimeEntriesIllustration`, `SettingsAuditEmptyIllustration` (only those not already exported).
- All illustrations accept `className` and render `stroke="currentColor"` with `stroke-width="1.5"`.

## Loading States

- Every async route renders a skeleton matching the final layout's outermost dimensions before data resolves; no centered spinners as the primary loading state.
- Skeleton components live next to (or in) the page they serve — no shared "Skeleton" wrappers added unless used by 2+ routes.
- Skeletons are static (no entrance animations) but use the existing `Skeleton` shimmer.

## Mobile

- Portal mobile menu opens on tap of the hamburger and traps focus inside the sheet.
- Mobile menu shows the org logo + name as the sheet header.
- Mobile menu has the same nav items, org switcher submenu (when applicable), and sign-out as desktop.
- All forms (login, invoice submit, settings) are usable at 360px width — inputs are full-width, no horizontal scroll.
- Tap targets on all interactive elements are at least 40×40px.

## Login & Org Picker

- Login page is vertically centered in the viewport with the org's logo above the form when accessed via a `portalSubdomain`.
- Org picker (`OrgPicker`) stays `max-w-[480px]` centered; cards show logo + name with hover accent border tinted by brand color.
- Empty unverified state on `/portal/login/verify` shows skeleton then either success or error card — no flashes of unstyled content.

## RTL

- Every route renders correctly under `ar` locale: nav items flow right-to-left, icons that imply direction (chevrons, arrows, back buttons) flip via `rtl:rotate-180` or use logical-direction icons.
- No literal `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*` Tailwind classes remain in portal source (replaced with `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`).
- Form labels, helper text, validation messages align to the inline-start in RTL.

## Accessibility

- Every portal route passes `jest-axe` with zero violations (impact ≥ serious) using `axe.run({ rules: { 'color-contrast': { enabled: true } } })`.
- Every interactive non-link non-button element has `role` + `aria-label` (e.g., the org switcher items).
- Heading order on every route is monotonic: exactly one `<h1>`, no skipped levels.
- Skip-to-content link present on the portal shell (already exists) keeps working after polish.
- Color contrast on text + brand-tinted UI passes WCAG AA (4.5:1 normal, 3:1 large) for every supported brand color sample in the test set.

## Microcopy (i18n)

- All new strings added under `Portal.*` namespace in `apps/web/messages/{en,de,pl,ar}.json`.
- New keys at minimum:
  - `Portal.emptyStates.<surface>.{title,body,actionLabel?}` for each surface listed above
  - `Portal.orgSwitch.{label,current,switching,error}`
- No string is hard-coded in JSX; every visible string flows through `useTranslations`.

## Done Condition

- Visiting every portal route at 360px, 768px, 1280px in `en`, `de`, `pl`, `ar` shows: centered layout, polished spacing, illustration empty states where applicable, loading skeletons, org-tinted accents, and a working org switcher (where multi-org).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
- `jest-axe` portal route test suite reports 0 violations.
- No regressions in existing portal feature tests.
