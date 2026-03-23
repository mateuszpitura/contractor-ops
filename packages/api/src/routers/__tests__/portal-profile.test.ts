import { describe, it } from "vitest";

describe("portal.getProfile", () => {
  it.todo("returns contractor contact info and masked billing profile");
  it.todo("never exposes bankAccountEncrypted in response");
  it.todo("includes pendingChangeRequest when one exists with status PENDING");
  it.todo("returns null pendingChangeRequest when none pending");
});

describe("portal.updateContactInfo", () => {
  it.todo("updates contractor contact fields immediately without approval (PORT-06a)");
  it.todo("validates displayName is non-empty and max 200 chars");
  it.todo("accepts optional nullable phone, address, city, postalCode, countryCode");
});

describe("portal.submitFinancialChangeRequest", () => {
  it.todo("creates ContractorChangeRequest with requested financial changes (PORT-06b)");
  it.todo("strips whitespace from bank account number and creates masked value");
  it.todo("snapshots current billing profile values as previousValues");
  it.todo("throws BAD_REQUEST when no changes are provided");
  it.todo("throws CONFLICT when a pending request already exists (PORT-06d)");
});
