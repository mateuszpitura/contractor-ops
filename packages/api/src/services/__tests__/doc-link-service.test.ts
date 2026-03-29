import { describe, it } from "vitest";

describe("DocLinkService", () => {
  it.todo(
    "attachDocLink creates ExternalLink with NOTION_PAGE externalType",
  );

  it.todo(
    "attachDocLink creates ExternalLink with CONFLUENCE_PAGE externalType",
  );

  it.todo(
    "attachDocLink stores title, icon, lastEditedTime in metadataJson",
  );

  it.todo(
    "detachDocLink deletes ExternalLink by id",
  );

  it.todo(
    "getDocLinks returns all ExternalLinks for a WORKFLOW_TASK_RUN entity",
  );

  it.todo(
    "refreshMetadata updates metadataJson when stale > 24h",
  );

  it.todo(
    "searchDocs proxies to Notion search when provider is notion",
  );

  it.todo(
    "searchDocs proxies to Confluence CQL when provider is confluence",
  );
});
