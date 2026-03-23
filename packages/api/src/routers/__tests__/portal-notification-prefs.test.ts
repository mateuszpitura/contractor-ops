import { describe, it } from "vitest";

describe("portal.getNotificationPreferences", () => {
  it.todo("returns all 5 categories with emailEnabled defaults for missing rows (PORT-07a)");
  it.todo("returns actual emailEnabled values for existing preference rows");
  it.todo("categories are: INVOICE_UPDATES, PAYMENT_CONFIRMATIONS, CONTRACT_CHANGES, DOCUMENT_UPLOADS, SECURITY_ALERTS");
});

describe("portal.updateNotificationPreference", () => {
  it.todo("upserts preference for a valid category (PORT-07b)");
  it.todo("creates new preference row when none exists for category");
  it.todo("updates existing preference row when one exists");
  it.todo("throws BAD_REQUEST when attempting to disable SECURITY_ALERTS (PORT-07c)");
  it.todo("allows enabling SECURITY_ALERTS (no-op but valid)");
  it.todo("validates category is one of the 5 allowed enum values");
});
