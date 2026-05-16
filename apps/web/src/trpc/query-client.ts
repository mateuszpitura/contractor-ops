import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Intercepts TIER_REQUIRED errors from requireTier middleware and shows
 * an upgrade toast instead of a generic error. Per D-04.
 *
 * tRPC FORBIDDEN errors carry the structured payload as
 * JSON.stringify({ type, requiredTier, currentTier }) in error.message.
 */
function handleTierError(error: unknown): boolean {
  const trpcErr = error as
    | {
        message?: string;
        data?: { code?: string };
      }
    | undefined;

  if (trpcErr?.data?.code !== 'FORBIDDEN' || !trpcErr.message) return false;

  try {
    const parsed = JSON.parse(trpcErr.message) as {
      type?: string;
      requiredTier?: string;
    };
    if (parsed.type === 'TIER_REQUIRED' && parsed.requiredTier) {
      const tierLabel = parsed.requiredTier === 'ENTERPRISE' ? 'Enterprise' : 'Pro';
      toast.error(`This feature requires ${tierLabel} plan.`, {
        action: {
          label: 'Upgrade',
          onClick: () => {
            window.location.href = '/settings?tab=billing';
          },
        },
      });
      return true;
    }
    // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
  } catch {
    // Not a tier error JSON, fall through
  }
  return false;
}

/**
 * Determines whether a failed query/mutation should be retried.
 * Retries network errors and 5xx responses up to 2 times.
 * Does not retry 4xx errors (auth, validation, not found).
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  // tRPC errors carry a `data?.httpStatus` or `data?.code`
  const trpcError = error as { data?: { httpStatus?: number; code?: string } } | undefined;
  const httpStatus = trpcError?.data?.httpStatus;

  // Don't retry client errors (4xx)
  if (httpStatus && httpStatus >= 400 && httpStatus < 500) return false;

  // Don't retry auth/permission errors by tRPC code
  const code = trpcError?.data?.code;
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN' || code === 'NOT_FOUND') return false;

  // Retry everything else (network errors, 5xx, timeouts)
  return true;
}

/**
 * Creates a QueryClient with default options optimized for SSR.
 *
 * - staleTime of 30s prevents refetching on the client immediately after SSR prefetch.
 * - retry: retries network/5xx errors up to 2 times with exponential backoff.
 * - retryDelay: 1s, 3s (exponential with 1s base, capped at 30s).
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: shouldRetry,
        retryDelay: attemptIndex => Math.min(1000 * 3 ** attemptIndex, 30_000),
      },
      mutations: {
        retry: shouldRetry,
        retryDelay: attemptIndex => Math.min(1000 * 3 ** attemptIndex, 30_000),
        onError: error => {
          handleTierError(error);
        },
      },
    },
  });
}
