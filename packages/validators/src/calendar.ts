import { z } from 'zod';

// Per-task calendar config stored in WorkflowTaskTemplate.configJson (D-09)
export const calendarTaskConfigSchema = z.object({
  calendarEnabled: z.boolean().default(false),
  titleTemplate: z.string().max(200).optional(),
  duration: z.enum(['30m', '1h', '2h', '4h', 'full_day']).default('1h'),
  attendees: z.array(z.email()).default([]),
});
export type CalendarTaskConfig = z.infer<typeof calendarTaskConfigSchema>;

// Calendar event metadata stored in ExternalLink.metadataJson (D-11)
export const calendarEventMetadataSchema = z.object({
  eventId: z.string(),
  calendarId: z.string().optional(),
  title: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  link: z.string().optional(),
  etag: z.string().optional(), // Google Calendar etag for concurrency (Pitfall 4)
  provider: z.enum(['google_calendar', 'outlook_calendar']),
});
export type CalendarEventMetadata = z.infer<typeof calendarEventMetadataSchema>;

// Deadline event types (D-08)
export const deadlineTypeSchema = z.enum(['CONTRACT_EXPIRY', 'APPROVAL_SLA', 'PAYMENT_DUE']);
export type DeadlineType = z.infer<typeof deadlineTypeSchema>;

// Calendar event creation input
export const createCalendarEventInputSchema = z.object({
  summary: z.string().max(300),
  description: z.string().max(2000).optional(),
  startDateTime: z.string(), // ISO 8601
  endDateTime: z.string(),
  attendees: z.array(z.email()).optional(),
});
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventInputSchema>;
