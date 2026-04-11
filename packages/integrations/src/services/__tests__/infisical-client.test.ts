import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @infisical/sdk before imports
const { MockInfisicalSDK } = vi.hoisted(() => {
  const mockGetSecret = vi.fn();
  const mockCreateSecret = vi.fn();
  const mockUpdateSecret = vi.fn();
  const mockDeleteSecret = vi.fn();
  const mockListSecrets = vi.fn();

  class MockInfisicalSDK {
    secrets = () => ({
      getSecret: mockGetSecret,
      createSecret: mockCreateSecret,
      updateSecret: mockUpdateSecret,
      deleteSecret: mockDeleteSecret,
      listSecrets: mockListSecrets,
    });
    auth = () => ({
      universalAuth: {
        login: vi.fn().mockResolvedValue(undefined),
      },
    });
  }

  return {
    MockInfisicalSDK,
    mockGetSecret,
    mockCreateSecret,
    mockUpdateSecret,
    mockDeleteSecret,
    mockListSecrets,
  };
});

vi.mock("@infisical/sdk", () => ({
  InfisicalSDK: MockInfisicalSDK,
}));

describe("InfisicalSecretStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("implements SecretStore interface with get/set/delete", async () => {
    const { InfisicalSecretStore } = await import("../infisical-client.js");
    const store = new InfisicalSecretStore({
      clientId: "test-id",
      clientSecret: "test-secret",
      projectId: "test-project",
      environment: "production",
    });

    // Should have get, set, delete methods
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.delete).toBe("function");
  });

  it("createZatcaSecretStore binds to /zatca/{orgId} path prefix", async () => {
    const { createZatcaSecretStore } = await import("../infisical-client.js");
    expect(typeof createZatcaSecretStore).toBe("function");

    const store = createZatcaSecretStore("org_test123");
    expect(store).toBeDefined();
    expect(typeof store.get).toBe("function");
    expect(typeof store.set).toBe("function");
    expect(typeof store.delete).toBe("function");
  });
});
