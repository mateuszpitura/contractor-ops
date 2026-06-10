import { createIntegrationLogger } from '@contractor-ops/logger';
import { z } from 'zod';
import type {
  UserSourceFetcher,
  UserSourcePerson,
  UserSourceProviderId,
} from '../types/user-source.js';
import { fetchJsonWithTimeout } from './fetch-helpers.js';
import { linearGraphQL } from './linear-teams-client.js';
import {
  googleDirectoryUsersPageSchema,
  jiraUserSearchResponseSchema,
  jiraUserSourceMetadataSchema,
  linearUsersPageSchema,
  slackUserListResponseSchema,
} from './user-source-schemas.js';

const log = createIntegrationLogger('user-source-registry');

const MAX_USER_SOURCE_PAGES = 100;

const fetchers = new Map<UserSourceProviderId, UserSourceFetcher>();

function providerFetchError(provider: UserSourceProviderId, message: string): Error {
  log.warn({ provider, message }, 'user source fetch failed');
  return new Error(`[${provider}] ${message}`);
}

export function registerUserSourceFetcher(fetcher: UserSourceFetcher): void {
  if (fetchers.has(fetcher.providerId)) {
    log.warn(
      { providerId: fetcher.providerId },
      'registerUserSourceFetcher: provider already registered — overwriting',
    );
  }
  fetchers.set(fetcher.providerId, fetcher);
}

export function getUserSourceFetcher(
  providerId: UserSourceProviderId,
): UserSourceFetcher | undefined {
  return fetchers.get(providerId);
}

export function clearUserSourceFetchers(): void {
  fetchers.clear();
}

/**
 * Fetches normalized users from a registered integration source.
 * Throws when the provider is unknown, credentials are missing, or the upstream API fails.
 */
export async function fetchUsersFromIntegrationSource(
  provider: UserSourceProviderId,
  accessToken: string,
  metadata: unknown,
): Promise<UserSourcePerson[]> {
  const fetcher = fetchers.get(provider);
  if (!fetcher) {
    throw providerFetchError(provider, 'Unknown user source provider');
  }
  if (!accessToken.trim()) {
    throw providerFetchError(provider, 'Missing access token');
  }
  return fetcher.fetchUsers(accessToken, metadata);
}

async function fetchJiraUsers(accessToken: string, metadata: unknown): Promise<UserSourcePerson[]> {
  const parsedMeta = jiraUserSourceMetadataSchema.safeParse(metadata);
  if (!parsedMeta.success) {
    throw providerFetchError('JIRA', 'Missing or invalid Jira cloudId in connection config');
  }
  const { cloudId } = parsedMeta.data;

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  const users: UserSourcePerson[] = [];
  let startAt = 0;
  const maxResults = 1000;
  let pageCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    pageCount += 1;
    if (pageCount > MAX_USER_SOURCE_PAGES) {
      throw providerFetchError(
        'JIRA',
        `Exceeded maximum pagination limit (${MAX_USER_SOURCE_PAGES} pages)`,
      );
    }

    const data = await fetchJsonWithTimeout<unknown>(
      `${baseUrl}/users/search?maxResults=${maxResults}&startAt=${startAt}`,
      { headers },
    );

    const parsed = jiraUserSearchResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw providerFetchError('JIRA', 'Invalid users/search response shape');
    }

    const page = parsed.data;
    if (!page.length) break;

    for (const user of page) {
      if (!user.emailAddress?.trim()) continue;
      const parsedEmail = z.email().safeParse(user.emailAddress.trim());
      if (!parsedEmail.success) continue;
      users.push({
        email: parsedEmail.data,
        name: user.displayName ?? parsedEmail.data,
        source: 'JIRA',
        avatarUrl: user.avatarUrls?.['48x48'],
        metadata: { self: user.self },
      });
    }

    if (page.length < maxResults) break;
    startAt += maxResults;
  }

  return users;
}

async function fetchLinearUsers(accessToken: string): Promise<UserSourcePerson[]> {
  const users: UserSourcePerson[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    pageCount += 1;
    if (pageCount > MAX_USER_SOURCE_PAGES) {
      throw providerFetchError(
        'LINEAR',
        `Exceeded maximum pagination limit (${MAX_USER_SOURCE_PAGES} pages)`,
      );
    }

    const data = await linearGraphQL<unknown>(
      accessToken,
      `query UserImport($cursor: String) {
        organization {
          users(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes { id name email active avatarUrl }
          }
        }
      }`,
      { cursor },
    );

    const parsedPage = linearUsersPageSchema.safeParse(data);
    if (!parsedPage.success) {
      throw providerFetchError('LINEAR', 'Invalid users GraphQL response shape');
    }

    const page = parsedPage.data.organization.users;
    for (const u of page.nodes) {
      if (!u.active) continue;
      if (!u.email?.trim()) continue;
      const parsedEmail = z.email().safeParse(u.email.trim());
      if (!parsedEmail.success) continue;
      users.push({
        email: parsedEmail.data,
        name: u.name,
        source: 'LINEAR',
        avatarUrl: u.avatarUrl,
        metadata: { linearId: u.id },
      });
    }

    if (!(page.pageInfo.hasNextPage && page.pageInfo.endCursor)) break;
    cursor = page.pageInfo.endCursor;
  }

  return users;
}

async function fetchGoogleWorkspaceUsers(accessToken: string): Promise<UserSourcePerson[]> {
  const users: UserSourcePerson[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    pageCount += 1;
    if (pageCount > MAX_USER_SOURCE_PAGES) {
      throw providerFetchError(
        'GOOGLE_WORKSPACE',
        `Exceeded maximum pagination limit (${MAX_USER_SOURCE_PAGES} pages)`,
      );
    }

    const url = new URL(
      'https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500',
    );
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await fetchJsonWithTimeout<unknown>(url.toString(), { headers });
    const parsed = googleDirectoryUsersPageSchema.safeParse(data);
    if (!parsed.success) {
      throw providerFetchError('GOOGLE_WORKSPACE', 'Invalid Directory API response shape');
    }

    for (const u of parsed.data.users ?? []) {
      if (u.suspended || u.archived) continue;
      const parsedEmail = z.email().safeParse(u.primaryEmail);
      if (!parsedEmail.success) continue;
      users.push({
        email: parsedEmail.data,
        name: u.name?.fullName ?? parsedEmail.data,
        source: 'GOOGLE_WORKSPACE',
        avatarUrl: u.thumbnailPhotoUrl,
        metadata: { googleId: u.id },
      });
    }

    pageToken = parsed.data.nextPageToken;
    if (!pageToken) break;
  }

  return users;
}

function mapSlackMember(member: {
  id: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_app_user?: boolean;
  profile: { email?: string; real_name?: string; image_72?: string };
}): UserSourcePerson | null {
  if (member.is_bot) return null;
  if (member.deleted) return null;
  if (member.is_app_user) return null;
  if (member.id === 'USLACKBOT') return null;
  if (!member.profile.email) return null;

  const parsedEmail = z.email().safeParse(member.profile.email);
  if (!parsedEmail.success) return null;

  return {
    email: parsedEmail.data,
    name: member.profile.real_name ?? member.profile.email,
    source: 'SLACK',
    avatarUrl: member.profile.image_72,
  };
}

async function fetchSlackUsers(accessToken: string): Promise<UserSourcePerson[]> {
  const users: UserSourcePerson[] = [];
  let cursor: string | undefined;
  let pageCount = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    pageCount += 1;
    if (pageCount > MAX_USER_SOURCE_PAGES) {
      throw providerFetchError(
        'SLACK',
        `Exceeded maximum pagination limit (${MAX_USER_SOURCE_PAGES} pages)`,
      );
    }

    const url = new URL('https://slack.com/api/users.list');
    url.searchParams.set('limit', '1000');
    if (cursor) url.searchParams.set('cursor', cursor);

    let raw: unknown;
    try {
      raw = await fetchJsonWithTimeout<unknown>(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (typeof status === 'number') {
        throw providerFetchError('SLACK', `users.list returned HTTP ${status}`);
      }
      throw err;
    }

    const parsed = slackUserListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw providerFetchError('SLACK', 'Invalid users.list response shape');
    }

    const data = parsed.data;
    if (!data.ok) {
      throw providerFetchError('SLACK', 'users.list returned ok=false');
    }
    if (!data.members?.length) break;

    for (const member of data.members) {
      const mapped = mapSlackMember(member);
      if (mapped) users.push(mapped);
    }

    cursor = data.response_metadata?.next_cursor;
    if (!cursor) break;
  }

  return users;
}

/** Registers built-in onboarding import fetchers. Safe to call after `clearUserSourceFetchers()`. */
export function registerBuiltInUserSourceFetchers(): void {
  registerUserSourceFetcher({
    providerId: 'JIRA',
    fetchUsers: fetchJiraUsers,
  });

  registerUserSourceFetcher({
    providerId: 'LINEAR',
    fetchUsers: accessToken => fetchLinearUsers(accessToken),
  });

  registerUserSourceFetcher({
    providerId: 'GOOGLE_WORKSPACE',
    fetchUsers: accessToken => fetchGoogleWorkspaceUsers(accessToken),
  });

  registerUserSourceFetcher({
    providerId: 'SLACK',
    fetchUsers: accessToken => fetchSlackUsers(accessToken),
  });
}

registerBuiltInUserSourceFetchers();
