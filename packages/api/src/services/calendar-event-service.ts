import type { Prisma, PrismaClient } from '@contractor-ops/db';
import type { CalendarProviderId } from '@contractor-ops/integrations';
import {
  getCalendarEventAdapter,
  getCalendarProviderMeta,
  isCalendarProviderId,
} from '@contractor-ops/integrations';
import { pLimit } from '@contractor-ops/integrations/services/concurrency';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { deriveIdempotencyKey } from '@contractor-ops/integrations/services/idempotency';
import { createLogger } from '@contractor-ops/logger';
import type { CalendarEventMetadata } from '@contractor-ops/validators';
import type { CalendarPrismaClient } from './types';

const log = createLogger({ service: 'calendar-event-service' });

// ---------------------------------------------------------------------------
// Bound calendar provider fan-out
// ---------------------------------------------------------------------------
//
// `createCalendarEvent` / `updateCalendarEvent` / `deleteCalendarEvent` fan
// out across every connected calendar (dual-push across all connections). For an org with
// many contractors and several calendar connections per user, an unbounded
// `Promise.all` can saturate Google/Microsoft's per-process socket pool and
// the Prisma pool simultaneously (the per-provider resilience layer already
// caps concurrency at the *adapter* level, but this is the per-request fan
// out cap that protects bulk-call flows like "schedule contractor onboarding
// across the team").
//
// 10 concurrent provider calls is well under Google Calendar's 600 req/min
// quota and Microsoft Graph's 10k req per 10min throttle while still letting
// a request with dozens of connections complete in under a second.
const CALENDAR_FANOUT_CONCURRENCY = 10;
const calendarLimit = pLimit(CALENDAR_FANOUT_CONCURRENCY);

/** Union calendar clients are not a single callable delegate; narrow for model access. */
function calendarOrm(prisma: CalendarPrismaClient): PrismaClient {
  return prisma as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CALENDAR_PROVIDERS = ['GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR'] as const;
const EXTERNAL_TYPE_MAP = {
  GOOGLE_CALENDAR: 'GOOGLE_CALENDAR_EVENT',
  OUTLOOK_CALENDAR: 'OUTLOOK_CALENDAR_EVENT',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarConnection {
  id: string;
  provider: CalendarProviderId;
  accessToken: string;
  organizationId: string;
}

interface CreateCalendarEventInput {
  organizationId: string;
  userId?: string;
  entityType: string;
  entityId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
}

interface UpdateCalendarEventInput {
  organizationId: string;
  entityType: string;
  entityId: string;
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
}

interface DeleteCalendarEventInput {
  organizationId: string;
  entityType: string;
  entityId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Finds all CONNECTED calendar connections for the given organization.
 * Returns both personal connections (userId = given userId) and
 * org-level connections (userId = null) for dual-push coverage.
 */
async function findCalendarConnections(
  prisma: CalendarPrismaClient,
  organizationId: string,
  userId?: string,
): Promise<CalendarConnection[]> {
  const db = calendarOrm(prisma);
  const connections = await db.integrationConnection.findMany({
    where: {
      organizationId,
      provider: { in: [...CALENDAR_PROVIDERS] },
      status: 'CONNECTED',
      ...(userId
        ? {
            OR: [{ userId }, { userId: null }],
          }
        : { userId: null }),
    },
    select: {
      id: true,
      provider: true,
      credentialsRef: true,
      organizationId: true,
    },
  });

  return connections.flatMap(
    (conn: { id: string; provider: string; credentialsRef: string; organizationId: string }) => {
      if (!isCalendarProviderId(conn.provider)) return [];
      const meta = getCalendarProviderMeta(conn.provider);
      const credentials = decryptCredentials(conn.credentialsRef, meta.credentialSlug);

      return [
        {
          id: conn.id,
          provider: conn.provider,
          accessToken: credentials.accessToken,
          organizationId: conn.organizationId,
        },
      ];
    },
  );
}

// ---------------------------------------------------------------------------
// Calendar Event CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a calendar event on all connected calendars (dual-push across all connections).
 *
 * For each calendar connection, creates the event via the provider API
 * and stores an ExternalLink with cached metadata.
 *
 * Uses fire-and-forget pattern: logs errors but does not throw,
 * so calendar failures never block business mutations.
 */
export async function createCalendarEvent(
  prisma: CalendarPrismaClient,
  input: CreateCalendarEventInput,
): Promise<void> {
  try {
    const connections = await findCalendarConnections(prisma, input.organizationId, input.userId);

    if (connections.length === 0) return;

    const results = await Promise.allSettled(
      connections.map(conn => calendarLimit(() => createEventForConnection(prisma, conn, input))),
    );

    logRejected(results, 'create');
    // safe-swallow: per-connection failures already logged by logRejected; calendar sync is fire-and-forget and must not block the business mutation
  } catch (_error) {
    /* fire-and-forget */
  }
}

async function createEventForConnection(
  prisma: CalendarPrismaClient,
  conn: CalendarConnection,
  input: CreateCalendarEventInput,
): Promise<void> {
  const externalType = EXTERNAL_TYPE_MAP[conn.provider];
  const { eventId, url, metadata } = await createProviderEvent(conn, input);

  const db = calendarOrm(prisma);
  await db.externalLink.create({
    data: {
      organizationId: input.organizationId,
      integrationConnectionId: conn.id,
      entityType: input.entityType as Prisma.ExternalLinkCreateInput['entityType'],
      entityId: input.entityId,
      externalType,
      externalId: eventId,
      externalUrl: url,
      metadataJson: metadata,
    },
  });
}

async function createProviderEvent(
  conn: CalendarConnection,
  input: CreateCalendarEventInput,
): Promise<{ eventId: string; url: string; metadata: CalendarEventMetadata }> {
  // DRIFT-01: server-derived idempotency key for the create-event call.
  // Composing on `(connectionId, entityType, entityId)` means a retried
  // dual-push for the same business entity onto the same calendar
  // connection collapses to one provider event. Google rejects the
  // duplicate insert with 409 (its `event.id` is set from this key);
  // Microsoft Graph correlates via `client-request-id`. Each adapter
  // owns the wire encoding — the service supplies the canonical key.
  const meta = getCalendarProviderMeta(conn.provider);
  const idempotencyKey = deriveIdempotencyKey({
    orgId: input.organizationId,
    operation: meta.idempotencyOperationCreate,
    businessKey: `${conn.id}:${input.entityType}:${input.entityId}`,
  });

  if (conn.provider === 'GOOGLE_CALENDAR') {
    const adapter = getCalendarEventAdapter('GOOGLE_CALENDAR');
    const result = await adapter.createEvent(
      conn.accessToken,
      {
        summary: input.summary,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
        attendees: input.attendees,
      },
      idempotencyKey,
    );

    return {
      eventId: result.eventId,
      url: result.htmlLink,
      metadata: {
        eventId: result.eventId,
        title: input.summary,
        startTime: input.startDateTime,
        endTime: input.endDateTime,
        link: result.htmlLink,
        etag: result.etag,
        provider: meta.metadataProvider,
      },
    };
  }

  const outlookAdapter = getCalendarEventAdapter('OUTLOOK_CALENDAR');
  const result = await outlookAdapter.createEvent(
    conn.accessToken,
    {
      subject: input.summary,
      bodyHtml: input.description,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      attendees: input.attendees,
    },
    idempotencyKey,
  );

  return {
    eventId: result.eventId,
    url: result.webLink,
    metadata: {
      eventId: result.eventId,
      title: input.summary,
      startTime: input.startDateTime,
      endTime: input.endDateTime,
      link: result.webLink,
      provider: meta.metadataProvider,
    },
  };
}

/**
 * Updates calendar events on all connected calendars for a given entity.
 *
 * Finds existing ExternalLinks for the entity and updates the corresponding
 * events via provider APIs. Uses fire-and-forget pattern.
 */
export async function updateCalendarEvent(
  prisma: CalendarPrismaClient,
  input: UpdateCalendarEventInput,
): Promise<void> {
  try {
    const externalLinks = await findCalendarExternalLinks(prisma, input);
    if (externalLinks.length === 0) return;

    const results = await Promise.allSettled(
      externalLinks.map(link => calendarLimit(() => updateEventForLink(prisma, link, input))),
    );

    logRejected(results, 'update');
    // safe-swallow: per-link failures already logged by logRejected; calendar sync is fire-and-forget and must not block the business mutation
  } catch (_error) {
    /* fire-and-forget */
  }
}

/**
 * Deletes all calendar events for a given entity from all connected calendars.
 *
 * Removes provider-side events and corresponding ExternalLink records.
 * Uses fire-and-forget pattern.
 */
export async function deleteCalendarEvent(
  prisma: CalendarPrismaClient,
  input: DeleteCalendarEventInput,
): Promise<void> {
  try {
    const externalLinks = await findCalendarExternalLinks(prisma, input);
    if (externalLinks.length === 0) return;

    const results = await Promise.allSettled(
      externalLinks.map(link => calendarLimit(() => deleteEventForLink(prisma, link))),
    );

    logRejected(results, 'delete');
    // safe-swallow: per-link failures already logged by logRejected; calendar sync is fire-and-forget and must not block the business mutation
  } catch (_error) {
    /* fire-and-forget */
  }
}

// ---------------------------------------------------------------------------
// Internal: shared query for calendar external links
// ---------------------------------------------------------------------------

interface CalendarExternalLink {
  id: string;
  externalId: string;
  externalType: string;
  metadataJson: Record<string, unknown> | null;
  integrationConnection: {
    id: string;
    provider: string;
    credentialsRef: string;
    status: string;
  };
}

async function findCalendarExternalLinks(
  prisma: CalendarPrismaClient,
  input: { organizationId: string; entityType: string; entityId: string },
): Promise<CalendarExternalLink[]> {
  const db = calendarOrm(prisma);
  const links = await db.externalLink.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: input.entityType as Prisma.ExternalLinkWhereInput['entityType'],
      entityId: input.entityId,
      externalType: { in: ['GOOGLE_CALENDAR_EVENT', 'OUTLOOK_CALENDAR_EVENT'] },
    },
    include: {
      integrationConnection: {
        select: { id: true, provider: true, credentialsRef: true, status: true },
      },
    },
  });
  return links as unknown as CalendarExternalLink[];
}

// ---------------------------------------------------------------------------
// Internal: per-link update
// ---------------------------------------------------------------------------

async function updateEventForLink(
  prisma: CalendarPrismaClient,
  link: CalendarExternalLink,
  input: UpdateCalendarEventInput,
): Promise<void> {
  const conn = link.integrationConnection;
  if (conn.status !== 'CONNECTED') return;

  if (!isCalendarProviderId(conn.provider)) return;

  const meta = getCalendarProviderMeta(conn.provider);
  const credentials = decryptCredentials(conn.credentialsRef, meta.credentialSlug);
  const existingMetadata =
    (link.metadataJson as CalendarEventMetadata) ?? ({} as CalendarEventMetadata);

  const fieldOverrides = {
    ...(input.summary ? { title: input.summary } : {}),
    ...(input.startDateTime ? { startTime: input.startDateTime } : {}),
    ...(input.endDateTime ? { endTime: input.endDateTime } : {}),
  };

  const db = calendarOrm(prisma);
  if (conn.provider === 'GOOGLE_CALENDAR') {
    const adapter = getCalendarEventAdapter('GOOGLE_CALENDAR');
    const etag = existingMetadata.etag ?? '';
    const result = await adapter.updateEvent(
      credentials.accessToken,
      link.externalId,
      {
        summary: input.summary,
        description: input.description,
        startDateTime: input.startDateTime,
        endDateTime: input.endDateTime,
      },
      etag,
    );

    await db.externalLink.update({
      where: { id: link.id },
      data: {
        externalUrl: result.htmlLink,
        metadataJson: {
          ...existingMetadata,
          ...fieldOverrides,
          etag: result.etag,
          link: result.htmlLink,
          provider: meta.metadataProvider,
        },
      },
    });
  } else {
    const outlookAdapter = getCalendarEventAdapter('OUTLOOK_CALENDAR');
    const result = await outlookAdapter.updateEvent(credentials.accessToken, link.externalId, {
      subject: input.summary,
      bodyHtml: input.description,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
    });

    await db.externalLink.update({
      where: { id: link.id },
      data: {
        externalUrl: result.webLink,
        metadataJson: {
          ...existingMetadata,
          ...fieldOverrides,
          link: result.webLink,
          provider: meta.metadataProvider,
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Internal: per-link delete
// ---------------------------------------------------------------------------

async function deleteEventForLink(
  prisma: CalendarPrismaClient,
  link: CalendarExternalLink,
): Promise<void> {
  const conn = link.integrationConnection;

  // Attempt deletion even if disconnected -- best effort
  try {
    if (conn.status === 'CONNECTED' && isCalendarProviderId(conn.provider)) {
      const meta = getCalendarProviderMeta(conn.provider);
      const credentials = decryptCredentials(conn.credentialsRef, meta.credentialSlug);
      if (conn.provider === 'GOOGLE_CALENDAR') {
        await getCalendarEventAdapter('GOOGLE_CALENDAR').deleteEvent(
          credentials.accessToken,
          link.externalId,
        );
      } else {
        await getCalendarEventAdapter('OUTLOOK_CALENDAR').deleteEvent(
          credentials.accessToken,
          link.externalId,
        );
      }
    }
    // safe-swallow: provider-side delete is best-effort (event may already be gone); the ExternalLink is removed below regardless
  } catch (_deleteError) {
    // fire-and-forget
  }

  // Always clean up the ExternalLink
  const db = calendarOrm(prisma);
  await db.externalLink.delete({
    where: { id: link.id },
  });
}

// ---------------------------------------------------------------------------
// Internal: observability helper
// ---------------------------------------------------------------------------

function logRejected(results: PromiseSettledResult<unknown>[], operation: string): void {
  for (const result of results) {
    if (result.status === 'rejected') {
      log.warn({ err: result.reason, operation }, 'calendar event operation rejected');
    }
  }
}
