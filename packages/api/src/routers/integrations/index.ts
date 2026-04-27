// Barrel for routers/integrations/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { googleWorkspaceRouter } from './google-workspace.js';
export { jiraRouter } from './jira.js';
export { ksefRouter } from './ksef.js';
export { linearRouter } from './linear.js';
export { peppolRouter } from './peppol.js';
export { teamsRouter } from './teams.js';
