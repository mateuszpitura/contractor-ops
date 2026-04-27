// Barrel for routers/portal/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { portalRouter } from './portal.js';
export { portalTimeRouter } from './portal-time.js';
