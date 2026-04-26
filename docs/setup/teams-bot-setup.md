# Microsoft Teams Bot Setup Guide

This guide walks through registering and configuring an Azure Bot Service for Microsoft Teams integration with Contractor Ops. After completing these steps, the bot will be able to send approval cards, reminders, and activity alerts directly in Teams.

## Prerequisites

- Azure account with an active subscription
- Admin access to your Microsoft Teams tenant (or a Teams admin who can grant consent)
- Contractor Ops deployed with a public HTTPS endpoint (e.g., `https://your-domain.com`)

## Step 1: Create Azure AD App Registration

1. Navigate to **Azure Portal** > **App registrations** > **New registration**
2. Fill in:
   - **Name:** `Contractor Ops Teams Bot` (or your preferred name)
   - **Supported account types:** `Accounts in any organizational directory (Any Azure AD directory - Multitenant)` for multi-tenant, or `Accounts in this organizational directory only (Single tenant)` for single-tenant
   - **Redirect URI:** Leave blank (the bot handles its own authentication)
3. Click **Register**
4. On the **Overview** page, copy the **Application (client) ID** -- this is your `AZURE_BOT_APP_ID`
5. Navigate to **Certificates & secrets** > **Client secrets** > **New client secret**
   - Description: `Contractor Ops Bot Secret`
   - Expiry: Choose your preferred expiration (recommended: 24 months)
6. Copy the **Value** (not the Secret ID) -- this is your `AZURE_BOT_APP_SECRET`

> **Important:** Copy the secret value immediately. It will not be shown again after you navigate away.

> **Note on multi-tenant:** Microsoft deprecated new multi-tenant bot registrations after July 2025. If you cannot create a multi-tenant registration, use single-tenant configuration. The bot will still work within your organization's Teams tenant.

## Step 2: Create Azure Bot Service

1. Navigate to **Azure Portal** > **Create a resource** > search for **Azure Bot**
2. Click **Create** and fill in:
   - **Bot handle:** `contractor-ops-bot` (must be globally unique)
   - **Subscription:** Your Azure subscription
   - **Resource group:** Create new or use existing
   - **Pricing tier:** `F0 (Free)` for development and testing, `S1 (Standard)` for production
   - **Microsoft App ID:** Select **Use existing app registration**
   - **App ID:** Paste the `AZURE_BOT_APP_ID` from Step 1
   - **App type:** Match the tenant type from Step 1 (MultiTenant or SingleTenant)
3. Click **Review + create** > **Create**
4. Once deployed, navigate to the Bot Service resource > **Configuration**
5. Set **Messaging endpoint** to:
   ```
   https://your-domain.com/api/teams/messages
   ```
6. Click **Apply**

## Step 3: Enable Microsoft Teams Channel

1. In the Bot Service resource, navigate to **Channels**
2. Click **Microsoft Teams** (or the Teams icon)
3. Accept the **Terms of Service**
4. Under **Messaging**, ensure the bot is enabled
5. Click **Apply**

The bot is now connected to the Teams channel and can receive messages.

## Step 4: Configure API Permissions (Graph API)

These permissions enable Teams channel discovery and user lookup in Contractor Ops.

1. Go back to **Azure Portal** > **App registrations** > select your app
2. Navigate to **API permissions** > **Add a permission**
3. Add the following **Microsoft Graph** permissions:

   **Application permissions** (used by the bot service):
   - `Team.ReadBasic.All` -- list teams the organization has
   - `Channel.ReadBasic.All` -- list channels within teams

   **Delegated permissions** (used during OAuth flow):
   - `User.Read` -- read the signed-in user's profile
   - `offline_access` -- obtain refresh tokens

4. Click **Grant admin consent for [Your Tenant]**
5. Verify all permissions show a green checkmark under "Status"

## Step 5: Set Environment Variables

Add the following to your Contractor Ops environment (`.env` or your hosting platform's environment configuration):

```bash
# Azure Bot Framework credentials
AZURE_BOT_APP_ID=<Application (client) ID from Step 1>
AZURE_BOT_APP_SECRET=<Client secret value from Step 1>

# Encryption key for storing Teams conversation references
# Generate with: openssl rand -hex 32
TEAMS_ENCRYPTION_KEY=<32-byte hex string>
```

**Generating the encryption key:**

```bash
openssl rand -hex 32
```

This produces a 64-character hex string (32 bytes). Use this as `TEAMS_ENCRYPTION_KEY`.

After setting the variables, redeploy or restart your Contractor Ops instance.

## Step 6: Install Bot in Teams

There are two ways to install the bot in Microsoft Teams:

### Option A: Open from Bot Service (Quick)

1. In the Bot Service resource, go to **Channels** > **Microsoft Teams**
2. Click **Open in Teams**
3. Teams will prompt you to add the bot -- click **Add**

### Option B: Create Teams App Manifest (Recommended for org-wide deployment)

1. Create a `manifest.json` with the following structure:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "<AZURE_BOT_APP_ID>",
  "developer": {
    "name": "Your Company",
    "websiteUrl": "https://your-domain.com",
    "privacyUrl": "https://your-domain.com/privacy",
    "termsOfUseUrl": "https://your-domain.com/terms"
  },
  "name": {
    "short": "Contractor Ops",
    "full": "Contractor Ops - Invoice Approvals & Notifications"
  },
  "description": {
    "short": "Approve invoices and receive notifications in Teams",
    "full": "Contractor Ops Teams bot enables invoice approval workflows, reminders, and activity alerts directly in Microsoft Teams."
  },
  "icons": {
    "outline": "outline-32x32.png",
    "color": "color-192x192.png"
  },
  "accentColor": "#4F46E5",
  "bots": [
    {
      "botId": "<AZURE_BOT_APP_ID>",
      "scopes": ["personal", "team", "groupChat"],
      "supportsFiles": false,
      "isNotificationOnly": false
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["your-domain.com"]
}
```

2. Package the manifest:
   - Create a `.zip` file containing `manifest.json`, `outline-32x32.png`, and `color-192x192.png`
3. Upload to Teams:
   - Go to **Teams Admin Center** > **Teams apps** > **Manage apps** > **Upload new app**
   - Or in Teams client: **Apps** > **Manage your apps** > **Upload an app** > **Upload a custom app**

## Step 7: Connect in Contractor Ops

1. Log in to Contractor Ops as an admin
2. Navigate to **Settings** > **Integrations**
3. Find **Microsoft Teams** and click **Connect**
4. Complete the OAuth authorization flow
5. After connecting, configure **Channel Mapping** to route notifications to specific Teams channels

## Troubleshooting

### Bot not responding

- Verify the **Messaging endpoint** URL is correct in the Azure Bot Service Configuration
- Ensure the URL uses HTTPS (HTTP is not supported by Bot Framework)
- Check that your server is reachable from the internet
- Review server logs for errors at the `/api/teams/messages` endpoint

### 401 Unauthorized errors

- Verify `AZURE_BOT_APP_ID` matches the Application (client) ID in Azure
- Verify `AZURE_BOT_APP_SECRET` matches the client secret value (not the Secret ID)
- Check if the client secret has expired -- create a new one if needed
- Ensure the App Registration tenant type matches the Bot Service configuration

### Cannot send proactive messages

- The bot must first be installed in the user's personal scope (or the team) before it can send proactive messages
- When a user installs the bot, a ConversationReference is automatically captured
- If references are missing, ask users to send a message to the bot in Teams (any message triggers reference capture)

### Multi-tenant registration blocked

- Microsoft deprecated new multi-tenant bot registrations after July 2025
- Use **single-tenant** configuration instead
- Update the Bot Service **App type** to match: Azure Portal > Bot Service > Configuration > Microsoft App Type

### Channel alerts not appearing

- Verify the bot is installed in the target team (not just personal scope)
- Check that Channel Mapping is configured in Contractor Ops Settings
- Ensure the bot has permissions to post in the target channel

### OAuth flow fails

- Verify API permissions are correctly configured (Step 4)
- Ensure admin consent has been granted for all permissions
- Check that the redirect URI in the integration framework matches your deployment URL
