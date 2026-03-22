import { z } from "zod";

// ---------------------------------------------------------------------------
// Slack OAuth schemas
// ---------------------------------------------------------------------------

export const slackOAuthInitSchema = z.object({});

export type SlackOAuthInitInput = z.infer<typeof slackOAuthInitSchema>;

// ---------------------------------------------------------------------------
// Slack user mapping schemas
// ---------------------------------------------------------------------------

export const slackUserLinkSchema = z.object({
  userId: z.string(),
  externalId: z.string(),
});

export type SlackUserLinkInput = z.infer<typeof slackUserLinkSchema>;

export const slackUserUnlinkSchema = z.object({
  externalLinkId: z.string(),
});

export type SlackUserUnlinkInput = z.infer<typeof slackUserUnlinkSchema>;
