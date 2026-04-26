import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context.js';
import { observabilityMiddleware } from './middleware/observability.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure.use(t.middleware(observabilityMiddleware));
export const createCallerFactory = t.createCallerFactory;
export { t };
