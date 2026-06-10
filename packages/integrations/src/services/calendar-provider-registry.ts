import { GoogleCalendarAdapter } from '../adapters/google-calendar-adapter.js';
import { OutlookCalendarAdapter } from '../adapters/outlook-calendar-adapter.js';

// ---------------------------------------------------------------------------
// Calendar provider registry — Strategy lookup for dual-push calendar sync
// ---------------------------------------------------------------------------

export type CalendarProviderId = 'GOOGLE_CALENDAR' | 'OUTLOOK_CALENDAR';

export interface CalendarProviderMeta {
  credentialSlug: string;
  idempotencyOperationCreate: string;
  metadataProvider: 'google_calendar' | 'outlook_calendar';
}

const googleCalendarAdapter = new GoogleCalendarAdapter();
const outlookCalendarAdapter = new OutlookCalendarAdapter();

const CALENDAR_META: Record<CalendarProviderId, CalendarProviderMeta> = {
  GOOGLE_CALENDAR: {
    credentialSlug: 'google-calendar',
    idempotencyOperationCreate: 'google-calendar.event.create',
    metadataProvider: 'google_calendar',
  },
  OUTLOOK_CALENDAR: {
    credentialSlug: 'outlook-calendar',
    idempotencyOperationCreate: 'outlook-calendar.event.create',
    metadataProvider: 'outlook_calendar',
  },
};

export function isCalendarProviderId(value: string): value is CalendarProviderId {
  return value === 'GOOGLE_CALENDAR' || value === 'OUTLOOK_CALENDAR';
}

export function getCalendarEventAdapter(provider: 'GOOGLE_CALENDAR'): GoogleCalendarAdapter;
export function getCalendarEventAdapter(provider: 'OUTLOOK_CALENDAR'): OutlookCalendarAdapter;
export function getCalendarEventAdapter(
  provider: CalendarProviderId,
): GoogleCalendarAdapter | OutlookCalendarAdapter {
  return provider === 'GOOGLE_CALENDAR' ? googleCalendarAdapter : outlookCalendarAdapter;
}

export function getCalendarProviderMeta(provider: CalendarProviderId): CalendarProviderMeta {
  return CALENDAR_META[provider];
}
