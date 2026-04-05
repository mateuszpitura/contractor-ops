// ---------------------------------------------------------------------------
// Microsoft Graph API Client for Teams
// Channel/Team/User discovery via delegated user token
// ---------------------------------------------------------------------------

import { Client } from "@microsoft/microsoft-graph-client";

// ---------------------------------------------------------------------------
// Client Factory
// ---------------------------------------------------------------------------

/**
 * Creates a Graph API client authenticated with the given access token.
 * Uses the simple authProvider callback pattern (no @azure/identity needed
 * for delegated user tokens obtained via OAuth).
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// ---------------------------------------------------------------------------
// Team Discovery
// ---------------------------------------------------------------------------

export interface TeamInfo {
  id: string;
  displayName: string;
}

export interface ChannelInfo {
  id: string;
  displayName: string;
}

export interface UserInfo {
  id: string;
  displayName: string;
}

/**
 * Fetches the list of teams the authenticated user has joined.
 *
 * @param accessToken - OAuth access token with Team.ReadBasic.All scope
 * @returns Array of teams with id and displayName
 */
export async function getJoinedTeams(
  accessToken: string,
): Promise<TeamInfo[]> {
  const client = createGraphClient(accessToken);

  const response = (await client
    .api("/me/joinedTeams")
    .select("id,displayName")
    .get()) as { value: TeamInfo[] };

  return response.value;
}

/**
 * Fetches the channels for a specific team.
 *
 * @param accessToken - OAuth access token with Channel.ReadBasic.All scope
 * @param teamId - The team ID to list channels for
 * @returns Array of channels with id and displayName
 */
export async function getTeamsChannels(
  accessToken: string,
  teamId: string,
): Promise<ChannelInfo[]> {
  const client = createGraphClient(accessToken);

  const response = (await client
    .api(`/teams/${teamId}/channels`)
    .select("id,displayName")
    .get()) as { value: ChannelInfo[] };

  return response.value;
}

/**
 * Looks up a user by email address via Microsoft Graph.
 * Returns null if the user is not found (404).
 *
 * @param accessToken - OAuth access token with User.Read scope
 * @param email - Email address to look up
 * @returns User info or null if not found
 */
export async function getUserByEmail(
  accessToken: string,
  email: string,
): Promise<UserInfo | null> {
  const client = createGraphClient(accessToken);

  try {
    const user = (await client
      .api(`/users/${encodeURIComponent(email)}`)
      .select("id,displayName")
      .get()) as UserInfo;

    return user;
  } catch (error: unknown) {
    // Graph API returns 404 for unknown users
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) {
      return null;
    }
    throw error;
  }
}
