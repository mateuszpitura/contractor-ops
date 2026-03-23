import { describe, it } from "vitest";

describe("esign router", () => {
  it.todo("sendForSignature creates envelope and updates contract status to PENDING_SIGNATURE");
  it.todo("getSigningUrl generates on-demand signing URL for recipient");
  it.todo("voidEnvelope voids envelope and updates contract status");
  it.todo("resendToRecipient sends reminder to specific signer");
  it.todo("getEnvelopeStatus returns envelope with recipients and events");
});
