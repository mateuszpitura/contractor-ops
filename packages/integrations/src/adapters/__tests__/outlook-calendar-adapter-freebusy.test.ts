// TODO(Plan 74-06): implement OutlookCalendarAdapter.getFreeBusy assertions
// once the freebusy method lands per CONTEXT.md D-05/D-08.

import { describe, it } from 'vitest';

describe('OutlookCalendarAdapter.getFreeBusy — Plan 74-06', () => {
  it.todo('calls /me/calendar/getSchedule with manager email + ISO time window');
  it.todo('parses availabilityView into BusyRange[] with summary + isAllDay flags');
  it.todo('throws when Microsoft Graph returns >=400');
});
