import { fetchWithTimeout } from './fetch-helpers.js';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

/**
 * A Linear "team" — semantically a project in the contractor-ops domain.
 * `states` is optional because the org-definitions sync only needs the
 * team's name + externalId.
 */
export interface LinearTeam {
  externalId: string;
  key: string;
  name: string;
  states: Array<{ id: string; name: string; type: string; color: string; position: number }>;
}

interface FetchLinearTeamsOptions {
  /** Whether to request the workflow `states` payload (slower). Defaults to `false`. */
  includeStates?: boolean;
}

/**
 * Generic Linear GraphQL helper. Mirrors the surface of
 * `linearGraphQL` in `packages/api/src/services/linear-issue-sync.ts` but
 * returns plain `Error`s instead of TRPC-typed errors so it can be reused
 * from non-tRPC callers (e.g. the org-definitions sync cron).
 */
export async function linearGraphQL<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetchWithTimeout(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error('Linear access token is invalid or expired.');
    }
    throw new Error(`Linear API error (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors.map(e => e.message).join('; ')}`);
  }
  if (!json.data) {
    throw new Error('Linear GraphQL response missing data');
  }
  return json.data;
}

/**
 * Fetches all Linear teams the OAuth-connected user can see.
 *
 * Extracted from `packages/api/src/routers/core/onboarding-import.ts` so
 * both the onboarding wizard and the org-definitions sync share the same
 * GraphQL surface.
 */
export async function fetchLinearTeams(
  accessToken: string,
  options: FetchLinearTeamsOptions = {},
): Promise<LinearTeam[]> {
  const query = options.includeStates
    ? `{
        teams {
          nodes {
            id name key
            states { nodes { id name type color position } }
          }
        }
      }`
    : `{ teams { nodes { id name key } } }`;

  const data = await linearGraphQL<{
    teams: {
      nodes: Array<{
        id: string;
        name: string;
        key: string;
        states?: {
          nodes: Array<{ id: string; name: string; type: string; color: string; position: number }>;
        };
      }>;
    };
  }>(accessToken, query);

  return data.teams.nodes.map(team => ({
    externalId: team.id,
    name: team.name,
    key: team.key,
    states:
      team.states?.nodes.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        color: s.color,
        position: s.position,
      })) ?? [],
  }));
}
