import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context.js";
import { observabilityMiddleware } from "./middleware/observability.js";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- handler shape matches at runtime; typed loosely to avoid circular import of tRPC internals
export const publicProcedure = t.procedure.use(
  t.middleware(observabilityMiddleware as any),
);
export const createCallerFactory = t.createCallerFactory;
export { t };
