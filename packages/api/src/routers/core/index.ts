// Barrel for routers/core/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { adminBoeRateRouter } from './admin-boe-rate.js';
export { apiKeyRouter } from './api-key.js';
export { approvalRouter } from './approval.js';
export { auditRouter } from './audit.js';
export { authPermissionsRouter } from './auth-permissions.js';
export { calendarRouter } from './calendar.js';
export { contractRouter } from './contract.js';
export { contractorRouter } from './contractor.js';
export { dashboardRouter } from './dashboard.js';
export { docsRouter } from './docs.js';
export { documentRouter } from './document.js';
export { einvoiceRouter } from './einvoice.js';
export { esignRouter } from './esign.js';
export { featureFlagsRouter } from './feature-flags.js';
export { importRouter } from './import.js';
export { integrationRouter } from './integration.js';
export { legalRouter } from './legal.js';
export { leitwegIdRouter } from './leitweg-id.js';
export { notificationRouter } from './notification.js';
export { ocrRouter } from './ocr.js';
export { onboardingImportRouter } from './onboarding-import.js';
export { organizationRouter } from './organization.js';
export { reminderRouter } from './reminder.js';
export { reportRouter } from './report.js';
export { searchRouter } from './search.js';
export { settingsRouter } from './settings.js';
export { taxRouter } from './tax.js';
export { timeRouter } from './time.js';
export { userRouter } from './user.js';
