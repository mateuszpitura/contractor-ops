/**
 * tRPC context created from incoming request headers.
 * The headers are used by Better Auth to validate sessions.
 */

import type { Session } from "@contractor-ops/auth";
import { auth } from "@contractor-ops/auth";

export type ApiContext = {
  headers: Headers;
  session: Session | null;
  user: Session["user"] | null;
};

export async function createContext(opts: { headers: Headers }): Promise<ApiContext> {
  const session = await auth.api.getSession({ headers: opts.headers });

  return {
    headers: opts.headers,
    session: session ?? null,
    user: session?.user ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
