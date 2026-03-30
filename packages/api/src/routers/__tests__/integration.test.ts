import { describe, it } from "vitest";

describe("integration router — getOAuthUrlGeneric", () => {
  it.todo("joins scopes with space separator, not comma");
  it.todo("includes response_type=code in authorization URL params");
  it.todo("appends extraAuthParams from adapter OAuthConfig to URL");
  it.todo("Google Calendar URL includes access_type=offline and prompt=consent");
  it.todo("Outlook Calendar URL uses correct authorizationUrl from adapter config");
});
