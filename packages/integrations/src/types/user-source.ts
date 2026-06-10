// ---------------------------------------------------------------------------
// User Source — onboarding import directory fetch contract
// ---------------------------------------------------------------------------

/** Integration providers supported by the onboarding user-import wizard. */
export type UserSourceProviderId = 'JIRA' | 'LINEAR' | 'GOOGLE_WORKSPACE' | 'SLACK';

export interface UserSourcePerson {
  email: string;
  name: string;
  source: UserSourceProviderId;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fetches normalized directory users from a connected integration.
 * Implementations register via `registerUserSourceFetcher`.
 */
export interface UserSourceFetcher {
  readonly providerId: UserSourceProviderId;
  fetchUsers(accessToken: string, metadata: unknown): Promise<UserSourcePerson[]>;
}
