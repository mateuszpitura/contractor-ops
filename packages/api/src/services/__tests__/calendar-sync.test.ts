import { describe, it } from "vitest";

describe("CalendarEventService", () => {
  it.todo(
    "createCalendarEvent calls Google Calendar events.insert",
  );

  it.todo(
    "createCalendarEvent calls MS Graph POST /me/calendar/events",
  );

  it.todo(
    "createCalendarEvent stores eventId in ExternalLink",
  );

  it.todo(
    "updateCalendarEvent updates existing event via provider API",
  );

  it.todo(
    "deleteCalendarEvent removes event and ExternalLink",
  );

  it.todo(
    "pushes to both personal and org calendar when both connected",
  );
});

describe("CalendarDeadlineSync", () => {
  it.todo(
    "creates calendar event for contract expiry date",
  );

  it.todo(
    "creates calendar event for approval SLA deadline",
  );

  it.todo(
    "creates calendar event for payment due date",
  );

  it.todo(
    "updates calendar event when source entity date changes",
  );

  it.todo(
    "deletes calendar event when source entity is deleted",
  );

  it.todo(
    "formats event title as [Contractor Ops] Contract expiry: {contractor} - {contract}",
  );

  it.todo(
    "includes deep link to entity in event description",
  );
});

describe("CalendarTaskEventService", () => {
  it.todo(
    "creates calendar event when task run activates with calendarEnabled config",
  );

  it.todo(
    "substitutes {contractor}, {contract}, {task} in title template",
  );

  it.todo(
    "sets event duration from configJson duration field",
  );

  it.todo(
    "adds attendees from configJson plus contractor and assignee",
  );
});
