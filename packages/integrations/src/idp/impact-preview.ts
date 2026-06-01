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
 * Microsoft Entra ID-specific impact metrics (Phase 78 CONTEXT.md D-10).
 *
 * `conditionalAccessPolicies` is the headline gate: a policy with session
 * controls that applies to the user can override a sign-out, so the impact
 * panel surfaces it as a non-blocking warning. `onPremisesSyncEnabled` is the
 * hybrid-AD signal the adapter HARD BLOCKS on before any mutation.
 */
export interface EntraImpactCustomMetrics {
  conditionalAccessPolicies: Array<{
    displayName: string;
    state: string;
    appliesToUser: boolean;
    hasSessionControls: boolean;
  }>;
  assignedLicenseSkus: string[];
  groupMembershipCount: number;
  onPremisesSyncEnabled: boolean;
  registeredDeviceCount: number;
  appRoleAssignmentCount: number;
}

/**
 * Okta-specific impact metrics (Phase 78 CONTEXT.md D-10).
 */
export interface OktaImpactCustomMetrics {
  assignedAppCount: number;
  enrolledFactorTypes: string[];
  groupMembershipCount: number;
  adminRoles: string[];
  linkedIdpCount: number;
}

/**
 * GitHub org-specific impact metrics (Phase 78 CONTEXT.md D-10).
 *
 * `outsideCollaboratorRepoCount` is the "back-door" signal: repos the user
 * keeps access to even after org-member removal. `authorizedPatCount` is `null`
 * when the org is NOT on SAML SSO (the per-PAT credential-authorizations API is
 * unavailable), distinct from `0` (SAML SSO org with zero authorized PATs).
 */
export interface GitHubImpactCustomMetrics {
  repositoryCount: number;
  teamMembershipCount: number;
  outsideCollaboratorRepoCount: number;
  pendingOrgInvitations: number;
  /** `null` when the org is not on SAML SSO (credential-authorizations API unavailable). */
  authorizedPatCount: number | null;
  isOrgOwner: boolean;
}

/**
 * Discriminated union returned by `Deprovisionable.describeImpact`. Narrow on
 * `provider` to access the provider-specific `customMetrics`.
 *
 * Phase 78 adds the `ENTRA`, `OKTA`, and `GITHUB` members WITHOUT modifying the
 * existing `GOOGLE_WORKSPACE` / `SLACK` ones. The `provider` discriminants are a
 * subset of the Prisma `DeprovisioningProvider` enum (`ENTRA`, NOT `ENTRA_ID`)
 * so the saga resolves adapters and the D-01 CI subset assertion stays green.
 */
export type ImpactPreview =
  | {
      provider: 'GOOGLE_WORKSPACE';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: GwsImpactCustomMetrics;
      /** ISO-8601 timestamp of when the underlying provider data was fetched. */
      fetchedAt: string;
    }
  | {
      provider: 'SLACK';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: SlackImpactCustomMetrics;
      fetchedAt: string;
    }
  | {
      provider: 'ENTRA';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: EntraImpactCustomMetrics;
      fetchedAt: string;
    }
  | {
      provider: 'OKTA';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: OktaImpactCustomMetrics;
      fetchedAt: string;
    }
  | {
      provider: 'GITHUB';
      commonMetrics: ImpactCommonMetrics;
      customMetrics: GitHubImpactCustomMetrics;
      fetchedAt: string;
    };

/** The `provider` discriminant literals carried by {@link ImpactPreview}. */
export type ImpactPreviewProvider = ImpactPreview['provider'];
