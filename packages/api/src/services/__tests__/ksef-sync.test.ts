import { describe, it } from "vitest";

describe("processKsefSync", () => {
  it.todo(
    "creates IntegrationSyncLog with STARTED status at beginning",
  );

  it.todo(
    "updates connection lastSyncAt after successful sync",
  );

  it.todo(
    "stores KSeF reference in externalInvoiceId",
  );

  it.todo(
    "stores UPO number in sourceReference",
  );

  it.todo(
    "dispatches KSEF_SYNC_COMPLETE notification when invoices found",
  );

  it.todo(
    "does not dispatch notification when no new invoices",
  );

  it.todo(
    "skips already-fetched invoices by externalInvoiceId",
  );

  it.todo(
    "falls back to 90-day date range on first sync (no lastSuccessAt)",
  );

  it.todo(
    "uses lastSuccessAt as dateFrom for subsequent syncs",
  );

  it.todo(
    "sets connection status to ERROR when all invoices fail",
  );

  it.todo(
    "terminates KSeF session in finally block even on error",
  );

  it.todo(
    "updates sync log to FAILED on unhandled error",
  );
});
