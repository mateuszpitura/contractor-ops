import { describe, it } from "vitest";

describe("workflow router — startRun calendar integration", () => {
  it.todo("builds calendarConfigMap from template tasks with calendarEnabled=true");
  it.todo("skips tasks where calendarTaskConfigSchema.safeParse fails");
  it.todo("returns calendarTaskCount in startRun mutation response");
  it.todo("calls createTaskCalendarEvent for each calendar-eligible TODO task run");
  it.todo("logs server-side error when createTaskCalendarEvent fails");
});
