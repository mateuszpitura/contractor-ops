import { describe, it } from "vitest";

describe("ocr router", () => {
  it.todo(
    "trigger mutation creates extraction record and returns extractionId",
  );
  it.todo("getResult returns extraction data scoped to organization");
  it.todo(
    "getByDocument returns latest extraction for a document",
  );
  it.todo(
    "retrigger creates new extraction record for same document",
  );
  it.todo(
    "portalTrigger creates extraction using portal session organizationId",
  );
  it.todo(
    "portalGetResult returns extraction scoped to portal organization",
  );
});
