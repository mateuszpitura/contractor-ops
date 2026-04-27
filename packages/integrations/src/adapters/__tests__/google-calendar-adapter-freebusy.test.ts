// TODO(Plan 74-06): implement GoogleCalendarAdapter.getFreeBusy assertions
// once the freebusy method lands per CONTEXT.md D-05/D-08 + Pitfall on
// access-token redaction.

import { describe, it } from 'vitest';

describe('GoogleCalendarAdapter.getFreeBusy — Plan 74-06', () => {
  it.todo('POSTs to /freeBusy and merges events.list for titles + isAllDay');
  it.todo('throws with non-2xx response body in error message');
  it.todo('redacts access token from any error log via createLogger');
});
