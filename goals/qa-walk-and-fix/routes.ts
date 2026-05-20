/**
 * routes.ts — canonical route registry for the QA walk-and-fix loop.
 *
 * Every URL the walk visits across `apps/web`, `apps/landing`, and
 * `apps/cms` lives here with metadata: which app it belongs to, which role
 * is required, which entities must exist in the seed, which modals /
 * sheets / dialogs to open from that page, and which dynamic params it
 * accepts. The walk orchestrator (`walk.ts`) imports this list and
 * resolves dynamic params at runtime from the `QA_*` env vars + DB
 * lookups against the seeded `qa-default-org`.
 *
 * CLI:
 *   tsx goals/qa-walk-and-fix/routes.ts --print
 *
 * Prints a table of every registered route with role + entity requirements.
 */

export type AppName = 'web' | 'landing' | 'cms';

export type Role =
  | 'anonymous' // no session required
  | 'admin' // QA_ADMIN_EMAIL
  | 'accountant' // QA_ACCOUNTANT_EMAIL
  | 'contractor-portal' // QA_CONTRACTOR via PortalMagicToken trade
  | 'cms-admin'; // CMS_ADMIN_EMAIL (existing seed-admin user)

export type WalkState =
  | 'default'
  | 'empty'
  | 'loading'
  | 'error'
  | 'disabled'
  | 'mobile'
  | 'rtl'
  | 'focus'
  | 'dark';

/** A modal / sheet / popover / dropdown / dialog to open from a parent
 * route. Each gets its own screenshot. */
export interface ModalSpec {
  /** Stable key — used to build the screenshot path. */
  id: string;
  /** Human-readable description of the trigger element (e.g. button label).
   * The orchestrator uses this as a hint when probing `snapshot -i` output. */
  trigger: string;
  /** Optional notes for state coverage (e.g. "open with empty form"). */
  notes?: string;
}

/** Param-name → sample-value resolver hint. The orchestrator replaces
 * `[name]` placeholders in `pathTemplate` with values from this map at
 * runtime; missing keys are filled by querying the seeded DB. */
export type ParamSamples = Record<string, string>;

export interface RouteSpec {
  /** Stable kebab-case id used as the screenshot folder slug. */
  id: string;
  /** App owning the route. */
  app: AppName;
  /** URL pattern as in the Next.js source (e.g. `/contractors/[id]`). */
  pathTemplate: string;
  /** Role required to open the page. */
  role: Role;
  /** Whether the route lives behind locale prefix (`/[locale]/…`). All
   * three apps localize their routes, so this defaults to true. Static
   * sub-paths like `/admin` or `/api` opt out. */
  localized?: boolean;
  /** Dynamic param defaults for the dry-run printer. Runtime resolution
   * happens in the walk orchestrator from seeded data. */
  paramSamples?: ParamSamples;
  /** Entity types the seed must contain before the walk can render the
   * route in `default` state. Used by Step 1 coverage verification. */
  requiresEntity?: readonly string[];
  /** Which states the walk should attempt for this route. Defaults to the
   * full matrix; pages that don't load data (static legal text, login
   * forms) restrict to the layout-only states. */
  states?: readonly WalkState[];
  /** Modal triggers to exercise from the parent route. */
  modals?: readonly ModalSpec[];
  /** Free-text notes — surface gotchas (e.g. "requires an open invoice in
   * RECEIVED state"). */
  notes?: string;
}

// ---------------------------------------------------------------------------
// apps/web — dashboard (admin role)
// ---------------------------------------------------------------------------

const WEB_DASHBOARD_ROUTES: readonly RouteSpec[] = [
  {
    id: 'web-dashboard-home',
    app: 'web',
    pathTemplate: '/',
    role: 'admin',
    requiresEntity: ['Organization'],
    modals: [
      { id: 'command-palette', trigger: 'Cmd+K / Ctrl+K' },
      { id: 'notifications-popover', trigger: 'Bell icon in top bar' },
      { id: 'user-menu', trigger: 'Avatar dropdown' },
    ],
  },
  {
    id: 'web-contractors-list',
    app: 'web',
    pathTemplate: '/contractors',
    role: 'admin',
    requiresEntity: ['Contractor'],
    modals: [
      { id: 'new-contractor-wizard', trigger: '"New contractor" CTA' },
      { id: 'filter-sheet', trigger: '"Filters" button' },
      { id: 'column-picker', trigger: 'Column picker dropdown in table header' },
      {
        id: 'bulk-action-bar',
        trigger: 'Select multiple rows',
        notes: 'Surfaces a sticky action bar with bulk-archive / bulk-tag',
      },
    ],
  },
  {
    id: 'web-contractor-detail',
    app: 'web',
    pathTemplate: '/contractors/[id]',
    role: 'admin',
    requiresEntity: ['Contractor'],
    paramSamples: { id: 'qa-contractor-id' },
    modals: [
      { id: 'edit-contractor', trigger: 'Edit button' },
      { id: 'archive-confirm', trigger: 'Archive contractor action' },
      { id: 'tag-picker', trigger: 'Tag editor in header' },
      { id: 'classification-tab', trigger: 'Classification tab' },
      { id: 'invoices-tab', trigger: 'Invoices tab' },
      { id: 'payments-tab', trigger: 'Payments tab' },
      { id: 'documents-tab', trigger: 'Documents tab' },
    ],
  },
  {
    id: 'web-contractor-classification',
    app: 'web',
    pathTemplate: '/contractors/[id]/classification',
    role: 'admin',
    requiresEntity: ['Contractor', 'ClassificationAssessment'],
    paramSamples: { id: 'qa-contractor-id' },
  },
  {
    id: 'web-contractor-engagement',
    app: 'web',
    pathTemplate: '/contractors/[id]/engagements/[engagementId]',
    role: 'admin',
    requiresEntity: ['Contractor', 'Contract'],
    paramSamples: { id: 'qa-contractor-id', engagementId: 'qa-engagement-id' },
  },
  {
    id: 'web-contractor-engagement-classification',
    app: 'web',
    pathTemplate: '/contractors/[id]/engagements/[engagementId]/classification',
    role: 'admin',
    requiresEntity: ['Contract', 'ClassificationAssessment'],
    paramSamples: { id: 'qa-contractor-id', engagementId: 'qa-engagement-id' },
  },
  {
    id: 'web-contractor-engagement-classification-detail',
    app: 'web',
    pathTemplate: '/contractors/[id]/engagements/[engagementId]/classification/[assessmentId]',
    role: 'admin',
    requiresEntity: ['ClassificationAssessment'],
    paramSamples: {
      id: 'qa-contractor-id',
      engagementId: 'qa-engagement-id',
      assessmentId: 'qa-assessment-id',
    },
  },
  {
    id: 'web-contracts-list',
    app: 'web',
    pathTemplate: '/contracts',
    role: 'admin',
    requiresEntity: ['Contract'],
    modals: [
      { id: 'new-contract', trigger: '"New contract" CTA' },
      { id: 'amendment-wizard', trigger: 'Row action: "Amend"' },
    ],
  },
  {
    id: 'web-contract-detail',
    app: 'web',
    pathTemplate: '/contracts/[id]',
    role: 'admin',
    requiresEntity: ['Contract'],
    paramSamples: { id: 'qa-contract-id' },
    modals: [
      { id: 'esign-envelope', trigger: '"Send for signature" CTA' },
      { id: 'rate-period-editor', trigger: 'Rate-period row edit' },
    ],
  },
  {
    id: 'web-invoices-list',
    app: 'web',
    pathTemplate: '/invoices',
    role: 'admin',
    requiresEntity: ['Invoice'],
    modals: [
      { id: 'new-invoice', trigger: '"New invoice" CTA' },
      { id: 'invoice-status-filter', trigger: 'Status filter chip' },
    ],
  },
  {
    id: 'web-invoice-detail',
    app: 'web',
    pathTemplate: '/invoices/[id]',
    role: 'admin',
    requiresEntity: ['Invoice'],
    paramSamples: { id: 'qa-invoice-id' },
    modals: [
      { id: 'reject-invoice', trigger: '"Reject" CTA' },
      { id: 'approve-invoice', trigger: '"Approve" CTA' },
      { id: 'schedule-payment', trigger: '"Schedule payment" CTA' },
      { id: 'pdf-preview', trigger: 'Document thumbnail' },
    ],
  },
  {
    id: 'web-invoice-intake',
    app: 'web',
    pathTemplate: '/invoices/intake',
    role: 'admin',
    requiresEntity: ['InvoiceIntakeRequest'],
  },
  {
    id: 'web-invoice-intake-detail',
    app: 'web',
    pathTemplate: '/invoices/intake/[id]',
    role: 'admin',
    requiresEntity: ['InvoiceIntakeRequest'],
    paramSamples: { id: 'qa-intake-id' },
  },
  {
    id: 'web-approvals',
    app: 'web',
    pathTemplate: '/approvals',
    role: 'admin',
    requiresEntity: ['ApprovalFlow'],
    modals: [{ id: 'approval-decision', trigger: 'Row CTA: Approve / Reject' }],
  },
  {
    id: 'web-classification',
    app: 'web',
    pathTemplate: '/classification',
    role: 'admin',
    requiresEntity: ['ClassificationAssessment'],
  },
  {
    id: 'web-classification-expert-help',
    app: 'web',
    pathTemplate: '/classification/expert-help',
    role: 'admin',
  },
  {
    id: 'web-equipment-list',
    app: 'web',
    pathTemplate: '/equipment',
    role: 'admin',
    requiresEntity: ['Equipment'],
    modals: [
      { id: 'new-equipment', trigger: '"Add equipment" CTA' },
      { id: 'assign-equipment', trigger: 'Row action: Assign' },
    ],
  },
  {
    id: 'web-equipment-detail',
    app: 'web',
    pathTemplate: '/equipment/[id]',
    role: 'admin',
    requiresEntity: ['Equipment'],
    paramSamples: { id: 'qa-equipment-id' },
    modals: [{ id: 'return-request', trigger: '"Request return" CTA' }],
  },
  {
    id: 'web-payments',
    app: 'web',
    pathTemplate: '/payments',
    role: 'admin',
    requiresEntity: ['PaymentRun'],
    modals: [
      { id: 'new-payment-run', trigger: '"New payment run" wizard' },
      { id: 'payment-run-detail-sheet', trigger: 'Row click' },
    ],
  },
  {
    id: 'web-workflows-list',
    app: 'web',
    pathTemplate: '/workflows',
    role: 'admin',
    requiresEntity: ['WorkflowRun'],
    modals: [{ id: 'new-workflow-run', trigger: '"Start workflow" CTA' }],
  },
  {
    id: 'web-workflow-detail',
    app: 'web',
    pathTemplate: '/workflows/[id]',
    role: 'admin',
    requiresEntity: ['WorkflowRun'],
    paramSamples: { id: 'qa-workflow-run-id' },
  },
  {
    id: 'web-workflow-template-new',
    app: 'web',
    pathTemplate: '/workflows/templates/new',
    role: 'admin',
  },
  {
    id: 'web-workflow-template-detail',
    app: 'web',
    pathTemplate: '/workflows/templates/[id]',
    role: 'admin',
    requiresEntity: ['WorkflowTemplate'],
    paramSamples: { id: 'qa-workflow-template-id' },
  },
  {
    id: 'web-time-list',
    app: 'web',
    pathTemplate: '/time',
    role: 'admin',
    requiresEntity: ['Timesheet'],
  },
  {
    id: 'web-time-contractor',
    app: 'web',
    pathTemplate: '/time/[contractorId]',
    role: 'admin',
    requiresEntity: ['Timesheet'],
    paramSamples: { contractorId: 'qa-contractor-id' },
  },
  {
    id: 'web-reports',
    app: 'web',
    pathTemplate: '/reports',
    role: 'admin',
    requiresEntity: ['Invoice', 'PaymentRun'],
  },
  {
    id: 'web-notifications',
    app: 'web',
    pathTemplate: '/notifications',
    role: 'admin',
    requiresEntity: ['Notification'],
  },
  {
    id: 'web-organization',
    app: 'web',
    pathTemplate: '/organization',
    role: 'admin',
  },
  {
    id: 'web-organization-projects',
    app: 'web',
    pathTemplate: '/organization/projects',
    role: 'admin',
    requiresEntity: ['Project'],
  },
  {
    id: 'web-organization-teams',
    app: 'web',
    pathTemplate: '/organization/teams',
    role: 'admin',
    requiresEntity: ['Team'],
  },
  {
    id: 'web-organization-cost-centers',
    app: 'web',
    pathTemplate: '/organization/cost-centers',
    role: 'admin',
    requiresEntity: ['CostCenter'],
  },
  {
    id: 'web-settings-home',
    app: 'web',
    pathTemplate: '/settings',
    role: 'admin',
  },
  {
    id: 'web-settings-payments',
    app: 'web',
    pathTemplate: '/settings/payments',
    role: 'admin',
  },
  {
    id: 'web-settings-calendar',
    app: 'web',
    pathTemplate: '/settings/calendar',
    role: 'admin',
  },
  {
    id: 'web-settings-workflow-roles',
    app: 'web',
    pathTemplate: '/settings/workflow-roles',
    role: 'admin',
    requiresEntity: ['WorkflowRoleTemplate'],
  },
  {
    id: 'web-settings-e-invoicing',
    app: 'web',
    pathTemplate: '/settings/e-invoicing',
    role: 'admin',
  },
  {
    id: 'web-settings-e-invoicing-log',
    app: 'web',
    pathTemplate: '/settings/e-invoicing/log',
    role: 'admin',
  },
  {
    id: 'web-settings-tax',
    app: 'web',
    pathTemplate: '/settings/tax',
    role: 'admin',
  },
  {
    id: 'web-settings-members',
    app: 'web',
    pathTemplate: '/settings/members',
    role: 'admin',
    requiresEntity: ['Member'],
    modals: [{ id: 'invite-member', trigger: '"Invite" CTA' }],
  },
  {
    id: 'web-settings-integrations-zatca',
    app: 'web',
    pathTemplate: '/settings/integrations/zatca',
    role: 'admin',
  },
  {
    id: 'web-onboarding-import',
    app: 'web',
    pathTemplate: '/onboarding/import',
    role: 'admin',
  },
  {
    id: 'web-unauthorized',
    app: 'web',
    pathTemplate: '/unauthorized',
    role: 'admin',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
];

// ---------------------------------------------------------------------------
// apps/web — auth (anonymous)
// ---------------------------------------------------------------------------

const WEB_AUTH_ROUTES: readonly RouteSpec[] = [
  {
    id: 'web-login',
    app: 'web',
    pathTemplate: '/login',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark', 'error'],
    modals: [{ id: 'forgot-password', trigger: '"Forgot password?" link' }],
  },
  {
    id: 'web-register',
    app: 'web',
    pathTemplate: '/register',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark', 'error'],
  },
  {
    id: 'web-verify-email',
    app: 'web',
    pathTemplate: '/verify-email',
    role: 'anonymous',
    states: ['default', 'error', 'mobile', 'rtl', 'focus', 'dark'],
    notes: 'Token-required surface; walk hits only the empty/error rendering.',
  },
  {
    id: 'web-invite',
    app: 'web',
    pathTemplate: '/invite/[token]',
    role: 'anonymous',
    paramSamples: { token: 'qa-invite-token' },
    states: ['default', 'error', 'mobile', 'rtl', 'focus', 'dark'],
    notes: 'Token-required surface; walk hits only the empty/error rendering.',
  },
];

// ---------------------------------------------------------------------------
// apps/web — portal (contractor role via portal-session cookie)
// ---------------------------------------------------------------------------

const WEB_PORTAL_ROUTES: readonly RouteSpec[] = [
  {
    id: 'portal-login',
    app: 'web',
    pathTemplate: '/portal/login',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'portal-login-verify',
    app: 'web',
    pathTemplate: '/portal/login/verify',
    role: 'anonymous',
    states: ['default', 'error', 'mobile', 'rtl', 'focus', 'dark'],
    notes: 'Page consumes ?token=<rawMagicLink>. The walk pre-loads QA_CONTRACTOR_PORTAL_TOKEN.',
  },
  {
    id: 'portal-home',
    app: 'web',
    pathTemplate: '/portal',
    role: 'contractor-portal',
    requiresEntity: ['Contractor', 'PortalSession'],
  },
  {
    id: 'portal-contracts-list',
    app: 'web',
    pathTemplate: '/portal/contracts',
    role: 'contractor-portal',
    requiresEntity: ['Contract'],
  },
  {
    id: 'portal-contract-detail',
    app: 'web',
    pathTemplate: '/portal/contracts/[id]',
    role: 'contractor-portal',
    requiresEntity: ['Contract'],
    paramSamples: { id: 'qa-portal-contract-id' },
  },
  {
    id: 'portal-invoices-list',
    app: 'web',
    pathTemplate: '/portal/invoices',
    role: 'contractor-portal',
    requiresEntity: ['Invoice'],
  },
  {
    id: 'portal-invoice-detail',
    app: 'web',
    pathTemplate: '/portal/invoices/[id]',
    role: 'contractor-portal',
    requiresEntity: ['Invoice'],
    paramSamples: { id: 'qa-portal-invoice-id' },
  },
  {
    id: 'portal-invoice-submit',
    app: 'web',
    pathTemplate: '/portal/invoices/submit',
    role: 'contractor-portal',
    modals: [{ id: 'attach-document', trigger: 'File-drop area' }],
  },
  {
    id: 'portal-invoice-submit-success',
    app: 'web',
    pathTemplate: '/portal/invoices/submit/success',
    role: 'contractor-portal',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'portal-payments',
    app: 'web',
    pathTemplate: '/portal/payments',
    role: 'contractor-portal',
    requiresEntity: ['PaymentRunItem'],
  },
  {
    id: 'portal-documents',
    app: 'web',
    pathTemplate: '/portal/documents',
    role: 'contractor-portal',
  },
  {
    id: 'portal-equipment',
    app: 'web',
    pathTemplate: '/portal/equipment',
    role: 'contractor-portal',
    requiresEntity: ['EquipmentAssignment'],
  },
  {
    id: 'portal-time',
    app: 'web',
    pathTemplate: '/portal/time',
    role: 'contractor-portal',
    requiresEntity: ['Timesheet'],
  },
  {
    id: 'portal-settings',
    app: 'web',
    pathTemplate: '/portal/settings',
    role: 'contractor-portal',
    modals: [
      { id: 'change-bank', trigger: '"Edit bank details" CTA' },
      { id: 'notification-prefs', trigger: 'Notification preferences toggle group' },
    ],
  },
];

// ---------------------------------------------------------------------------
// apps/web — legal (static)
// ---------------------------------------------------------------------------

const WEB_LEGAL_ROUTES: readonly RouteSpec[] = [
  {
    id: 'web-legal-privacy',
    app: 'web',
    pathTemplate: '/legal/privacy',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'web-legal-privacy-jurisdiction',
    app: 'web',
    pathTemplate: '/legal/privacy/[jurisdiction]',
    role: 'anonymous',
    paramSamples: { jurisdiction: 'eu' },
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'web-legal-terms',
    app: 'web',
    pathTemplate: '/legal/terms',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'web-legal-sub-processors',
    app: 'web',
    pathTemplate: '/legal/sub-processors',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'web-legal-breach-notification',
    app: 'web',
    pathTemplate: '/legal/breach-notification',
    role: 'anonymous',
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
];

// ---------------------------------------------------------------------------
// apps/landing
// ---------------------------------------------------------------------------

const LANDING_ROUTES: readonly RouteSpec[] = [
  {
    id: 'landing-home',
    app: 'landing',
    pathTemplate: '/',
    role: 'anonymous',
  },
  { id: 'landing-about', app: 'landing', pathTemplate: '/about', role: 'anonymous' },
  { id: 'landing-pricing', app: 'landing', pathTemplate: '/pricing', role: 'anonymous' },
  { id: 'landing-security', app: 'landing', pathTemplate: '/security', role: 'anonymous' },
  { id: 'landing-changelog', app: 'landing', pathTemplate: '/changelog', role: 'anonymous' },
  {
    id: 'landing-solutions-role',
    app: 'landing',
    pathTemplate: '/solutions/[role]',
    role: 'anonymous',
    paramSamples: { role: 'contractor' },
  },
  {
    id: 'landing-compare-competitor',
    app: 'landing',
    pathTemplate: '/compare/[competitor]',
    role: 'anonymous',
    paramSamples: { competitor: 'rippling' },
  },
  {
    id: 'landing-blog-index',
    app: 'landing',
    pathTemplate: '/blog',
    role: 'anonymous',
    requiresEntity: ['cms:Post'],
  },
  {
    id: 'landing-blog-post',
    app: 'landing',
    pathTemplate: '/blog/[slug]',
    role: 'anonymous',
    paramSamples: { slug: 'classification-checklist' },
    requiresEntity: ['cms:Post'],
  },
  {
    id: 'landing-blog-author',
    app: 'landing',
    pathTemplate: '/blog/author/[handle]',
    role: 'anonymous',
    paramSamples: { handle: 'amelia-stone' },
    requiresEntity: ['cms:Author'],
  },
  {
    id: 'landing-blog-tag',
    app: 'landing',
    pathTemplate: '/blog/tag/[tag]',
    role: 'anonymous',
    paramSamples: { tag: 'compliance' },
    requiresEntity: ['cms:Post'],
  },
];

// ---------------------------------------------------------------------------
// apps/cms — Payload admin + frontend preview
// ---------------------------------------------------------------------------

const CMS_ROUTES: readonly RouteSpec[] = [
  {
    id: 'cms-frontend-root',
    app: 'cms',
    pathTemplate: '/',
    role: 'anonymous',
    localized: false,
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'cms-frontend-locale-home',
    app: 'cms',
    pathTemplate: '/[locale]',
    role: 'anonymous',
    localized: false, // path already contains the locale
    paramSamples: { locale: 'en' },
    states: ['default', 'mobile', 'rtl', 'focus', 'dark'],
  },
  {
    id: 'cms-frontend-blog-index',
    app: 'cms',
    pathTemplate: '/[locale]/blog',
    role: 'anonymous',
    localized: false,
    paramSamples: { locale: 'en' },
    requiresEntity: ['cms:Post'],
  },
  {
    id: 'cms-frontend-blog-post',
    app: 'cms',
    pathTemplate: '/[locale]/blog/[slug]',
    role: 'anonymous',
    localized: false,
    paramSamples: { locale: 'en', slug: 'classification-checklist' },
    requiresEntity: ['cms:Post'],
  },
  {
    id: 'cms-admin-login',
    app: 'cms',
    pathTemplate: '/admin/login',
    role: 'anonymous',
    localized: false,
    states: ['default', 'mobile', 'rtl', 'focus', 'dark', 'error'],
  },
  {
    id: 'cms-admin-dashboard',
    app: 'cms',
    pathTemplate: '/admin',
    role: 'cms-admin',
    localized: false,
  },
  {
    id: 'cms-admin-collection-users',
    app: 'cms',
    pathTemplate: '/admin/collections/users',
    role: 'cms-admin',
    localized: false,
  },
  {
    id: 'cms-admin-collection-posts',
    app: 'cms',
    pathTemplate: '/admin/collections/posts',
    role: 'cms-admin',
    localized: false,
    requiresEntity: ['cms:Post'],
  },
  {
    id: 'cms-admin-collection-authors',
    app: 'cms',
    pathTemplate: '/admin/collections/authors',
    role: 'cms-admin',
    localized: false,
    requiresEntity: ['cms:Author'],
  },
  {
    id: 'cms-admin-collection-categories',
    app: 'cms',
    pathTemplate: '/admin/collections/categories',
    role: 'cms-admin',
    localized: false,
    requiresEntity: ['cms:Category'],
  },
  {
    id: 'cms-admin-collection-media',
    app: 'cms',
    pathTemplate: '/admin/collections/media',
    role: 'cms-admin',
    localized: false,
  },
  {
    id: 'cms-admin-collection-legal',
    app: 'cms',
    pathTemplate: '/admin/collections/legal-documents',
    role: 'cms-admin',
    localized: false,
    requiresEntity: ['cms:LegalDocument'],
  },
];

// ---------------------------------------------------------------------------
// Exported registry
// ---------------------------------------------------------------------------

export const ROUTES: readonly RouteSpec[] = [
  ...WEB_DASHBOARD_ROUTES,
  ...WEB_AUTH_ROUTES,
  ...WEB_PORTAL_ROUTES,
  ...WEB_LEGAL_ROUTES,
  ...LANDING_ROUTES,
  ...CMS_ROUTES,
];

/** All states the walk visits by default. */
export const DEFAULT_STATES: readonly WalkState[] = [
  'default',
  'empty',
  'loading',
  'error',
  'disabled',
  'mobile',
  'rtl',
  'focus',
  'dark',
];

/** Resolve the states walk should attempt for a route. */
export function statesForRoute(route: RouteSpec): readonly WalkState[] {
  return route.states ?? DEFAULT_STATES;
}

/** All locales the walk renders each route in (web + landing only — the
 * CMS admin UI is English-only). */
export const LOCALES = ['en', 'pl', 'de', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

/** Both themes are walked for every locale + viewport. */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Viewports the walk captures per locale × theme. */
export const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;
export type ViewportSpec = (typeof VIEWPORTS)[number];

// ---------------------------------------------------------------------------
// --print CLI
// ---------------------------------------------------------------------------

function printRegistry(): void {
  const rows = ROUTES.map(r => ({
    id: r.id,
    app: r.app,
    role: r.role,
    path: r.pathTemplate,
    modals: r.modals?.length ?? 0,
    states: (r.states ?? DEFAULT_STATES).length,
    requiresEntity: r.requiresEntity?.join('+') ?? '',
  }));
  // Pretty-print as fixed-width columns; avoids pulling in cli-table3 just
  // for a debug dump.
  const widths = {
    id: Math.max(...rows.map(r => r.id.length), 'id'.length),
    app: Math.max(...rows.map(r => r.app.length), 'app'.length),
    role: Math.max(...rows.map(r => r.role.length), 'role'.length),
    path: Math.max(...rows.map(r => r.path.length), 'path'.length),
    modals: Math.max(...rows.map(r => String(r.modals).length), 'modals'.length),
    states: Math.max(...rows.map(r => String(r.states).length), 'states'.length),
    requiresEntity: Math.max(...rows.map(r => r.requiresEntity.length), 'requiresEntity'.length),
  };
  const pad = (s: string, n: number): string => s.padEnd(n);
  const header = [
    pad('id', widths.id),
    pad('app', widths.app),
    pad('role', widths.role),
    pad('path', widths.path),
    pad('modals', widths.modals),
    pad('states', widths.states),
    pad('requiresEntity', widths.requiresEntity),
  ].join('  ');
  const sep = '-'.repeat(header.length);
  process.stdout.write(`${header}\n${sep}\n`);
  for (const r of rows) {
    process.stdout.write(
      [
        pad(r.id, widths.id),
        pad(r.app, widths.app),
        pad(r.role, widths.role),
        pad(r.path, widths.path),
        pad(String(r.modals), widths.modals),
        pad(String(r.states), widths.states),
        pad(r.requiresEntity, widths.requiresEntity),
      ].join('  ') + '\n',
    );
  }
  process.stdout.write(`${sep}\n`);
  process.stdout.write(
    `total routes: ${ROUTES.length} · web: ${ROUTES.filter(r => r.app === 'web').length} · landing: ${ROUTES.filter(r => r.app === 'landing').length} · cms: ${ROUTES.filter(r => r.app === 'cms').length}\n`,
  );
  const totalModals = ROUTES.reduce((acc, r) => acc + (r.modals?.length ?? 0), 0);
  process.stdout.write(`total modal surfaces: ${totalModals}\n`);
}

// Only emit the table when called via `tsx routes.ts --print`. Avoids
// printing whenever `walk.ts` imports the module.
if (process.argv[1] && process.argv[1].endsWith('routes.ts') && process.argv.includes('--print')) {
  printRegistry();
}
