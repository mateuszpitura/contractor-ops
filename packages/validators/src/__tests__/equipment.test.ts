import { describe, expect, it } from "vitest";
import {
  equipmentAssignSchema,
  equipmentCreateSchema,
  equipmentListSchema,
  equipmentTaskConfigSchema,
  equipmentUpdateSchema,
  shipmentCreateSchema,
  shipmentEventCreateSchema,
} from "../equipment.js";

describe("equipmentCreateSchema", () => {
  it("accepts laptop with name", () => {
    const r = equipmentCreateSchema.safeParse({
      name: "MacBook",
      type: "LAPTOP",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = equipmentCreateSchema.safeParse({ name: "", type: "OTHER" });
    expect(r.success).toBe(false);
  });
});

describe("equipmentUpdateSchema", () => {
  it("requires id", () => {
    const r = equipmentUpdateSchema.safeParse({ name: "X" });
    expect(r.success).toBe(false);
  });

  it("accepts id + partial fields", () => {
    const r = equipmentUpdateSchema.safeParse({ id: "eq1", notes: "ok" });
    expect(r.success).toBe(true);
  });
});

describe("equipmentListSchema", () => {
  it("defaults pagination", () => {
    const r = equipmentListSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.perPage).toBe(25);
    }
  });
});

describe("equipmentAssignSchema", () => {
  it("requires equipment and contractor ids", () => {
    const r = equipmentAssignSchema.safeParse({
      equipmentId: "e1",
      contractorId: "c1",
    });
    expect(r.success).toBe(true);
  });
});

describe("shipmentCreateSchema", () => {
  it("requires carrier for outbound", () => {
    const r = shipmentCreateSchema.safeParse({
      equipmentId: "e1",
      direction: "OUTBOUND",
      carrier: "DHL",
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty carrier", () => {
    const r = shipmentCreateSchema.safeParse({
      equipmentId: "e1",
      direction: "OUTBOUND",
      carrier: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("shipmentEventCreateSchema", () => {
  it("accepts status update", () => {
    const r = shipmentEventCreateSchema.safeParse({
      shipmentId: "s1",
      status: "DELIVERED",
    });
    expect(r.success).toBe(true);
  });
});

describe("equipmentTaskConfigSchema", () => {
  it("defaults equipmentEnabled false", () => {
    const r = equipmentTaskConfigSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.equipmentEnabled).toBe(false);
    }
  });
});
