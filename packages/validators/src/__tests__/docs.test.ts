import { describe, expect, it } from "vitest";
import {
  attachDocInputSchema,
  confluencePageMetadataSchema,
  docSearchInputSchema,
  docSearchResultSchema,
  notionPageMetadataSchema,
} from "../docs.js";

const cuid = "clxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("notionPageMetadataSchema", () => {
  it("parses notion metadata", () => {
    const r = notionPageMetadataSchema.safeParse({
      title: "Page",
      icon: "emoji",
      lastEditedTime: "2026-04-01T00:00:00Z",
    });
    expect(r.success).toBe(true);
  });
});

describe("attachDocInputSchema", () => {
  it("requires cuid workflowTaskRunId and valid url", () => {
    const r = attachDocInputSchema.safeParse({
      workflowTaskRunId: cuid,
      externalId: "n1",
      externalUrl: "https://notion.so/x",
      externalType: "NOTION_PAGE",
      metadata: {
        title: "P",
        icon: null,
        lastEditedTime: "2026-04-01",
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("docSearchInputSchema", () => {
  it("defaults provider to all", () => {
    const r = docSearchInputSchema.safeParse({ query: "tax" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.provider).toBe("all");
  });
});

describe("docSearchResultSchema", () => {
  it("parses search hit", () => {
    const r = docSearchResultSchema.safeParse({
      id: "1",
      title: "T",
      subtitle: "Space",
      url: "https://x",
      provider: "confluence",
    });
    expect(r.success).toBe(true);
  });
});

describe("confluencePageMetadataSchema", () => {
  it("requires space fields", () => {
    const r = confluencePageMetadataSchema.safeParse({
      title: "CF",
      spaceKey: "ENG",
      spaceName: "Engineering",
    });
    expect(r.success).toBe(true);
  });
});
