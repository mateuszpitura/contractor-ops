import type { PrismaClient } from '@contractor-ops/db';
import { GoogleCalendarAdapter } from '@contractor-ops/integrations/adapters/google-calendar-adapter';
import { OutlookCalendarAdapter } from '@contractor-ops/integrations/adapters/outlook-calendar-adapter';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { CalendarEventMetadata } from '@contractor-ops/validators';
import type { CalendarPrismaClient } from './types.js';

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

const googleAdapter = new GoogleCalendarAdapter();
const outlookAdapter = new OutlookCalendarAdapter();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarConnection {
  id: string;
  provider: (typeof CALENDAR_PROVIDERS)[number];
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
 * org-level connections (userId = null) per D-12 dual-push requirement.
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

  return connections.map(
    (conn: { id: string; provider: string; credentialsRef: string; organizationId: string }) => {
      const providerSlug =
        conn.provider === 'GOOGLE_CALENDAR' ? 'google-calendar' : 'outlook-calendar';
      const credentials = decryptCredentials(conn.credentialsRef, providerSlug);

      return {
        id: conn.id,
        provider: conn.provider as (typeof CALENDAR_PROVIDERS)[number],
        accessToken: credentials.accessToken,
        organizationId: conn.organizationId,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Calendar Event CRUD
// ---------------------------------------------------------------------------

/**
 * Creates a calendar event on all connected calendars (dual-push per D-12).
 *
 * For each calendar connection, creates the event via the provider API
 * and stores an ExternalLink with cached metadata.
 *
 * Uses fire-and-forget pattern: logs errors but does not throw,
 * so calendar failures never block business mutations (D-11).
 */
export async function createCalendarEvent(
  prisma: CalendarPrismaClient,
  input: CreateCalendarEventInput,
): Promise<void> {
  try {
    const connections = await findCalendarConnections(prisma, input.organizationId, input.userId);

    if (connections.length === 0) return;

    const results = await Promise.allSettled(
      connections.map(conn => createEventForConnection(prisma, conn, input)),
    );

    logRejected(results, 'create');
  } catch (error) {
    console.error('[calendar-event-service] Unexpected error in createCalendarEvent:', error);
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
      entityType: input.entityType,
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
  if (conn.provider === 'GOOGLE_CALENDAR') {
    const result = await googleAdapter.createEvent(conn.accessToken, {
      summary: input.summary,
      description: input.description,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      attendees: input.attendees,
    });

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
        provider: 'google_calendar',
      },
    };
  }

  const result = await outlookAdapter.createEvent(conn.accessToken, {
    subject: input.summary,
    bodyHtml: input.description,
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    attendees: input.attendees,
  });

  return {
    eventId: result.eventId,
    url: result.webLink,
    metadata: {
      eventId: result.eventId,
      title: input.summary,
      startTime: input.startDateTime,
      endTime: input.endDateTime,
      link: result.webLink,
      provider: 'outlook_calendar',
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
      externalLinks.map(link => updateEventForLink(prisma, link, input)),
    );

    logRejected(results, 'update');
  } catch (error) {
    console.error('[calendar-event-service] Unexpected error in updateCalendarEvent:', error);
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
      externalLinks.map(link => deleteEventForLink(prisma, link)),
    );

    logRejected(results, 'delete');
  } catch (error) {
    console.error('[calendar-event-service] Unexpected error in deleteCalendarEvent:', error);
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
  return db.externalLink.findMany({
    where: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      externalType: { in: ['GOOGLE_CALENDAR_EVENT', 'OUTLOOK_CALENDAR_EVENT'] },
    },
    include: {
      integrationConnection: {
        select: { id: true, provider: true, credentialsRef: true, status: true },
      },
    },
  });
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

  const providerSlug = conn.provider === 'GOOGLE_CALENDAR' ? 'google-calendar' : 'outlook-calendar';
  const credentials = decryptCredentials(conn.credentialsRef, providerSlug);
  const existingMetadata =
    (link.metadataJson as CalendarEventMetadata) ?? ({} as CalendarEventMetadata);

  const fieldOverrides = {
    ...(input.summary ? { title: input.summary } : {}),
    ...(input.startDateTime ? { startTime: input.startDateTime } : {}),
    ...(input.endDateTime ? { endTime: input.endDateTime } : {}),
  };

  const db = calendarOrm(prisma);
  if (conn.provider === 'GOOGLE_CALENDAR') {
    const etag = existingMetadata.etag ?? '';
    const result = await googleAdapter.updateEvent(
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
          provider: 'google_calendar',
        },
      },
    });
  } else {
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
          provider: 'outlook_calendar',
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
    if (conn.status === 'CONNECTED') {
      const providerSlug =
        conn.provider === 'GOOGLE_CALENDAR' ? 'google-calendar' : 'outlook-calendar';
      const credentials = decryptCredentials(conn.credentialsRef, providerSlug);

      if (conn.provider === 'GOOGLE_CALENDAR') {
        await googleAdapter.deleteEvent(credentials.accessToken, link.externalId);
      } else {
        await outlookAdapter.deleteEvent(credentials.accessToken, link.externalId);
      }
    }
  } catch (deleteError) {
    console.error('[calendar-event-service] Failed to delete provider event:', deleteError);
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
      console.error(
        `[calendar-event-service] Failed to ${operation} calendar event:`,
        result.reason,
      );
    }
  }
}
