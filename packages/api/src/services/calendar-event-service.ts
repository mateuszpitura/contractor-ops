import { GoogleCalendarAdapter } from '@contractor-ops/integrations/adapters/google-calendar-adapter';
import { OutlookCalendarAdapter } from '@contractor-ops/integrations/adapters/outlook-calendar-adapter';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import type { CalendarEventMetadata } from '@contractor-ops/validators';
import type { DbClient } from './types.js';

type PrismaClient = DbClient;

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
  prisma: PrismaClient,
  organizationId: string,
  userId?: string,
): Promise<CalendarConnection[]> {
  const connections = await prisma.integrationConnection.findMany({
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
  prisma: PrismaClient,
  input: CreateCalendarEventInput,
): Promise<void> {
  try {
    const connections = await findCalendarConnections(prisma, input.organizationId, input.userId);

    if (connections.length === 0) return;

    const results = await Promise.allSettled(
      connections.map(async conn => {
        const externalType = EXTERNAL_TYPE_MAP[conn.provider];

        if (conn.provider === 'GOOGLE_CALENDAR') {
          const result = await googleAdapter.createEvent(conn.accessToken, {
            summary: input.summary,
            description: input.description,
            startDateTime: input.startDateTime,
            endDateTime: input.endDateTime,
            attendees: input.attendees,
          });

          const metadata: CalendarEventMetadata = {
            eventId: result.eventId,
            title: input.summary,
            startTime: input.startDateTime,
            endTime: input.endDateTime,
            link: result.htmlLink,
            etag: result.etag,
            provider: 'google_calendar',
          };

          await prisma.externalLink.create({
            data: {
              organizationId: input.organizationId,
              integrationConnectionId: conn.id,
              entityType: input.entityType,
              entityId: input.entityId,
              externalType,
              externalId: result.eventId,
              externalUrl: result.htmlLink,
              metadataJson: metadata,
            },
          });
        } else {
          const result = await outlookAdapter.createEvent(conn.accessToken, {
            subject: input.summary,
            bodyHtml: input.description,
            startDateTime: input.startDateTime,
            endDateTime: input.endDateTime,
            attendees: input.attendees,
          });

          const metadata: CalendarEventMetadata = {
            eventId: result.eventId,
            title: input.summary,
            startTime: input.startDateTime,
            endTime: input.endDateTime,
            link: result.webLink,
            provider: 'outlook_calendar',
          };

          await prisma.externalLink.create({
            data: {
              organizationId: input.organizationId,
              integrationConnectionId: conn.id,
              entityType: input.entityType,
              entityId: input.entityId,
              externalType,
              externalId: result.eventId,
              externalUrl: result.webLink,
              metadataJson: metadata,
            },
          });
        }
      }),
    );

    // Log rejected results for observability
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[calendar-event-service] Failed to create calendar event:', result.reason);
      }
    }
  } catch (error) {
    console.error('[calendar-event-service] Unexpected error in createCalendarEvent:', error);
  }
}

/**
 * Updates calendar events on all connected calendars for a given entity.
 *
 * Finds existing ExternalLinks for the entity and updates the corresponding
 * events via provider APIs. Uses fire-and-forget pattern.
 */
export async function updateCalendarEvent(
  prisma: PrismaClient,
  input: UpdateCalendarEventInput,
): Promise<void> {
  try {
    const externalLinks = await prisma.externalLink.findMany({
      where: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        externalType: {
          in: ['GOOGLE_CALENDAR_EVENT', 'OUTLOOK_CALENDAR_EVENT'],
        },
      },
      include: {
        integrationConnection: {
          select: {
            id: true,
            provider: true,
            credentialsRef: true,
            status: true,
          },
        },
      },
    });

    if (externalLinks.length === 0) return;

    const results = await Promise.allSettled(
      externalLinks.map(
        async (link: {
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
        }) => {
          const conn = link.integrationConnection;
          if (conn.status !== 'CONNECTED') return;

          const providerSlug =
            conn.provider === 'GOOGLE_CALENDAR' ? 'google-calendar' : 'outlook-calendar';
          const credentials = decryptCredentials(conn.credentialsRef, providerSlug);

          const existingMetadata =
            (link.metadataJson as CalendarEventMetadata) ?? ({} as CalendarEventMetadata);

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

            const updatedMetadata: CalendarEventMetadata = {
              ...existingMetadata,
              ...(input.summary ? { title: input.summary } : {}),
              ...(input.startDateTime ? { startTime: input.startDateTime } : {}),
              ...(input.endDateTime ? { endTime: input.endDateTime } : {}),
              etag: result.etag,
              link: result.htmlLink,
              provider: 'google_calendar',
            };

            await prisma.externalLink.update({
              where: { id: link.id },
              data: {
                externalUrl: result.htmlLink,
                metadataJson: updatedMetadata,
              },
            });
          } else {
            const result = await outlookAdapter.updateEvent(
              credentials.accessToken,
              link.externalId,
              {
                subject: input.summary,
                bodyHtml: input.description,
                startDateTime: input.startDateTime,
                endDateTime: input.endDateTime,
              },
            );

            const updatedMetadata: CalendarEventMetadata = {
              ...existingMetadata,
              ...(input.summary ? { title: input.summary } : {}),
              ...(input.startDateTime ? { startTime: input.startDateTime } : {}),
              ...(input.endDateTime ? { endTime: input.endDateTime } : {}),
              link: result.webLink,
              provider: 'outlook_calendar',
            };

            await prisma.externalLink.update({
              where: { id: link.id },
              data: {
                externalUrl: result.webLink,
                metadataJson: updatedMetadata,
              },
            });
          }
        },
      ),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[calendar-event-service] Failed to update calendar event:', result.reason);
      }
    }
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
  prisma: PrismaClient,
  input: DeleteCalendarEventInput,
): Promise<void> {
  try {
    const externalLinks = await prisma.externalLink.findMany({
      where: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
        externalType: {
          in: ['GOOGLE_CALENDAR_EVENT', 'OUTLOOK_CALENDAR_EVENT'],
        },
      },
      include: {
        integrationConnection: {
          select: {
            id: true,
            provider: true,
            credentialsRef: true,
            status: true,
          },
        },
      },
    });

    if (externalLinks.length === 0) return;

    const results = await Promise.allSettled(
      externalLinks.map(
        async (link: {
          id: string;
          externalId: string;
          externalType: string;
          integrationConnection: {
            id: string;
            provider: string;
            credentialsRef: string;
            status: string;
          };
        }) => {
          const conn = link.integrationConnection;

          // Attempt deletion even if disconnected — best effort
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
          await prisma.externalLink.delete({
            where: { id: link.id },
          });
        },
      ),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[calendar-event-service] Failed to delete calendar event:', result.reason);
      }
    }
  } catch (error) {
    console.error('[calendar-event-service] Unexpected error in deleteCalendarEvent:', error);
  }
}
