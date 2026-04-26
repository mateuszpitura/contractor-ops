type RawPrismaLike = {
  $queryRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
  $executeRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
};

/**
 * Tries to acquire a session-level advisory lock for the given key.
 * Returns true when the lock is acquired, false when another session holds it.
 */
export async function tryAcquireAdvisoryLock(db: RawPrismaLike, key: string): Promise<boolean> {
  const rows = (await db.$queryRawUnsafe(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
    key,
  )) as Array<{ acquired?: boolean }>;

  return Boolean(rows?.[0]?.acquired);
}

/** Releases a session-level advisory lock for the given key (best-effort). */
export async function releaseAdvisoryLock(db: RawPrismaLike, key: string): Promise<void> {
  await db.$executeRawUnsafe('SELECT pg_advisory_unlock(hashtext($1))', key);
}
