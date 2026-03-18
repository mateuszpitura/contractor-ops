import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Better Auth client for browser usage.
 * Includes organization and magic link client plugins
 * to match the server-side plugin configuration.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  plugins: [organizationClient(), magicLinkClient()],
});
