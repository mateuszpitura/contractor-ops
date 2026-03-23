import { describe, it } from "vitest";

describe("settings.updateBranding", () => {
  it.todo("saves brandColor as hex to organization settingsJson (PORT-08a)");
  it.todo("validates brandColor matches /^#[0-9a-fA-F]{6}$/ regex");
  it.todo("rejects invalid hex colors (e.g., '#xyz', '#12345', 'red')");
  it.todo("saves logoUrl to organization.logo field");
  it.todo("accepts null brandColor to remove brand color");
  it.todo("accepts null logoUrl to remove logo");
  it.todo("merges brandColor into existing settingsJson without overwriting other keys");
});

describe("settings.getBranding", () => {
  it.todo("returns current brandColor from settingsJson and logo from org");
  it.todo("returns null brandColor when settingsJson has no brandColor key");
  it.todo("returns null logo when org has no logo set");
});

describe("portal.getOrgBranding", () => {
  it.todo("returns brandColor and logo for portal consumption");
  it.todo("returns null values when no branding configured");
});
