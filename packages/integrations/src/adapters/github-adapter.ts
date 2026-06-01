import { Octokit } from '@octokit/rest';
import { mapErrorClassToResult } from '../idp/deprovision-result.js';
import type { ErrorClass } from '../idp/error-classifier.js';
import { classifyError } from '../idp/error-classifier.js';
import type { GitHubImpactCustomMetrics, ImpactPreview } from '../idp/impact-preview.js';
import { pLimit } from '../services/concurrency.js';
import {
  canonicalizeRequest,
  canonicalizeResponse,
  sha256Hex,
} from '../services/saga-canonicalize.js';
import type { Deprovisionable, DeprovisionResult } from '../types/deprovisionable.js';
import { BaseAdapter } from './base-adapter.js';

/**
 * GitHub org `Deprovisionable` adapter (Phase 78 IDP-07) — the provider with a
 * fundamentally different authorization model.
 *
 * Uses `@octokit/rest` with a GitHub-App installation token or classic
 * `admin:org` token decrypted from `IntegrationConnection.credentials`
 * (CONTEXT.md D-09). `externalUserId` is the GitHub username/login.
 *
 * Key model differences vs the IdP providers:
 *   - suspendAccount    → orgs.removeMember (removes org membership + team access)
 *   - revokeAllSessions → per-PAT credential-authorizations revoke, SAML-SSO ONLY;
 *                         a non-SAML org degrades to SUCCEEDED-with-warning, never FAILED
 *   - outside-collaborator repos SURVIVE org removal (Pitfall 7 "back-door") —
 *                         flagged via describeImpact.outsideCollaboratorRepoCount,
 *                         NEVER silently treated as fully deprovisioned
 *   - verifyDeprovisioned → checkMembershipForUser 404 / membership !== active → true
 *
 * Octokit errors are classified via classifyError({ provider:'GITHUB', httpStatus,
 * responseHeaders }) so a 403 secondary-rate-limit (TRANSIENT) is distinguished
 * from a 403 auth-forbidden (PERMANENT). Auth token / PAT values are NEVER logged
 * or embedded in errors (only the already-masked `token_last_eight` may surface).
 */
export class GitHubAdapter extends BaseAdapter implements Deprovisionable {
  readonly slug = 'github';
  readonly displayName = 'GitHub';
  readonly supportsOAuth = true; // GitHub App installation (D-09)
  readonly supportsWebhooks = false;

  #org = '';
  #token = '';

  /** Configure the org login + installation/classic token (saga step-runner). */
  withCredentials(org: string, token: string): this {
    this.#org = org;
    this.#token = token;
    return this;
  }

  #octokit(): Octokit {
    return new Octokit({ auth: this.#token });
  }

  /** Best-effort HTTP status from an Octokit RequestError (surfaces `status`). */
  static #httpStatus(err: unknown): number | undefined {
    if (err && typeof err === 'object' && 'status' in err) {
      const s = (err as { status: unknown }).status;
      if (typeof s === 'number') return s;
    }
    return;
  }

  /** Lower-cased response headers from an Octokit error (for rate-limit detection). */
  static #responseHeaders(err: unknown): Record<string, string | undefined> | undefined {
    if (err && typeof err === 'object' && 'response' in err) {
      const resp = (err as { response?: { headers?: Record<string, string | undefined> } })
        .response;
      return resp?.headers;
    }
    return;
  }

  static #classify(err: unknown): ErrorClass {
    const httpStatus = GitHubAdapter.#httpStatus(err);
    if (httpStatus === undefined) return classifyError({ provider: 'GITHUB', cause: err });
    return classifyError({
      provider: 'GITHUB',
      httpStatus,
      responseHeaders: GitHubAdapter.#responseHeaders(err),
    });
  }

  async suspendAccount(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ op: 'removeMember', org: this.#org, username: externalUserId }),
    );
    try {
      await this.#octokit().rest.orgs.removeMember({ org: this.#org, username: externalUserId });
      return {
        status: 'SUCCEEDED',
        requestSha256,
        responseSha256: sha256Hex(canonicalizeResponse({ op: 'removeMember', ok: true })),
      };
    } catch (err) {
      return this.#mapFailure(err, requestSha256, 'removeMember');
    }
  }

  async revokeAllSessions(externalUserId: string): Promise<DeprovisionResult> {
    const requestSha256 = sha256Hex(
      canonicalizeRequest({ op: 'revokeCredentialAuthorizations', org: this.#org }),
    );
    const octokit = this.#octokit();

    // Step 1 — enumerate per-PAT credential authorizations (SAML SSO + Enterprise
    // Cloud only). A 403/404 here means the org is NOT on SAML SSO: degrade to
    // SUCCEEDED-with-warning, never FAILED (D-04 / T-78-05-02).
    let auths: Array<{ login?: string; credential_id?: number; token_last_eight?: string }>;
    try {
      auths = await octokit.paginate('GET /orgs/{org}/credential-authorizations', {
        org: this.#org,
      });
    } catch (err) {
      const status = GitHubAdapter.#httpStatus(err);
      if (status === 403 || status === 404) {
        return {
          status: 'SUCCEEDED',
          requestSha256,
          responseSha256: sha256Hex(canonicalizeResponse({ samlSso: false })),
          reason: 'Per-PAT revocation unavailable (org not on SAML SSO)',
          errorMessage: 'Per-PAT revocation unavailable (org not on SAML SSO)',
        };
      }
      return this.#mapFailure(err, requestSha256, 'listCredentialAuthorizations');
    }

    // Step 2 — revoke each matching PAT (capped concurrency). A transient failure
    // on any PAT marks the step FAILED so QStash retries; a permanent forbidden
    // surfaces as FAILED for the reconcile queue.
    const matches = auths.filter(a => a.login === externalUserId);
    const limit = pLimit(5);
    const masked: string[] = [];
    let transientErr: unknown;
    let permanentErr: unknown;

    await Promise.all(
      matches
        .map(a => a.credential_id)
        .filter((id): id is number => typeof id === 'number')
        .map(credentialId =>
          limit(async () => {
            try {
              await octokit.request(
                'DELETE /orgs/{org}/credential-authorizations/{credential_id}',
                { org: this.#org, credential_id: credentialId },
              );
              const match = matches.find(m => m.credential_id === credentialId);
              if (match?.token_last_eight) masked.push(match.token_last_eight);
            } catch (err) {
              // 404 ⇒ already revoked (idempotent success).
              if (GitHubAdapter.#httpStatus(err) === 404) return;
              const cls = GitHubAdapter.#classify(err);
              if (cls === 'TRANSIENT_RATE_LIMIT' || cls === 'TRANSIENT_NETWORK') transientErr = err;
              else permanentErr = err;
            }
          }),
        ),
    );

    if (transientErr) return this.#mapFailure(transientErr, requestSha256, 'revokeCredential');
    const responseSha256 = sha256Hex(
      canonicalizeResponse({ revoked: masked.length, lastEight: masked.sort() }),
    );
    if (permanentErr) {
      const cls = GitHubAdapter.#classify(permanentErr);
      return {
        status: 'FAILED',
        failureKind: cls === 'PERMANENT_AUTH_EXPIRED' ? 'AUTH_REVOKED' : 'PROVIDER_ERROR',
        errorClass: cls,
        errorMessage: `github credential revoke failed (${cls})`,
        requestSha256,
        responseSha256,
      };
    }

    return {
      status: 'SUCCEEDED',
      requestSha256,
      responseSha256,
      reason: `revoked ${masked.length} per-PAT credential authorization(s)`,
    };
  }

  async verifyDeprovisioned(externalUserId: string): Promise<boolean> {
    const octokit = this.#octokit();
    try {
      await octokit.rest.orgs.checkMembershipForUser({ org: this.#org, username: externalUserId });
      // 204 resolves ⇒ still a member ⇒ not deprovisioned.
      return false;
    } catch (err) {
      if (GitHubAdapter.#httpStatus(err) === 404) return true; // not a member ⇒ gone
    }
    // Fallback: an explicit membership state !== 'active' also counts as gone.
    try {
      const membership = await octokit.rest.orgs.getMembershipForUser({
        org: this.#org,
        username: externalUserId,
      });
      return membership.data.state !== 'active';
    } catch (err) {
      return GitHubAdapter.#httpStatus(err) === 404;
    }
  }

  async describeImpact(externalUserId: string): Promise<ImpactPreview> {
    const cacheKey = `co:idp:preview:GITHUB:${externalUserId}`;
    const fetchedAt = new Date().toISOString();
    const octokit = this.#octokit();

    // Membership read — accountStatus + isOrgOwner. A total failure here throws
    // for the Phase 77 D-03 proceed-without-preview flow.
    let accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND' = 'ACTIVE';
    let isOrgOwner = false;
    try {
      const membership = await octokit.rest.orgs.getMembershipForUser({
        org: this.#org,
        username: externalUserId,
      });
      accountStatus = membership.data.state === 'active' ? 'ACTIVE' : 'SUSPENDED';
      isOrgOwner = membership.data.role === 'admin';
    } catch (err) {
      if (GitHubAdapter.#httpStatus(err) === 404) {
        accountStatus = 'NOT_FOUND';
      } else {
        throw new Error('github describeImpact failed: membership read unavailable');
      }
    }

    const repositoryCount = await GitHubAdapter.#countPaginate(octokit, 'GET /orgs/{org}/repos', {
      org: this.#org,
    });
    const teamMembershipCount = await GitHubAdapter.#countPaginate(
      octokit,
      'GET /orgs/{org}/teams',
      { org: this.#org },
    );

    // Outside-collaborator back-door (Pitfall 7): repos the user keeps after org
    // removal. Surfaced as the headline warning metric.
    let outsideCollaboratorRepoCount = 0;
    try {
      const collaborators = await octokit.paginate('GET /orgs/{org}/outside_collaborators', {
        org: this.#org,
      });
      if (collaborators.some((c: { login?: string }) => c.login === externalUserId)) {
        // The user is an outside collaborator — count org repos they collaborate on.
        outsideCollaboratorRepoCount = await GitHubAdapter.#countOutsideCollabRepos(
          octokit,
          this.#org,
          externalUserId,
        );
      }
    } catch {
      outsideCollaboratorRepoCount = 0;
    }

    const pendingOrgInvitations = await GitHubAdapter.#countPaginate(
      octokit,
      'GET /orgs/{org}/invitations',
      { org: this.#org },
      (inv: { login?: string }) => inv.login === externalUserId,
    );

    // authorizedPatCount: null when the org is NOT on SAML SSO (endpoint 403/404).
    let authorizedPatCount: number | null = null;
    try {
      const auths = (await octokit.paginate('GET /orgs/{org}/credential-authorizations', {
        org: this.#org,
      })) as Array<{ login?: string }>;
      authorizedPatCount = auths.filter(a => a.login === externalUserId).length;
    } catch {
      authorizedPatCount = null;
    }

    const customMetrics: GitHubImpactCustomMetrics = {
      repositoryCount,
      teamMembershipCount,
      outsideCollaboratorRepoCount,
      pendingOrgInvitations,
      authorizedPatCount,
      isOrgOwner,
    };

    return {
      provider: 'GITHUB',
      commonMetrics: {
        externalUserId,
        externalUserDisplayName: externalUserId,
        accountStatus,
        sessionCount: null,
      },
      customMetrics,
      fetchedAt,
      cacheKey,
    };
  }

  /** Best-effort paginated count (→ 0 on failure), optionally filtered. */
  static async #countPaginate(
    octokit: Octokit,
    route: string,
    params: Record<string, unknown>,
    filter?: (item: Record<string, unknown>) => boolean,
  ): Promise<number> {
    try {
      const items = (await octokit.paginate(route, params)) as Array<Record<string, unknown>>;
      return filter ? items.filter(filter).length : items.length;
    } catch {
      return 0;
    }
  }

  /** Count org repos where `username` is a direct collaborator (best-effort, → 0). */
  static async #countOutsideCollabRepos(
    octokit: Octokit,
    org: string,
    username: string,
  ): Promise<number> {
    try {
      const repos = (await octokit.paginate('GET /orgs/{org}/repos', { org })) as Array<{
        name?: string;
      }>;
      const limit = pLimit(5);
      const flags = await Promise.all(
        repos
          .map(r => r.name)
          .filter((n): n is string => typeof n === 'string')
          .map(repo =>
            limit(async () => {
              try {
                await octokit.rest.repos.checkCollaborator({ owner: org, repo, username });
                return 1; // 204 ⇒ is a collaborator
              } catch {
                return 0; // 404 ⇒ not a collaborator on this repo
              }
            }),
          ),
      );
      return flags.reduce<number>((sum, f) => sum + f, 0);
    } catch {
      return 0;
    }
  }

  /**
   * Maps an Octokit error to a DeprovisionResult via the closed-enum classifier.
   * 404 → LIKELY_GONE (already not a member); TRANSIENT_* re-throws for QStash
   * retry; a 403 rate-limit is TRANSIENT, a 403 forbidden is PERMANENT (D-13).
   */
  #mapFailure(err: unknown, requestSha256: string, op: string): DeprovisionResult {
    const httpStatus = GitHubAdapter.#httpStatus(err);
    const errorClass = GitHubAdapter.#classify(err);
    const responseSha256 = sha256Hex(canonicalizeResponse({ op, httpStatus: httpStatus ?? null }));
    return mapErrorClassToResult(errorClass, {
      requestSha256,
      responseSha256,
      notFoundReason: 'not_a_member',
      transientDetail: `github transient failure (${httpStatus ?? 'network'})`,
      failedDetail: `github deprovision failed (${httpStatus ?? 'unknown'}/${errorClass})`,
    });
  }
}
