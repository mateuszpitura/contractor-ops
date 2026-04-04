// ---------------------------------------------------------------------------
// Stub: Teams Graph API Client
// ---------------------------------------------------------------------------
// Placeholder for Plan 02. Provides correct export signatures.
// ---------------------------------------------------------------------------

export async function getTeamsChannels(
  _accessToken: string,
  _teamId: string,
): Promise<Array<{ id: string; displayName: string }>> {
  throw new Error("getTeamsChannels stub -- Plan 02 not yet merged");
}

export async function getJoinedTeams(
  _accessToken: string,
): Promise<Array<{ id: string; displayName: string }>> {
  throw new Error("getJoinedTeams stub -- Plan 02 not yet merged");
}

export async function getUserByEmail(
  _accessToken: string,
  _email: string,
): Promise<{ id: string; displayName: string } | null> {
  throw new Error("getUserByEmail stub -- Plan 02 not yet merged");
}
