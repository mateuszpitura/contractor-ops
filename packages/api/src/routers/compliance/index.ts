// Barrel for routers/compliance/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { classificationRouter } from './classification';
export { classificationDashboardRouter } from './classification-dashboard';
export { classificationDocumentRouter } from './classification-document';
export { complianceAdminRouter } from './compliance-admin';
export { consentRouter } from './consent';
export { economicDependencyAlertRouter } from './economic-dependency-alert';
export { gdprRouter } from './gdpr';
export { ir35ChainRouter } from './ir35-chain';
export { ir35AttestationRouter } from './ir35-other-client-attestation';
export { reassessmentTriggerRouter } from './reassessment-trigger';
export { statusfeststellungsverfahrenRouter } from './statusfeststellungsverfahren';
export { zatcaRouter } from './zatca';
