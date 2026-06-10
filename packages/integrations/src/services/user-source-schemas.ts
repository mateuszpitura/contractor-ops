import { z } from 'zod';

/** Jira connection configJson shape for directory user import. */
export const jiraUserSourceMetadataSchema = z.object({
  cloudId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9-]+$/, 'Invalid Jira cloudId format'),
});

export const jiraUserSearchRowSchema = z.object({
  emailAddress: z.email().optional(),
  displayName: z.string().optional(),
  self: z.string().optional(),
  avatarUrls: z.record(z.string(), z.string()).optional(),
});

export const jiraUserSearchResponseSchema = z.array(jiraUserSearchRowSchema);

export const googleDirectoryUserSchema = z.object({
  id: z.string(),
  primaryEmail: z.email(),
  suspended: z.boolean().optional(),
  archived: z.boolean().optional(),
  name: z
    .object({
      fullName: z.string().optional(),
    })
    .optional(),
  thumbnailPhotoUrl: z.string().optional(),
});

export const googleDirectoryUsersPageSchema = z.object({
  users: z.array(googleDirectoryUserSchema).optional(),
  nextPageToken: z.string().optional(),
});

export const slackUserListMemberSchema = z.object({
  id: z.string(),
  deleted: z.boolean().optional(),
  is_bot: z.boolean().optional(),
  is_app_user: z.boolean().optional(),
  profile: z.object({
    email: z.string().optional(),
    real_name: z.string().optional(),
    image_72: z.string().optional(),
  }),
});

export const linearUsersPageSchema = z.object({
  organization: z.object({
    users: z.object({
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string().nullable(),
      }),
      nodes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          active: z.boolean(),
          avatarUrl: z.string().optional(),
        }),
      ),
    }),
  }),
});

export const slackUserListResponseSchema = z.object({
  ok: z.boolean(),
  members: z.array(slackUserListMemberSchema).optional(),
  response_metadata: z
    .object({
      next_cursor: z.string().optional(),
    })
    .optional(),
});
