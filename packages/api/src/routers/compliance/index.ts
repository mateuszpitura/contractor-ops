// Barrel for routers/compliance/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { classificationRouter } from './classification.js';
export { classificationDashboardRouter } from './classification-dashboard.js';
export { classificationDocumentRouter } from './classification-document.js';
export { consentRouter } from './consent.js';
export { economicDependencyAlertRouter } from './economic-dependency-alert.js';
export { gdprRouter } from './gdpr.js';
export { ir35ChainRouter } from './ir35-chain.js';
export { ir35AttestationRouter } from './ir35-other-client-attestation.js';
export { reassessmentTriggerRouter } from './reassessment-trigger.js';
export { statusfeststellungsverfahrenRouter } from './statusfeststellungsverfahren.js';
export { zatcaRouter } from './zatca.js';
