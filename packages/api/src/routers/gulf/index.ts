// Barrel for routers/gulf/ — Phase 79 F3 Gulf namespace.
//
// Exposes a single `gulfRouter` mounted at `gulf:` in root.ts appRouter, grouping
// the free-zone assignment CRUD + per-engagement Saudi fields (free-zone.ts) and
// the Saudization config/headcount CRUD + dashboard + GULF-10 drift overrides
// (saudization.ts). Mirrors the finance/index.ts barrel shape.

import { router } from '../../init';
import { freeZoneRouter } from './free-zone';
import { saudizationRouter } from './saudization';

export const gulfRouter = router({
  freeZone: freeZoneRouter,
  saudization: saudizationRouter,
});
