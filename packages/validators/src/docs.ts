import { z } from 'zod';

// Doc link metadata cached in ExternalLink.metadataJson
export const notionPageMetadataSchema = z.object({
  title: z.string(),
  icon: z.string().nullable(),
  lastEditedTime: z.string(),
  workspaceName: z.string().optional(),
});
export type NotionPageMetadata = z.infer<typeof notionPageMetadataSchema>;

export const confluencePageMetadataSchema = z.object({
  title: z.string(),
  spaceKey: z.string(),
  spaceName: z.string(),
  lastEditedTime: z.string().optional(),
});
export type ConfluencePageMetadata = z.infer<typeof confluencePageMetadataSchema>;

// Search result shapes returned by adapters
export const docSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().nullish(),
  subtitle: z.string(), // workspace name or space name
  url: z.string(),
  provider: z.enum(['notion', 'confluence']),
});
export type DocSearchResult = z.infer<typeof docSearchResultSchema>;

// Attach doc input
export const attachDocInputSchema = z.object({
  workflowTaskRunId: z.cuid(),
  externalId: z.string(),
  externalUrl: z.url(),
  externalType: z.enum(['NOTION_PAGE', 'CONFLUENCE_PAGE']),
  metadata: z.union([notionPageMetadataSchema, confluencePageMetadataSchema]),
});
export type AttachDocInput = z.infer<typeof attachDocInputSchema>;

// Search input
export const docSearchInputSchema = z.object({
  query: z.string().min(1).max(200),
  provider: z.enum(['notion', 'confluence', 'all']).default('all'),
});
export type DocSearchInput = z.infer<typeof docSearchInputSchema>;
