import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context.js";
import { observabilityMiddleware } from "./middleware/observability.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
// biome-ignore lint/suspicious/noExplicitAny: middleware is defined as a plain function to avoid circular imports; its shape matches at runtime but cannot satisfy tRPC's internal MiddlewareFunction generic without importing t from this file
export const publicProcedure = t.procedure.use(t.middleware(observabilityMiddleware as any));
export const createCallerFactory = t.createCallerFactory;
export { t };
