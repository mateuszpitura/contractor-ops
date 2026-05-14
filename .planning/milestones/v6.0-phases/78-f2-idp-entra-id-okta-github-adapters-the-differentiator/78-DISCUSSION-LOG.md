# Phase 78: F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 78-F2 IdP — Entra ID + Okta + GitHub Adapters (the differentiator)
**Areas discussed:** Entra pre-flight checks, GitHub auth model, OAuth connection topology, Provider preview data

---

## Entra Pre-Flight Checks

### Conditional Access Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Warning banner + proceed | Enumerate CA policies via Graph Policy.Read.All, show which policies exist that could override the revoke, admin chooses to proceed or cancel | |
| Risk-scored gate | Classify CA policies by risk level (HIGH/MEDIUM/LOW), block on HIGH, warn on MEDIUM, pass on LOW | |
| You decide | Let Claude pick the approach based on what Microsoft Graph actually exposes | ✓ |

**User's choice:** You decide
**Notes:** Deferred to research — depends on what Graph CA policy enumeration actually returns.

### Hybrid-AD Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-block + status panel link | Detect onPremisesSyncEnabled/dirSyncEnabled, refuse with message + link to status panel (mirrors v3.0 GWS pattern) | |
| Hard-block + manual task | Same detection, auto-create manual task in offboarding workflow with instructions | |
| You decide | Let Claude pick based on Phase 74 workflow integration patterns | ✓ |

**User's choice:** You decide
**Notes:** Deferred to research — either approach works, depends on Phase 74 patterns.

### Post-Revoke Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Single poll after 30s | Wait 30s, poll signInActivity.lastSignInDateTime. Simple, low API cost | |
| Retry poll with backoff | Poll at 30s, 60s, 120s. More robust against Graph propagation delays | |
| You decide | Let Claude pick based on Graph propagation guarantees | ✓ |

**User's choice:** You decide
**Notes:** Deferred to research — depends on Microsoft Graph propagation timing.

---

## GitHub Auth Model

### PAT Revocation

| Option | Description | Selected |
|--------|-------------|----------|
| SAML-authorized revoke | For SAML SSO orgs, use SAML credential-authorization API. Non-SAML orgs get warning | |
| Admin token delete | Use org admin token to delete/revoke PATs via GitHub API | |
| You decide | Let Claude pick based on what GitHub API supports | ✓ |

**User's choice:** You decide
**Notes:** Deferred to research — depends on GitHub API capabilities for org-level PAT revocation.

### Outside-Collaborator Repo Flagging

| Option | Description | Selected |
|--------|-------------|----------|
| Saga step + repo list | Create MANUAL_REVIEW saga step with repo list + GitHub links | |
| Offboarding workflow task | Create task in Phase 74 offboarding workflow with repo list | |
| You decide | Let Claude pick based on Phase 74/77 integration patterns | ✓ |

**User's choice:** You decide
**Notes:** Deferred to research — either approach integrates with existing patterns.

---

## OAuth Connection Topology

### Entra ID App Registration

| Option | Description | Selected |
|--------|-------------|----------|
| Separate app registration | New Azure AD app with admin-consent scopes. Separate IntegrationConnection row. Mirrors SLACK_ORG_GRID | |
| Shared app, scope upgrade | Extend existing Outlook Calendar app with additional scopes via prompt=consent | |
| You decide | Let Claude pick based on SLACK_ORG_GRID precedent and Microsoft best practices | ✓ |

**User's choice:** You decide
**Notes:** Deferred — Phase 77 SLACK_ORG_GRID established the separate-connection pattern.

### Okta Connection Model

| Option | Description | Selected |
|--------|-------------|----------|
| API token in IntegrationConnection | Admin pastes Okta API token. Stored encrypted. Similar to KSeF/Clockify pattern | |
| OAuth 2.0 for Okta | Use Okta's OAuth 2.0 for admin APIs. More complex but no manual token management | |
| You decide | Let Claude pick based on SDK support and existing patterns | ✓ |

**User's choice:** You decide
**Notes:** Deferred to research — depends on @okta/okta-sdk-nodejs@8.0.0 capabilities.

---

## Provider Preview Data

### Preview Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Rich provider-specific | Detailed custom metrics per provider: Entra (CA policies, licenses, groups, hybrid-AD, devices, app roles), Okta (apps, MFA, groups, roles, linked IdPs), GitHub (repos, teams, outside-collab repos, PATs, org owner) | ✓ |
| Minimal + warnings only | commonMetrics + only warning-worthy items | |
| You decide | Let Claude pick based on API availability | |

**User's choice:** Rich provider-specific
**Notes:** Maximum admin insight before committing to deprovisioning. Researcher should enumerate all available admin-read APIs per provider.

---

## Claude's Discretion

- Conditional Access detection approach (D-01)
- Hybrid-AD hard-block UX (D-02)
- Post-revoke signInActivity verification timing (D-03)
- GitHub PAT revocation mechanics (D-04)
- Outside-collaborator flagging task model (D-05)
- Entra app registration model — separate vs shared (D-07)
- Okta auth model — API token vs OAuth 2.0 (D-08)
- GitHub connection model — GitHub App vs OAuth App (D-09)

## Deferred Ideas

None — discussion stayed within phase scope.
