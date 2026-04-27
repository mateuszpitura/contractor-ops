// Barrel for routers/equipment/ — re-exports the *Router constants for `root.ts`.
// Intra-folder helpers (types, constants, shared utilities) are imported directly
// via relative paths (e.g. `./equipment-shared.js`), not through this barrel.

export { equipmentRouter } from './equipment.js';
export { equipmentCouriersRouter } from './equipment-couriers.js';
export { equipmentReturnsRouter } from './equipment-returns.js';
export { equipmentShipmentsRouter } from './equipment-shipments.js';
