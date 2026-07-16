// Authentication for the Contractor Ops Zapier app.
//
// The shipping scheme is a custom API-key field: the user pastes a
// `co_live_…` (production) or `co_test_…` (free sandbox) key, which every
// request carries as a bearer token. An OAuth 2.0 authorization-code variant is
// scaffolded below for a future partner-hosted flow, but is intentionally not
// wired into the app — the platform contract accepts either scheme and the key
// flow needs no partner OAuth client to ship.

import type { ZapierAuthentication } from '@contractor-ops/marketplace-manifests';
import type { Authentication, AuthField, BeforeRequestMiddleware } from 'zapier-platform-core';

import { toHttpMethod } from './http-method.js';

/** The header every authenticated request carries the API key on. */
export const API_KEY_HEADER = 'Authorization';

const AUTH_FIELD_TYPES = [
  'string',
  'number',
  'boolean',
  'datetime',
  'copy',
  'password',
  'integer',
  'text',
] as const;

/** Narrow a generated field type onto the platform's auth-field type union. */
function toAuthFieldType(type: string): AuthField['type'] {
  return AUTH_FIELD_TYPES.find(known => known === type) ?? 'string';
}

/**
 * Map the generated custom API-key authentication onto the platform shape. The
 * field set, connection test, and label all come from the generated definition
 * so the app never diverges from the API contract.
 */
export function buildAuthentication(generated: ZapierAuthentication): Authentication {
  const fields: AuthField[] = generated.fields.map(field => ({
    key: field.key,
    label: field.label,
    required: field.required,
    type: toAuthFieldType(field.type),
    helpText: field.helpText,
  }));

  return {
    type: 'custom',
    fields,
    test: { url: generated.test.url, method: toHttpMethod(generated.test.method) },
    connectionLabel: generated.connectionLabel,
  };
}

/**
 * Attach the user's API key as a bearer token on every outgoing request. Custom
 * auth has no built-in credential injection, so this middleware is the single
 * place the key reaches the wire.
 */
export const addApiKeyHeader: BeforeRequestMiddleware = (request, _z, bundle) => {
  const apiKey = bundle.authData?.apiKey;
  if (apiKey) {
    request.headers = { ...request.headers, [API_KEY_HEADER]: `Bearer ${apiKey}` };
  }
  return request;
};

/**
 * OAuth 2.0 authorization-code variant, scaffolded for a future partner-hosted
 * connection. It is exported for reference and tests but is not attached to the
 * app — the custom API-key scheme is what ships. Wiring this in requires a
 * registered OAuth client (`CLIENT_ID` / `CLIENT_SECRET`) and the hosted
 * authorize/token endpoints, tracked as a deferred enablement step.
 */
export const oauth2Authentication: Authentication = {
  type: 'oauth2',
  test: { url: '{{process.env.BASE_URL}}/v1/health', method: 'GET' },
  oauth2Config: {
    authorizeUrl: {
      url: '{{process.env.BASE_URL}}/oauth/authorize',
      params: {
        client_id: '{{process.env.CLIENT_ID}}',
        state: '{{bundle.inputData.state}}',
        redirect_uri: '{{bundle.inputData.redirect_uri}}',
        response_type: 'code',
      },
    },
    getAccessToken: {
      url: '{{process.env.BASE_URL}}/oauth/token',
      method: 'POST',
      body: {
        code: '{{bundle.inputData.code}}',
        client_id: '{{process.env.CLIENT_ID}}',
        client_secret: '{{process.env.CLIENT_SECRET}}',
        grant_type: 'authorization_code',
        redirect_uri: '{{bundle.inputData.redirect_uri}}',
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    refreshAccessToken: {
      url: '{{process.env.BASE_URL}}/oauth/token',
      method: 'POST',
      body: {
        refresh_token: '{{bundle.authData.refresh_token}}',
        client_id: '{{process.env.CLIENT_ID}}',
        client_secret: '{{process.env.CLIENT_SECRET}}',
        grant_type: 'refresh_token',
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    scope: 'read write',
    autoRefresh: true,
  },
};
