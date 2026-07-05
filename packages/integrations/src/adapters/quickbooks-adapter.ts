import type { PayrollFeed } from '@contractor-ops/payroll';
import { mapUsEmployeeToRow } from '@contractor-ops/payroll';
import { getServerEnv } from '@contractor-ops/validators';
import { z } from 'zod';

import { fetchWithTimeout } from '../services/fetch-helpers.js';
import { parseJsonResponse } from '../services/parse-json-response.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { OAuthConfig } from '../types/provider.js';
import { BaseAdapter } from './base-adapter.js';

const QUICKBOOKS_AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

const quickbooksTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  x_refresh_token_expires_in: z.number().optional(),
});

export interface QuickbooksEmployeePayload {
  name: string;
  ssn_last_4: string;
  work_state: string;
  filing_status: string;
  start_date: string;
}

export interface QuickbooksPayload {
  employees: QuickbooksEmployeePayload[];
}

/**
 * Map a PII-masked PayrollFeed to the QuickBooks Payroll employee-import JSON
 * shape. Pure — carries `ssn_last_4` only, never a full SSN.
 */
export function mapFeedToQuickbooksPayload(feed: PayrollFeed): QuickbooksPayload {
  return {
    employees: feed.employees.map(e => {
      const row = mapUsEmployeeToRow(e);
      return {
        name: row.fullName,
        ssn_last_4: row.ssnLast4,
        work_state: row.workState,
        filing_status: row.filingStatus,
        start_date: row.hireDate,
      };
    }),
  };
}

/**
 * QuickBooks Payroll (Intuit) native OAuth adapter. The live push path is dark
 * behind payroll.quickbooks (client id/secret optional in the env schema); the
 * QuickBooks CSV export is the shipping fallback.
 */
export class QuickBooksAdapter extends BaseAdapter {
  readonly slug = 'quickbooks';
  readonly displayName = 'QuickBooks Payroll';
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;

  override getOAuthConfig(): OAuthConfig {
    return {
      clientIdEnvVar: 'QUICKBOOKS_CLIENT_ID',
      clientSecretEnvVar: 'QUICKBOOKS_CLIENT_SECRET',
      authorizationUrl: QUICKBOOKS_AUTHORIZE_URL,
      tokenUrl: QUICKBOOKS_TOKEN_URL,
      scopes: ['com.intuit.quickbooks.payroll', 'openid'],
      redirectPath: '/api/oauth/quickbooks/callback',
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
      throw new Error('No refresh token available for QuickBooks');
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
    const clientId = env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = env.QUICKBOOKS_CLIENT_SECRET;
    if (!(clientId && clientSecret)) {
      throw new Error(
        'QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET environment variables are required',
      );
    }

    const response = await fetchWithTimeout(
      QUICKBOOKS_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body,
      },
      { timeoutMs: 30_000, retries: 0 },
    );
    if (!response.ok) {
      throw new Error(`QuickBooks OAuth token exchange failed: ${await response.text()}`);
    }
    const data = await parseJsonResponse(
      response,
      quickbooksTokenResponseSchema,
      'quickbooks:redeemToken',
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
    };
  }
}
