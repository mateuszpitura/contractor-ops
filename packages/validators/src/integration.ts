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

// ---------------------------------------------------------------------------
// Generic provider schemas (multi-provider support)
// ---------------------------------------------------------------------------

export const providerSlugSchema = z.object({
  provider: z.string().min(1).max(50),
});

export type ProviderSlugInput = z.infer<typeof providerSlugSchema>;

export const disconnectProviderSchema = z.object({
  provider: z.string().min(1).max(50),
});

export type DisconnectProviderInput = z.infer<typeof disconnectProviderSchema>;

export const getProviderHealthSchema = z.object({
  provider: z.string().min(1).max(50),
});

export type GetProviderHealthInput = z.infer<typeof getProviderHealthSchema>;

export const getSyncLogSchema = z.object({
  provider: z.string().min(1).max(50),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export type GetSyncLogInput = z.infer<typeof getSyncLogSchema>;

export const getWebhookLogSchema = z.object({
  provider: z.string().min(1).max(50),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
});

export type GetWebhookLogInput = z.infer<typeof getWebhookLogSchema>;
