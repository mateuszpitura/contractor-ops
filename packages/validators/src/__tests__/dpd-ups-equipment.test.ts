import { describe, it, expect } from "vitest";

import {
  dpdShipmentCreateSchema,
  dpdConfigSchema,
  deliveryAddressSchema,
} from "../equipment";

// ---------------------------------------------------------------------------
// DPD & UPS Equipment Validator Tests
// ---------------------------------------------------------------------------

describe("deliveryAddressSchema", () => {
  it("validates a correct address", () => {
    const result = deliveryAddressSchema.safeParse({
      street: "ul. Testowa 1",
      city: "Warszawa",
      postalCode: "00-001",
      countryCode: "PL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing street", () => {
    const result = deliveryAddressSchema.safeParse({
      city: "Warszawa",
      postalCode: "00-001",
      countryCode: "PL",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid country code length", () => {
    const result = deliveryAddressSchema.safeParse({
      street: "ul. Testowa 1",
      city: "Warszawa",
      postalCode: "00-001",
      countryCode: "POL",
    });
    expect(result.success).toBe(false);
  });
});

describe("dpdShipmentCreateSchema", () => {
  const validInput = {
    equipmentIds: ["eq-1", "eq-2"],
    deliveryAddress: {
      street: "ul. Testowa 1",
      city: "Warszawa",
      postalCode: "00-001",
      countryCode: "PL",
    },
    parcelSize: "medium" as const,
    direction: "OUTBOUND" as const,
  };

  it("validates correct DPD shipment input", () => {
    const result = dpdShipmentCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = dpdShipmentCreateSchema.safeParse({
      ...validInput,
      workflowTaskRunId: "wftr-1",
      notes: "Handle with care",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty equipmentIds", () => {
    const result = dpdShipmentCreateSchema.safeParse({
      ...validInput,
      equipmentIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing deliveryAddress.street", () => {
    const result = dpdShipmentCreateSchema.safeParse({
      ...validInput,
      deliveryAddress: {
        city: "Warszawa",
        postalCode: "00-001",
        countryCode: "PL",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid direction", () => {
    const result = dpdShipmentCreateSchema.safeParse({
      ...validInput,
      direction: "INVALID",
    });
    expect(result.success).toBe(false);
  });
});

describe("dpdConfigSchema", () => {
  const validConfig = {
    carrier: "dpd",
    username: "dpd-user",
    password: "dpd-pass",
    fid: "FID123",
    sandbox: true,
  };

  it("validates correct DPD config", () => {
    const result = dpdConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("defaults sandbox to true", () => {
    const result = dpdConfigSchema.safeParse({
      carrier: "dpd",
      username: "dpd-user",
      password: "dpd-pass",
      fid: "FID123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sandbox).toBe(true);
    }
  });

  it("rejects wrong carrier literal", () => {
    const result = dpdConfigSchema.safeParse({
      ...validConfig,
      carrier: "ups",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty username", () => {
    const result = dpdConfigSchema.safeParse({
      ...validConfig,
      username: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fid", () => {
    const { fid, ...noFid } = validConfig;
    const result = dpdConfigSchema.safeParse(noFid);
    expect(result.success).toBe(false);
  });
});
