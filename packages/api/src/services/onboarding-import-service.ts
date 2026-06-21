import type { UserSourceProviderId } from '@contractor-ops/integrations';
import { fetchUsersFromIntegrationSource } from '@contractor-ops/integrations';
import type { MergedPerson } from '@contractor-ops/validators';
import { z } from 'zod';
import type { TenantScopedDb } from '../lib/tenant-db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourcePerson = {
  email: string;
  name: string;
  source: 'JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK';
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
 * Fetches user list from a given integration source via the integrations
 * user-source registry (`registerUserSourceFetcher`).
 */
export async function fetchUsersFromSource(
  provider: UserSourceProviderId,
  accessToken: string,
  metadata: unknown,
): Promise<SourcePerson[]> {
  return fetchUsersFromIntegrationSource(provider, accessToken, metadata);
}

// ---------------------------------------------------------------------------
// mergeByEmail
// ---------------------------------------------------------------------------

type EmailGroup = {
  canonicalEmail: string;
  sources: Array<{
    source: string;
    name: string;
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
  }>;
};

/**
 * Resolve a single email group into a {@link MergedPerson}: derive status
 * (exists/conflict/new) and, on a name conflict, the per-source value list.
 */
function buildMergedPerson(group: EmailGroup, existingEmails: Set<string>): MergedPerson {
  const uniqueNames = [...new Set(group.sources.map(s => s.name))];
  const isExisting = existingEmails.has(group.canonicalEmail.toLowerCase());
  const hasConflict = uniqueNames.length > 1;

  let status: 'new' | 'conflict' | 'exists';
  if (isExisting) {
    status = 'exists';
  } else if (hasConflict) {
    status = 'conflict';
  } else {
    status = 'new';
  }

  const conflicts = hasConflict
    ? [
        {
          field: 'name',
          values: group.sources.map(s => ({ source: s.source, value: s.name })),
        },
      ]
    : undefined;

  return {
    email: group.canonicalEmail,
    name: group.sources[0]?.name ?? '',
    sources: group.sources.map(s => ({
      source: s.source as 'JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK',
      name: s.name,
      avatarUrl: s.avatarUrl,
      metadata: s.metadata,
    })),
    status,
    conflicts,
  };
}

/**
 * Merges source people by normalized (lowercase) email.
 * Detects name conflicts and marks existing members.
 * Returns sorted: conflicts first, then new, then exists.
 */
export function mergeByEmail(
  sourcePeople: SourcePerson[],
  existingEmails: Set<string>,
): MergedPerson[] {
  const byEmail = new Map<string, EmailGroup>();

  for (const person of sourcePeople) {
    const trimmed = person.email.trim();
    if (!trimmed) continue;
    const parsedEmail = z.email().safeParse(trimmed);
    if (!parsedEmail.success) continue;
    const key = parsedEmail.data.toLowerCase();
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
      byEmail.set(key, { canonicalEmail: key, sources: [entry] });
    }
  }

  const merged: MergedPerson[] = [];

  for (const [, data] of byEmail) {
    merged.push(buildMergedPerson(data, existingEmails));
  }

  const statusOrder: Record<string, number> = {
    conflict: 0,
    new: 1,
    exists: 2,
  };

  merged.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

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
  db: TenantScopedDb;
  projects: ImportProject[];
  organizationId: string;
  createdByUserId: string;
}): Promise<string[]> {
  const { db, projects, organizationId, createdByUserId } = params;

  return db.$transaction(async tx => {
    const templateIds: string[] = [];

    for (const project of projects) {
      if (project.skip) continue;

      const template = await tx.workflowTemplate.create({
        data: {
          organizationId,
          name: `${project.name} Onboarding`,
          type: 'CUSTOM',
          description: `Auto-imported from ${project.sourceProvider}: ${project.name}`,
          version: 1,
          status: 'DRAFT',
          appliesToEntityType: 'CONTRACTOR',
          createdByUserId,
        },
      });

      if (project.steps.length > 0) {
        await tx.workflowTaskTemplate.createMany({
          data: project.steps.map(step => ({
            organizationId,
            workflowTemplateId: template.id,
            title: step.name,
            taskType: 'MANUAL',
            sortOrder: step.sortOrder,
            required: true,
            assigneeMode: 'ROLE_BASED',
          })),
        });
      }

      templateIds.push(template.id);
    }

    return templateIds;
  });
}
