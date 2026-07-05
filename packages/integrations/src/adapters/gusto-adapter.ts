import type { PayrollFeed } from '@contractor-ops/payroll';
import { mapUsEmployeeToRow } from '@contractor-ops/payroll';
import { getServerEnv } from '@contractor-ops/validators';
import { z } from 'zod';

import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

const GUSTO_AUTHORIZE_URL = 'https://api.gusto.com/oauth/authorize';
const GUSTO_TOKEN_URL = 'https://api.gusto.com/oauth/token';

const gustoTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().optional(),
});

export interface GustoEmployeePayload {
  first_name: string;
  last_name: string;
  ssn_last_4: string;
  work_state: string;
  filing_status: string;
  start_date: string;
}

export interface GustoPayload {
  employees: GustoEmployeePayload[];
}

/**
 * Map a PII-masked PayrollFeed to the Gusto employee-import JSON shape. Pure —
 * carries `ssn_last_4` only, never a full SSN.
 */
export function mapFeedToGustoPayload(feed: PayrollFeed): GustoPayload {
  return {
    employees: feed.employees.map(e => {
      const row = mapUsEmployeeToRow(e);
      return {
        first_name: row.firstName,
        last_name: row.lastName,
        ssn_last_4: row.ssnLast4,
        work_state: row.workState,
        filing_status: row.filingStatus,
        start_date: row.hireDate,
      };
    }),
  };
}

/**
 * Gusto Payroll native OAuth adapter. The live push path is dark behind
 * payroll.gusto (client id/secret optional in the env schema); the Gusto CSV
 * export is the shipping fallback.
 */
export class GustoAdapter extends BaseAdapter {
  readonly slug = 'gusto';
  readonly displayName = 'Gusto Payroll';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  override getOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: 'GUSTO_CLIENT_ID',
      clientSecretEnvVar: 'GUSTO_CLIENT_SECRET',
      authorizationUrl: GUSTO_AUTHORIZE_URL,
      tokenUrl: GUSTO_TOKEN_URL,
      scopes: ['employees:read', 'employees:write', 'payrolls:read'],
      redirectPath: '/api/oauth/gusto/callback',
    };
  }

  override async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
    return this.redeemToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    );
  }

  override async refreshToken(credentials: CredentialBlob): Promise<CredentialBlob> {
    if (!credentials.refreshToken) {
      throw new Error('No refresh token available for Gusto');
    }
    return this.redeemToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credentials.refreshToken,
      }),
    );
  }

  private async redeemToken(body: URLSearchParams): Promise<CredentialBlob> {
    const env = getServerEnv();
    const clientId = env.GUSTO_CLIENT_ID;
    const clientSecret = env.GUSTO_CLIENT_SECRET;
    if (!(clientId && clientSecret)) {
      throw new Error('GUSTO_CLIENT_ID and GUSTO_CLIENT_SECRET environment variables are required');
    }
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);

    const response = await fetchWithTimeout(
      GUSTO_TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
      { timeoutMs: 30_000, retries: 0 },
    );
    if (!response.ok) {
      throw new Error(`Gusto OAuth token exchange failed: ${await response.text()}`);
    }
    const data = await parseJsonResponse(response, gustoTokenResponseSchema, 'gusto:redeemToken');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
    };
  }
}
