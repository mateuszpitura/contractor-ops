// Barrel for routers/core/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { adminBoeRateRouter } from './admin-boe-rate';
export { apiKeyRouter } from './api-key';
export { approvalRouter } from './approval';
export { auditRouter } from './audit';
export { authPermissionsRouter } from './auth-permissions';
export { calendarRouter } from './calendar';
export { contractRouter } from './contract';
export { contractorRouter } from './contractor';
export { costCenterRouter } from './cost-center';
export { dashboardRouter } from './dashboard';
export { docsRouter } from './docs';
export { documentRouter } from './document';
export { einvoiceRouter } from './einvoice';
export { employeeRouter } from './employee';
export { esignRouter } from './esign';
export { featureFlagsRouter } from './feature-flags';
export { importRouter } from './import';
export { integrationRouter } from './integration';
export { legalRouter } from './legal';
export { leitwegIdRouter } from './leitweg-id';
export { notificationRouter } from './notification';
export { ocrRouter } from './ocr';
export { onboardingImportRouter } from './onboarding-import';
export { organizationRouter } from './organization';
export { projectRouter } from './project';
export { reminderRouter } from './reminder';
export { reportRouter } from './report';
export { searchRouter } from './search';
export { settingsRouter } from './settings';
export { taxRouter } from './tax';
export { taxFormRouter } from './tax-form-router';
export { teamRouter } from './team';
export { timeRouter } from './time';
export { userRouter } from './user';
export { webhookSubscriptionRouter } from './webhook-subscription';
export { workerRouter } from './worker';
