import { TRPCError } from "@trpc/server";
import { t } from "../init.js";

/**
 * In-memory sliding window rate limiter for file uploads.
 *
 * Limits uploads to 10 per minute per user to prevent abuse.
 *
 * LIMITATION: Uses in-memory tracking — counts are NOT shared across
 * multiple server instances. In a horizontally-scaled deployment each
 * instance maintains its own window, so the effective limit is
 * MAX_UPLOADS * instanceCount per user.
 *
 * TODO: For distributed deployment, migrate to Redis-backed rate limiting
 * using @upstash/redis (already available in packages/api) with a sorted-set
 * sliding window, similar to the Upstash Ratelimit used in apps/web middleware.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_UPLOADS = 10;
const MAX_MAP_ENTRIES = 10_000; // Cap to prevent unbounded memory growth

const uploadCounts = new Map<string, { timestamps: number[] }>();

// Periodic cleanup of expired entries
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of uploadCounts) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);
      if (entry.timestamps.length === 0) uploadCounts.delete(key);
    }
  };
  setInterval(cleanup, 5 * 60_000).unref?.();
}

function checkUploadLimit(userId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = uploadCounts.get(userId) ?? { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (entry.timestamps.length >= MAX_UPLOADS) {
    return { allowed: false, remaining: 0 };
  }

  // Evict oldest entries when map exceeds cap to prevent unbounded growth
  if (!uploadCounts.has(userId) && uploadCounts.size >= MAX_MAP_ENTRIES) {
    const oldest = uploadCounts.keys().next().value;
    if (oldest) uploadCounts.delete(oldest);
  }

  entry.timestamps.push(now);
  uploadCounts.set(userId, entry);
  return { allowed: true, remaining: MAX_UPLOADS - entry.timestamps.length };
}

/**
 * tRPC middleware that rate-limits file upload requests per user.
 * Apply to `requestUpload` and `uploadNewVersion` mutations.
 */
export const uploadRateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const userId = (ctx as { user?: { id: string } }).user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const { allowed, remaining } = checkUploadLimit(userId);

  if (!allowed) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Upload rate limit exceeded. Maximum ${MAX_UPLOADS} uploads per minute. Try again shortly.`,
    });
  }

  return next({
    ctx: {
      ...ctx,
      uploadRateLimit: { remaining },
    },
  });
});
