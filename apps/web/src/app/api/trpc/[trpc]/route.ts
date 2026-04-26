import { appRouter, createContext } from '@contractor-ops/api';
import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

const log = createLogger({ service: 'http' });

const handler = async (req: Request) => {
  const start = performance.now();
  const url = new URL(req.url);
  const method = req.method;
  const pathname = decodeURIComponent(url.pathname);
  const procedure = pathname.replace('/api/trpc/', '');
  const search = decodeURIComponent(url.search);

  log.info({ method, url: `${pathname}${search}`, procedure }, `→ ${method} ${pathname}${search}`);

  const res = await Sentry.withIsolationScope(() =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: () => createContext({ headers: req.headers }),
      onError({ error, path: procedurePath }) {
        Sentry.captureException(error, {
          tags: { 'trpc.path': procedurePath },
        });
      },
    }),
  );

  const durationMs = Math.round(performance.now() - start);
  const status = res.status;

  log.info(
    { method, url: `${pathname}${search}`, procedure, status, durationMs },
    `← ${method} ${pathname} ${status} ${durationMs}ms`,
  );

  return res;
};

export { handler as GET, handler as POST };
