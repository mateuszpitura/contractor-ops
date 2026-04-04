import { prisma } from "@contractor-ops/db";
import { linearGraphQL } from "./linear-issue-sync.js";
import type { MergedPerson } from "@contractor-ops/validators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourcePerson = {
  email: string;
  name: string;
  source: "JIRA" | "LINEAR" | "GOOGLE_WORKSPACE" | "SLACK";
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
};

export type ImportProject = {
  sourceProvider: string;
  externalId: string;
  name: string;
  skip: boolean;
  steps: { name: string; sortOrder: number }[];
};

// ---------------------------------------------------------------------------
// fetchUsersFromSource
// ---------------------------------------------------------------------------

/**
 * Fetches user list from a given integration source.
 * Returns normalized SourcePerson array.
 */
export async function fetchUsersFromSource(
  provider: string,
  accessToken: string,
  metadata: unknown,
): Promise<SourcePerson[]> {
  switch (provider) {
    case "JIRA":
      return fetchJiraUsers(accessToken, metadata);
    case "LINEAR":
      return fetchLinearUsers(accessToken);
    case "GOOGLE_WORKSPACE":
      return fetchGoogleWorkspaceUsers(accessToken);
    case "SLACK":
      return fetchSlackUsers(accessToken);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Jira user fetching (paginated)
// ---------------------------------------------------------------------------

async function fetchJiraUsers(
  accessToken: string,
  metadata: unknown,
): Promise<SourcePerson[]> {
  const config = metadata as { cloudId?: string } | null;
  if (!config?.cloudId) return [];

  const baseUrl = `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  const users: SourcePerson[] = [];
  let startAt = 0;
  const maxResults = 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await fetch(
      `${baseUrl}/users/search?maxResults=${maxResults}&startAt=${startAt}`,
      { headers },
    );

    if (!response.ok) break;

    const data = (await response.json()) as Array<{
      emailAddress?: string;
      displayName?: string;
      self?: string;
      avatarUrls?: Record<string, string>;
    }>;

    if (!data.length) break;

    for (const user of data) {
      if (!user.emailAddress) continue;
      users.push({
        email: user.emailAddress,
        name: user.displayName ?? user.emailAddress,
        source: "JIRA",
        avatarUrl: user.avatarUrls?.["48x48"],
        metadata: { self: user.self },
      });
    }

    if (data.length < maxResults) break;
    startAt += maxResults;
  }

  return users;
}

// ---------------------------------------------------------------------------
// Linear user fetching
// ---------------------------------------------------------------------------

async function fetchLinearUsers(accessToken: string): Promise<SourcePerson[]> {
  const data = await linearGraphQL<{
    organization: {
      users: {
        nodes: Array<{
          id: string;
          name: string;
          email: string;
          active: boolean;
          avatarUrl?: string;
        }>;
      };
    };
  }>(
    accessToken,
    `{ organization { users { nodes { id name email active avatarUrl } } } }`,
  );

  return data.organization.users.nodes
    .filter((u) => u.active)
    .map((u) => ({
      email: u.email,
      name: u.name,
      source: "LINEAR" as const,
      avatarUrl: u.avatarUrl,
      metadata: { linearId: u.id },
    }));
}

// ---------------------------------------------------------------------------
// Google Workspace user fetching
// ---------------------------------------------------------------------------

async function fetchGoogleWorkspaceUsers(
  accessToken: string,
): Promise<SourcePerson[]> {
  // Use Google Admin SDK Directory API
  const response = await fetch(
    "https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    users?: Array<{
      id: string;
      primaryEmail: string;
      name: { fullName: string };
      thumbnailPhotoUrl?: string;
    }>;
  };

  return (data.users ?? []).map((u) => ({
    email: u.primaryEmail,
    name: u.name.fullName,
    source: "GOOGLE_WORKSPACE" as const,
    avatarUrl: u.thumbnailPhotoUrl,
    metadata: { googleId: u.id },
  }));
}

// ---------------------------------------------------------------------------
// Slack user fetching (paginated, filters bots)
// ---------------------------------------------------------------------------

async function fetchSlackUsers(accessToken: string): Promise<SourcePerson[]> {
  const users: SourcePerson[] = [];
  let cursor: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = new URL("https://slack.com/api/users.list");
    url.searchParams.set("limit", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) break;

    const data = (await response.json()) as {
      ok: boolean;
      members?: Array<{
        id: string;
        deleted: boolean;
        is_bot: boolean;
        is_app_user: boolean;
        profile: {
          email?: string;
          real_name?: string;
          image_72?: string;
        };
      }>;
      response_metadata?: { next_cursor?: string };
    };

    if (!data.ok || !data.members) break;

    for (const member of data.members) {
      // Filter out bots, deleted users, app users, and Slackbot
      if (member.is_bot) continue;
      if (member.deleted) continue;
      if (member.is_app_user) continue;
      if (member.id === "USLACKBOT") continue;
      if (!member.profile.email) continue;

      users.push({
        email: member.profile.email,
        name: member.profile.real_name ?? member.profile.email,
        source: "SLACK",
        avatarUrl: member.profile.image_72,
      });
    }

    cursor = data.response_metadata?.next_cursor;
    if (!cursor) break;
  }

  return users;
}

// ---------------------------------------------------------------------------
// mergeByEmail
// ---------------------------------------------------------------------------

/**
 * Merges source people by normalized (lowercase) email.
 * Detects name conflicts and marks existing members.
 * Returns sorted: conflicts first, then new, then exists.
 */
export function mergeByEmail(
  sourcePeople: SourcePerson[],
  existingEmails: Set<string>,
): MergedPerson[] {
  const byEmail = new Map<
    string,
    {
      sources: Array<{
        source: string;
        name: string;
        avatarUrl?: string;
        metadata?: Record<string, unknown>;
      }>;
    }
  >();

  for (const person of sourcePeople) {
    const key = person.email.toLowerCase();
    const existing = byEmail.get(key);
    const entry = {
      source: person.source,
      name: person.name,
      avatarUrl: person.avatarUrl,
      metadata: person.metadata,
    };

    if (existing) {
      existing.sources.push(entry);
    } else {
      byEmail.set(key, { sources: [entry] });
    }
  }

  const merged: MergedPerson[] = [];

  for (const [email, data] of byEmail) {
    const uniqueNames = [...new Set(data.sources.map((s) => s.name))];
    const isExisting = existingEmails.has(email);
    const hasConflict = uniqueNames.length > 1;

    let status: "new" | "conflict" | "exists";
    if (isExisting) {
      status = "exists";
    } else if (hasConflict) {
      status = "conflict";
    } else {
      status = "new";
    }

    const conflicts = hasConflict
      ? [
          {
            field: "name",
            values: data.sources.map((s) => ({
              source: s.source,
              value: s.name,
            })),
          },
        ]
      : undefined;

    merged.push({
      email,
      name: data.sources[0]!.name,
      sources: data.sources.map((s) => ({
        source: s.source as "JIRA" | "LINEAR" | "GOOGLE_WORKSPACE" | "SLACK",
        name: s.name,
        avatarUrl: s.avatarUrl,
        metadata: s.metadata,
      })),
      status,
      conflicts,
    });
  }

  // Sort by priority: conflicts first, then new, then exists
  const statusOrder: Record<string, number> = {
    conflict: 0,
    new: 1,
    exists: 2,
  };

  merged.sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99),
  );

  return merged;
}

// ---------------------------------------------------------------------------
// createWorkflowTemplatesFromProjects
// ---------------------------------------------------------------------------

/**
 * Creates WorkflowTemplate + WorkflowTaskTemplate records from imported projects.
 * Each project becomes a CUSTOM template with MANUAL tasks per status step.
 */
export async function createWorkflowTemplatesFromProjects(params: {
  projects: ImportProject[];
  organizationId: string;
  createdByUserId: string;
}): Promise<string[]> {
  const { projects, organizationId, createdByUserId } = params;
  const templateIds: string[] = [];

  for (const project of projects) {
    if (project.skip) continue;

    // Create the workflow template
    const template = await prisma.workflowTemplate.create({
      data: {
        organizationId,
        name: `${project.name} Onboarding`,
        type: "CUSTOM",
        description: `Auto-imported from ${project.sourceProvider}: ${project.name}`,
        version: 1,
        status: "DRAFT",
        appliesToEntityType: "CONTRACTOR",
        createdByUserId,
      },
    });

    // Create task templates from steps
    if (project.steps.length > 0) {
      await prisma.workflowTaskTemplate.createMany({
        data: project.steps.map((step) => ({
          organizationId,
          workflowTemplateId: template.id,
          title: step.name,
          taskType: "MANUAL",
          sortOrder: step.sortOrder,
          required: true,
          assigneeMode: "ROLE_BASED",
        })),
      });
    }

    templateIds.push(template.id);
  }

  return templateIds;
}
