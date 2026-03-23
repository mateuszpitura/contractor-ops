import { describe, it } from "vitest";

describe("signing webhook handler", () => {
  it.todo("creates SigningEvent record for each webhook");
  it.todo("updates SigningRecipient status on RECIPIENT_SIGNED");
  it.todo("updates SigningEnvelope status on ENVELOPE_COMPLETED");
  it.todo("updates Contract status to ACTIVE on ENVELOPE_COMPLETED");
  it.todo("updates Contract status to SIGNATURE_DECLINED on RECIPIENT_DECLINED");
  it.todo("deduplicates events by providerEventId");
  it.todo("queues signed PDF download on ENVELOPE_COMPLETED");
});
