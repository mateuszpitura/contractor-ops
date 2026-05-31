// Phase 77 D-01 — `describeImpact` return type.
//
// `ImpactPreview` is a discriminated union keyed on `provider`. The saga UI
// (77-05) narrows on `provider` with an exhaustive `switch` to render the
// per-provider impact panel. Phase 78 adds new members (Entra, Okta, …)
// WITHOUT modifying the existing ones. A CI lint
// (`impact-preview-union.test.ts`, 77-01-10) asserts the union's `provider`
// literals are a subset of the Prisma `DeprovisioningProvider` enum.

/**
 * Provider-agnostic metrics rendered for every IdP in the impact panel.
 */
export interface ImpactCommonMetrics {
  externalUserId: string;
  externalUserDisplayName: string;
  /** Live account state at the provider; NOT_FOUND ⇒ already deprovisioned. */
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND';
  /** Active session count; `null` when the provider does not expose it. */
  sessionCount: number | null;
}

/**
 * Google Workspace-specific impact metrics (CONTEXT.md D-01 / D-04).
 */
export interface GwsImpactCustomMetrics {
  /** Third-party OAuth grants that will be revoked. */
  oauthGrants: Array<{ appName: string; scopes: string[] }>;
  isSuperAdmin: boolean;
  /** Shared/My-Drive ownership count; `null` when unavailable (best-effort). */
  drivesOwnedCount: number | null;
}

/**
 * Slack-specific impact metrics (CONTEXT.md D-01 / D-04).
 */
export interface SlackImpactCustomMetrics {
  channelsMemberCount: number | null;
  ownedChannelCount: number | null;
  installedAppCount: number | null;
  isWorkspaceAdmin: boolean;
  isOrgOwner: boolean;
  /**
   * Set to `NOT_ON_ENTERPRISE_GRID` when `users.lookupByEmail` returns
   * `cannot_perform_operation` (the canonical workspace-only signal, D-14).
   */
  error?: 'NOT_ON_ENTERPRISE_GRID' | null;
}

/**
 * Discriminated union returned by `Deprovisionable.describeImpact`. Narrow on
 * `provider` to access the provider-specific `customMetrics`.
 */
export type ImpactPreview =
  | {
      provider: 'GOOGLE_WORKSPACE';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: GwsImpactCustomMetrics;
      /** ISO-8601 timestamp of when the underlying provider data was fetched. */
      fetchedAt: string;
      /** `co:idp:preview:{provider}:{externalUserId}` Redis cache key (D-02). */
      cacheKey: string;
    }
  | {
      provider: 'SLACK';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: SlackImpactCustomMetrics;
      fetchedAt: string;
      cacheKey: string;
    };

/** The `provider` discriminant literals carried by {@link ImpactPreview}. */
export type ImpactPreviewProvider = ImpactPreview['provider'];
