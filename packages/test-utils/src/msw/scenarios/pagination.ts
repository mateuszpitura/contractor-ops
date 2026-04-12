import { HttpResponse, http } from 'msw';
import { mockId, pastDate } from '../utils.js';

/**
 * Handlers for testing pagination edge cases:
 * - Token expiry mid-pagination (401 on page 3)
 * - Empty results with total > 0
 * - Malformed nextPageToken
 * - Large result sets requiring multiple pages
 */

/**
 * Jira search that returns 3 pages of results, with 401 on page 2 (token expired).
 * Tests that the system refreshes the token and retries the page.
 */
export function jiraPaginatedWithTokenExpiry() {
  let page2Attempts = 0;

  return [
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/search', ({ request }) => {
      const url = new URL(request.url);
      const startAt = parseInt(url.searchParams.get('startAt') ?? '0', 10);

      // Page 1: success
      if (startAt === 0) {
        return HttpResponse.json({
          total: 30,
          startAt: 0,
          maxResults: 10,
          issues: Array.from({ length: 10 }, (_, i) => ({
            id: String(10000 + i),
            key: `TEST-${i + 1}`,
            fields: {
              summary: `Issue ${i + 1}`,
              status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
            },
          })),
        });
      }

      // Page 2: first attempt returns 401, second succeeds
      if (startAt === 10) {
        page2Attempts++;
        if (page2Attempts === 1) {
          return HttpResponse.json({ message: 'Token expired' }, { status: 401 });
        }
        return HttpResponse.json({
          total: 30,
          startAt: 10,
          maxResults: 10,
          issues: Array.from({ length: 10 }, (_, i) => ({
            id: String(10010 + i),
            key: `TEST-${i + 11}`,
            fields: {
              summary: `Issue ${i + 11}`,
              status: { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
            },
          })),
        });
      }

      // Page 3: final page
      return HttpResponse.json({
        total: 30,
        startAt: 20,
        maxResults: 10,
        issues: Array.from({ length: 10 }, (_, i) => ({
          id: String(10020 + i),
          key: `TEST-${i + 21}`,
          fields: {
            summary: `Issue ${i + 21}`,
            status: { id: '5', name: 'Done', statusCategory: { key: 'done' } },
          },
        })),
      });
    }),

    // Token refresh succeeds
    http.post('https://auth.atlassian.com/oauth/token', () => {
      return HttpResponse.json({
        access_token: `refreshed_${mockId()}`,
        refresh_token: `new_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }),
  ];
}

/**
 * Jira search that returns total=5 but the issues array is empty.
 * Tests graceful handling when API lies about total count.
 */
export function jiraEmptyPagesWithNonZeroTotal() {
  return [
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/search', () => {
      return HttpResponse.json({
        total: 5,
        startAt: 0,
        maxResults: 50,
        issues: [], // Empty despite total=5
      });
    }),
  ];
}

/**
 * Clockify time entries with multiple pages.
 * Returns entries on pages 1-2, empty on page 3 (end signal).
 */
export function clockifyPaginated() {
  return [
    http.get(
      'https://api.clockify.me/api/v1/workspaces/:workspaceId/user/:userId/time-entries',
      ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') ?? '1', 10);

        if (page <= 2) {
          return HttpResponse.json(
            Array.from({ length: 50 }, (_, i) => ({
              id: mockId(),
              description: `Entry page ${page} item ${i}`,
              timeInterval: {
                start: pastDate(page * 24 + i),
                end: pastDate(page * 24 + i - 1),
                duration: 'PT1H0M0S',
              },
              projectId: 'proj-001',
              project: { name: 'Test Project' },
              taskId: null,
              billable: true,
              userId: 'user-001',
              workspaceId: 'ws-001',
            })),
          );
        }

        // Page 3+: empty = stop
        return HttpResponse.json([]);
      },
    ),
  ];
}

/**
 * Google Workspace directory with multi-page user listing.
 * Page 1 returns 2 users + nextPageToken, page 2 returns 1 user + no token.
 */
export function googleWorkspacePaginated() {
  return [
    http.get('https://admin.googleapis.com/admin/directory/v1/users', ({ request }) => {
      const url = new URL(request.url);
      const pageToken = url.searchParams.get('pageToken');

      if (!pageToken) {
        // Page 1
        return HttpResponse.json({
          users: [
            {
              id: 'user-001',
              primaryEmail: 'alice@company.com',
              name: { givenName: 'Alice', familyName: 'A', fullName: 'Alice A' },
              suspended: false,
              isAdmin: false,
            },
            {
              id: 'user-002',
              primaryEmail: 'bob@company.com',
              name: { givenName: 'Bob', familyName: 'B', fullName: 'Bob B' },
              suspended: false,
              isAdmin: false,
            },
          ],
          nextPageToken: 'page2token',
        });
      }

      // Page 2 (final)
      return HttpResponse.json({
        users: [
          {
            id: 'user-003',
            primaryEmail: 'carol@company.com',
            name: { givenName: 'Carol', familyName: 'C', fullName: 'Carol C' },
            suspended: true,
            isAdmin: false,
          },
        ],
        // No nextPageToken = last page
      });
    }),
  ];
}

/**
 * Google Workspace groups — 404 when user has no groups.
 */
export function googleWorkspaceGroupsNotFound() {
  return [
    http.get('https://admin.googleapis.com/admin/directory/v1/groups', () => {
      return HttpResponse.json({ error: { code: 404, message: 'Not Found' } }, { status: 404 });
    }),
  ];
}
