/**
 * tRPC context created from incoming request headers.
 * The headers are used by Better Auth to validate sessions.
 */
export function createContext(opts: { headers: Headers }) {
  return { headers: opts.headers };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
