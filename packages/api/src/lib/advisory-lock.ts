// ---------------------------------------------------------------------------
// Postgres advisory-lock helpers
// ---------------------------------------------------------------------------
// All advisory locks across the codebase share Postgres' single 64-bit
// keyspace. Hashing every lock key with `hashtext` into the one-arg form
// `pg_advisory_xact_lock(int8)` works, but it has two operational drawbacks:
//
//   1. Cross-subsystem collisions are possible (cron + per-org + payment-run
//      all hash into the same 32-bit space; ~1.2% collision probability for
//      100k orgs).
//   2. `pg_locks` rows show only an opaque integer — operators can't tell
//      which subsystem holds the lock without grepping the codebase for the
//      hashed key.
//
// Postgres exposes a two-arg form `pg_advisory_xact_lock(int4 class_id,
// int4 obj_id)` that cleanly partitions the keyspace by class. We use the
// `class_id` as a stable subsystem namespace and feed `hashtext(key)` into
// the `obj_id` arg — collisions are now namespace-local (e.g. two orgs with
// hash-colliding ids would still serialize, which is correct), and `pg_locks`
// rows show the namespace explicitly via classid.
//
// To add a namespace: extend `LockNamespace` and `NAMESPACE_CLASS_IDS`. The
// class_id values are part of the operational contract — never reuse a
// retired id, only append.
// ---------------------------------------------------------------------------

/**
 * Subsystem namespaces for advisory locks. Each maps to a fixed integer
 * `class_id` passed as the first arg to the two-arg `pg_advisory_xact_lock`.
 *
 * - `cron`    — scheduler tick locks (reminders, trial-notifications, ...)
 * - `org`     — per-organization serialization (ZATCA hash chain, ...)
 * - `payment` — payment-run number allocation
 * - `sync`    — integration sync orchestrators (KSeF, Google Workspace, ...)
 */
export type LockNamespace = 'cron' | 'org' | 'payment' | 'sync';

/**
 * Stable class_id mapping. Values are persisted in `pg_locks` rows during
 * runtime, so:
 *   - Never change an existing value (operational ABI).
 *   - Never reuse a retired value.
 *   - Append-only.
 */
const NAMESPACE_CLASS_IDS: Record<LockNamespace, number> = {
  cron: 1,
  org: 2,
  payment: 3,
  sync: 4,
};

type RawPrismaLike = {
  $queryRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
  $executeRawUnsafe: (query: string, ...args: unknown[]) => Promise<unknown>;
};

function classIdFor(namespace: LockNamespace): number {
  // Defensive: the type system already constrains this, but a missing entry
  // would be a silent footgun if `LockNamespace` ever drifts from the map.
  const id = NAMESPACE_CLASS_IDS[namespace];
  if (id === undefined) {
    throw new Error(`advisory-lock: unknown namespace "${namespace}"`);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Transition shim — single-arg → two-arg advisory lock migration
// ---------------------------------------------------------------------------
//
// The single-arg `pg_advisory_xact_lock(hashtext(string))` and two-arg
// `pg_advisory_xact_lock(classId, hashtext(key))` forms occupy DISTINCT lock
// spaces in Postgres — pre-refactor holders cannot serialize against
// post-refactor callers. During a rolling deploy this opens a brief window
// where both believe they own "the" lock for the same logical resource.
//
// While the env var `ADVISORY_LOCK_TRANSITION_DUAL_HOLD=true` is set, every
// helper acquires BOTH the legacy single-arg lock (using the pre-refactor
// hashtext key) AND the new two-arg lock. This makes post-deploy callers
// serialize against pre-deploy holders.
//
// REMOVAL: drop this shim + env var after one full deploy cycle (typically
// 24-48h post-rollout) once every pre-refactor process has rotated out.
// Tracked by the `TODO(advisory-lock-transition)` annotations below.
// ---------------------------------------------------------------------------

const TRANSITION_DUAL_HOLD = process.env.ADVISORY_LOCK_TRANSITION_DUAL_HOLD === 'true';

/**
 * Reconstructs the pre-refactor single-arg `hashtext()` key for a callsite.
 * The mapping is derived from the keys used in commit ce8b26f4^ — never
 * change these without auditing every prior callsite. Only consulted when
 * `TRANSITION_DUAL_HOLD` is on.
 */
function legacyKeyFor(namespace: LockNamespace, key: string): string {
  switch (namespace) {
    case 'cron':
      // pre-refactor: const REMINDERS_LOCK_KEY = 'cron:reminders'
      return `cron:${key}`;
    case 'payment':
      // pre-refactor: `payment-run:${ctx.organizationId}`
      return `payment-run:${key}`;
    case 'org':
    case 'sync':
      // pre-refactor passed the raw key (e.g. organizationId, 'ksef:<id>',
      // 'google-workspace:<id>') without an extra prefix.
      return key;
  }
}

// ---------------------------------------------------------------------------
// Session-level locks (held until the connection ends or explicitly released)
// ---------------------------------------------------------------------------

/**
 * Tries to acquire a session-level advisory lock for the given namespaced key.
 * Returns true when the lock is acquired, false when another session holds it.
 *
 * Caller MUST pair every successful acquisition with `releaseAdvisoryLock` —
 * session-level locks are NOT released on transaction commit.
 */
export async function tryAcquireAdvisoryLock(
  db: RawPrismaLike,
  namespace: LockNamespace,
  key: string,
): Promise<boolean> {
  const classId = classIdFor(namespace);

  // TODO(advisory-lock-transition): remove this block after one deploy cycle.
  if (TRANSITION_DUAL_HOLD) {
    const legacyKey = legacyKeyFor(namespace, key);
    // safe-raw-sql: pg_try_advisory_lock is a Postgres session primitive; transition shim mirrors legacy single-arg form to serialize with pre-refactor holders.
    const legacyRows = (await db.$queryRawUnsafe(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
      legacyKey,
    )) as Array<{ acquired?: boolean }>;
    if (!legacyRows?.[0]?.acquired) return false;
    // safe-raw-sql: same as above, this is the new two-arg form post-transition.
    const newRows = (await db.$queryRawUnsafe(
      'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
      classId,
      key,
    )) as Array<{ acquired?: boolean }>;
    if (!newRows?.[0]?.acquired) {
      // Release the legacy lock we just took so we don't leak it for the
      // session lifetime.
      await db.$executeRawUnsafe('SELECT pg_advisory_unlock(hashtext($1))', legacyKey);
      return false;
    }
    return true;
  }

  // safe-raw-sql: pg_try_advisory_lock is a Postgres session primitive with no tenant column; namespacing is encoded in classId/key.
  const rows = (await db.$queryRawUnsafe(
    'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired',
    classId,
    key,
  )) as Array<{ acquired?: boolean }>;

  return Boolean(rows?.[0]?.acquired);
}

/** Releases a session-level advisory lock for the given namespaced key (best-effort). */
export async function releaseAdvisoryLock(
  db: RawPrismaLike,
  namespace: LockNamespace,
  key: string,
): Promise<void> {
  const classId = classIdFor(namespace);

  // TODO(advisory-lock-transition): remove this block after one deploy cycle.
  if (TRANSITION_DUAL_HOLD) {
    const legacyKey = legacyKeyFor(namespace, key);
    // Release in reverse order. Errors are best-effort per the helper contract.
    await db.$executeRawUnsafe('SELECT pg_advisory_unlock($1, hashtext($2))', classId, key);
    await db.$executeRawUnsafe('SELECT pg_advisory_unlock(hashtext($1))', legacyKey);
    return;
  }

  await db.$executeRawUnsafe('SELECT pg_advisory_unlock($1, hashtext($2))', classId, key);
}

// ---------------------------------------------------------------------------
// Transaction-scoped locks (auto-released on commit/rollback)
// ---------------------------------------------------------------------------

/**
 * Acquires a transaction-scoped advisory lock, blocking until available.
 *
 * Released automatically on COMMIT or ROLLBACK — caller must invoke this
 * inside an interactive `$transaction(...)` callback.
 */
export async function acquireXactLock(
  tx: RawPrismaLike,
  namespace: LockNamespace,
  key: string,
): Promise<void> {
  const classId = classIdFor(namespace);

  // TODO(advisory-lock-transition): remove this block after one deploy cycle.
  // Both locks auto-release on commit/rollback — order matters: legacy first
  // so pre-refactor holders block us, then new so post-refactor peers do.
  if (TRANSITION_DUAL_HOLD) {
    const legacyKey = legacyKeyFor(namespace, key);
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', legacyKey);
  }

  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1, hashtext($2))', classId, key);
}

/**
 * Tries to acquire a transaction-scoped advisory lock without blocking.
 * Returns true when acquired, false when another transaction holds it.
 *
 * Released automatically on COMMIT or ROLLBACK — caller must invoke this
 * inside an interactive `$transaction(...)` callback.
 */
export async function tryAcquireXactLock(
  tx: RawPrismaLike,
  namespace: LockNamespace,
  key: string,
): Promise<boolean> {
  const classId = classIdFor(namespace);

  // TODO(advisory-lock-transition): remove this block after one deploy cycle.
  // If we acquire only the legacy lock but fail on the new one, the legacy
  // lock auto-releases on tx commit/rollback — no manual unlock needed.
  if (TRANSITION_DUAL_HOLD) {
    const legacyKey = legacyKeyFor(namespace, key);
    // safe-raw-sql: pg_try_advisory_xact_lock is a Postgres tx-scoped primitive; transition shim mirrors legacy single-arg form to serialize with pre-refactor holders.
    const legacyRows = (await tx.$queryRawUnsafe(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired',
      legacyKey,
    )) as Array<{ acquired?: boolean }>;
    if (!legacyRows?.[0]?.acquired) return false;
  }

  // safe-raw-sql: pg_try_advisory_xact_lock is a Postgres tx-scoped primitive with no tenant column; namespacing is encoded in classId/key.
  const rows = (await tx.$queryRawUnsafe(
    'SELECT pg_try_advisory_xact_lock($1, hashtext($2)) AS acquired',
    classId,
    key,
  )) as Array<{ acquired?: boolean }>;

  return Boolean(rows?.[0]?.acquired);
}
