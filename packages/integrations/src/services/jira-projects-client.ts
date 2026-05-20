import { fetchWithTimeout } from './fetch-helpers.js';

/**
 * Project metadata pulled from Jira Cloud.
 * `statuses` is optional because the org-definitions sync only needs the
 * project's name + externalId; the richer onboarding-import flow opts in
 * by passing `{ includeStatuses: true }`.
 */
export interface JiraProject {
  externalId: string;
  name: string;
  key: string;
  statuses: Array<{ id: string; name: string; color?: string }>;
}

interface JiraProjectsConfig {
  /** Atlassian cloudId discovered via the accessible-resources endpoint. */
  cloudId: string;
}

interface FetchJiraProjectsOptions {
  /** Hit `/project/{id}/statuses` per project (slow). Defaults to `false`. */
  includeStatuses?: boolean;
}

/**
 * Fetches all Jira projects the OAuth-connected user can see.
 *
 * Extracted from `packages/api/src/routers/core/onboarding-import.ts` so both
 * the onboarding wizard and the org-definitions sync job share the same HTTP
 * surface — keeps OAuth-token handling, rate-limiting, and error reporting
 * consistent across callers.
 */
export async function fetchJiraProjects(
  accessToken: string,
  config: JiraProjectsConfig,
  options: FetchJiraProjectsOptions = {},
): Promise<JiraProject[]> {
  if (!config?.cloudId) return [];

  const baseUrl = `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  const projResponse = await fetchWithTimeout(`${baseUrl}/project`, { headers });
  if (!projResponse.ok) return [];

  const jiraProjects = (await projResponse.json()) as Array<{
    id: string;
    key: string;
    name: string;
  }>;

  if (!options.includeStatuses) {
    return jiraProjects.map(proj => ({
      externalId: proj.id,
      name: proj.name,
      key: proj.key,
      statuses: [],
    }));
  }

  const results: JiraProject[] = [];
  for (const proj of jiraProjects) {
    const statusResponse = await fetchWithTimeout(`${baseUrl}/project/${proj.id}/statuses`, {
      headers,
    });
    if (!statusResponse.ok) continue;

    const statusData = (await statusResponse.json()) as Array<{
      id: string;
      statuses: Array<{
        id: string;
        name: string;
        statusCategory?: { colorName?: string };
      }>;
    }>;

    const statusMap = new Map<string, { id: string; name: string; color?: string }>();
    for (const issueType of statusData) {
      for (const status of issueType.statuses) {
        if (!statusMap.has(status.id)) {
          statusMap.set(status.id, {
            id: status.id,
            name: status.name,
            color: status.statusCategory?.colorName,
          });
        }
      }
    }

    results.push({
      externalId: proj.id,
      name: proj.name,
      key: proj.key,
      statuses: [...statusMap.values()],
    });
  }
  return results;
}
