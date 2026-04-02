import { describe, it, expect } from "vitest";

describe("GoogleWorkspaceAdapter - Directory API", () => {
  describe("listAllDirectoryUsers", () => {
    it.todo(
      "fetches all directory users with pagination (follows nextPageToken)"
    );
    it.todo("filters out suspended users from results");
    it.todo(
      "extracts department from organizations[].primary.department"
    );
    it.todo("handles empty directory (no users) without error");
    it.todo("throws on 403 Forbidden (non-admin account)");
    it.todo("throws on non-ok response with status code in error message");
  });

  describe("listUserGroups", () => {
    it.todo("fetches groups for a single user email");
    it.todo("paginates through multiple pages of groups");
    it.todo("returns empty array on 404 (user not in any groups)");
    it.todo("throws on non-ok response other than 404");
  });
});
