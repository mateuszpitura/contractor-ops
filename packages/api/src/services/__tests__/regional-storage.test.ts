import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@contractor-ops/db", () => ({
  tenantStore: {
    getStore: vi.fn(() => null),
  },
}));

vi.mock("../r2.js", () => ({
  createR2Client: vi.fn(() => ({
    send: vi.fn(async () => ({ ContentLength: 1024 })),
  })),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://r2.example.com/signed-url"),
}));

import { tenantStore } from "@contractor-ops/db";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  getRegionalBucket,
  createRegionalPresignedUploadUrl,
  createRegionalPresignedDownloadUrl,
} from "../regional-storage.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getRegionalBucket", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      R2_BUCKET_NAME_EU: "bucket-eu",
      R2_BUCKET_NAME_ME: "bucket-me",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns EU bucket name for EU region", () => {
    expect(getRegionalBucket("EU")).toBe("bucket-eu");
  });

  it("returns ME bucket name for ME region", () => {
    expect(getRegionalBucket("ME")).toBe("bucket-me");
  });

  it("throws for unsupported region", () => {
    expect(() => getRegionalBucket("INVALID")).toThrow(
      "Unsupported storage region: INVALID",
    );
  });

  it("throws when env var is not set", () => {
    delete process.env.R2_BUCKET_NAME_ME;
    expect(() => getRegionalBucket("ME")).toThrow(
      "R2_BUCKET_NAME_ME environment variable is not set",
    );
  });
});

describe("createRegionalPresignedUploadUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      R2_BUCKET_NAME_EU: "bucket-eu",
      R2_BUCKET_NAME_ME: "bucket-me",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses correct bucket for explicit EU region", async () => {
    const url = await createRegionalPresignedUploadUrl(
      "test-key",
      "application/pdf",
      300,
      "EU",
    );
    expect(url).toBe("https://r2.example.com/signed-url");
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-eu",
      Key: "test-key",
      ContentType: "application/pdf",
    });
  });

  it("uses correct bucket for explicit ME region", async () => {
    await createRegionalPresignedUploadUrl(
      "test-key",
      "application/pdf",
      300,
      "ME",
    );
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "bucket-me",
      Key: "test-key",
      ContentType: "application/pdf",
    });
  });

  it("auto-resolves region from tenant context", async () => {
    vi.mocked(tenantStore.getStore).mockReturnValue({
      organizationId: "org-1",
      region: "ME",
    });

    await createRegionalPresignedUploadUrl("test-key", "application/pdf");
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: "bucket-me" }),
    );
  });

  it("throws when no region and no tenant context", async () => {
    vi.mocked(tenantStore.getStore).mockReturnValue(null as never);

    await expect(
      createRegionalPresignedUploadUrl("test-key", "application/pdf"),
    ).rejects.toThrow("No region in tenant context");
  });
});

describe("createRegionalPresignedDownloadUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      R2_BUCKET_NAME_EU: "bucket-eu",
      R2_BUCKET_NAME_ME: "bucket-me",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses correct bucket for explicit region", async () => {
    await createRegionalPresignedDownloadUrl("test-key", 900, "EU");
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: "bucket-eu" }),
    );
  });

  it("auto-resolves region from tenant context", async () => {
    vi.mocked(tenantStore.getStore).mockReturnValue({
      organizationId: "org-1",
      region: "EU",
    });

    await createRegionalPresignedDownloadUrl("test-key");
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: "bucket-eu" }),
    );
  });
});
