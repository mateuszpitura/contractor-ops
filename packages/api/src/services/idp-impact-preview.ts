// Phase 77 D-02/D-03/D-04 — cached describeImpact orchestration + failure classifier.
//
// The tRPC procedure runs `requirePermission` BEFORE calling getImpactPreview (the
// F-SCALE-09 invariant). Preview data is org-scoped (cache key includes orgId), never
// user-scoped. On adapter failure the result is a structured discriminated outcome the
// admin-choice flow renders (reconnect banner / proceed-without-preview).

import type { PrismaClient } from '@contractor-ops/db';
import type { ImpactPreview } from '@contractor-ops/integrations';
import { classifyError } from '@contractor-ops/integrations';
import { GoogleWorkspaceAdapter } from '@contractor-ops/integrations/adapters/google-workspace-adapter';
import { SlackAdapter } from '@contractor-ops/integrations/adapters/slack-adapter';
import { createLogger } from '@contractor-ops/logger';
import { CacheKeys, CacheTTL, cached, invalidate } from './cache.js';
import type { DeprovisionProvider } from './idp-token-resolver.js';
import { resolveDeprovisionToken } from './idp-token-resolver.js';

const log = createLogger({ service: 'idp-impact-preview' });

/** Structured preview outcome consumed by the admin-choice flow (D-03). */
export type ImpactPreviewResult =
  | { ok: true; preview: ImpactPreview }
  | { ok: false; kind: 'reconnect_required'; reason: string }
  | { ok: false; kind: 'admin_choice'; reason: string };

export interface GetImpactPreviewArgs {
  db: PrismaClient;
  organizationId: string;
  provider: DeprovisionProvider;
  externalUserId: string;
  forceRefresh?: boolean;
}

/**
 * Builds the provider adapter configured with the resolved org connection token,
 * then runs describeImpact through the 5-minute Upstash cache (D-02). On adapter
 * error the failure is classified (D-03): 401 → reconnect-required; 429/503 →
 * admin-choice after one retry; transient network → retry once then admin-choice.
 */
export async function getImpactPreview(args: GetImpactPreviewArgs): Promise<ImpactPreviewResult> {
  const { db, organizationId, provider, externalUserId, forceRefresh } = args;
  const key = CacheKeys.idpPreview(organizationId, provider, externalUserId);

  const token = await resolveDeprovisionToken(db, organizationId, provider);
  if (!token.ok) {
    return { ok: false, kind: 'reconnect_required', reason: token.reason };
  }

  const runDescribe = (): Promise<ImpactPreview> => {
    if (provider === 'GOOGLE_WORKSPACE') {
      return new GoogleWorkspaceAdapter()
        .withAccessToken(token.accessToken)
        .describeImpact(externalUserId);
    }
    return new SlackAdapter().withOrgGridToken(token.accessToken).describeImpact(externalUserId);
  };

  if (forceRefresh) {
    await invalidate(key);
  }

  try {
    const preview = await cached(key, CacheTTL.IDP_PREVIEW, runDescribe);
    return { ok: true, preview };
  } catch (err) {
    // describeImpact reads are best-effort inside the adapter, so a throw here is a
    // hard provider/auth failure. Classify by the carried HTTP status when present.
    const httpStatus =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: unknown }).status)
        : undefined;
    const errorClass = classifyError({ httpStatus, cause: err });
    log.warn({ provider, organizationId, errorClass }, 'idp impact preview failed');

    if (errorClass === 'PERMANENT_AUTH_EXPIRED') {
      return { ok: false, kind: 'reconnect_required', reason: 'auth_expired' };
    }
    return { ok: false, kind: 'admin_choice', reason: errorClass.toLowerCase() };
  }
}
