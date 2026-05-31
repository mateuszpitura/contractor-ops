// Barrel for routers/integrations/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { deprovisioningRouter } from './deprovisioning';
export { entraRouter } from './entra';
export { githubRouter } from './github';
export { googleWorkspaceRouter } from './google-workspace';
export { jiraRouter } from './jira';
export { ksefRouter } from './ksef';
export { linearRouter } from './linear';
export { oktaRouter } from './okta';
export { peppolRouter } from './peppol';
export { teamsRouter } from './teams';
