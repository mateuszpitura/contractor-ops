import { describe, expect, it, vi } from "vitest";
import { withSoftDelete } from "../soft-delete.js";

describe("withSoftDelete", () => {
  function createMockClient() {
    const innerQuery = vi.fn(async (args: unknown) => args);
    const invoiceUpdate = vi.fn(async (args: unknown) => args);
    const invoiceUpdateMany = vi.fn(async (args: unknown) => args);

    const base = {
      invoice: {
        update: invoiceUpdate,
        updateMany: invoiceUpdateMany,
      },
      verification: {
        delete: (args: unknown) => innerQuery(args),
      },
      $extends: (ext: {
        query: {
          $allModels: Record<string, (p: unknown) => Promise<unknown>>;
        };
      }) => {
        const models = ext.query.$allModels;
        return {
          invoice: {
            delete: (args: unknown) =>
              models.delete({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            deleteMany: (args: unknown) =>
              models.deleteMany({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            findMany: (args: unknown) =>
              models.findMany({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            findFirst: (args: unknown) =>
              models.findFirst({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            count: (args: unknown) =>
              models.count({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            findFirstOrThrow: (args: unknown) =>
              models.findFirstOrThrow({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            findUnique: (args: unknown) =>
              models.findUnique({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            findUniqueOrThrow: (args: unknown) =>
              models.findUniqueOrThrow({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            aggregate: (args: unknown) =>
              models.aggregate({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
            groupBy: (args: unknown) =>
              models.groupBy({
                model: "Invoice",
                args,
                query: innerQuery,
              }),
          },
          verification: {
            delete: (args: unknown) =>
              models.delete({
                model: "Verification",
                args,
                query: innerQuery,
              }),
          },
        };
      },
    };

    const client = withSoftDelete(base as Parameters<typeof withSoftDelete>[0]);
    return { client, innerQuery, invoiceUpdate, invoiceUpdateMany };
  }

  it("converts delete on soft-delete models to update with deletedAt", async () => {
    const { client, invoiceUpdate, innerQuery } = createMockClient();
    await client.invoice.delete({ where: { id: "i1" } });
    expect(invoiceUpdate).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(innerQuery).not.toHaveBeenCalled();
  });

  it("converts deleteMany to updateMany with deletedAt for soft-delete models", async () => {
    const { client, invoiceUpdateMany } = createMockClient();
    await client.invoice.deleteMany({ where: { status: "DRAFT" } });
    expect(invoiceUpdateMany).toHaveBeenCalledWith({
      where: { status: "DRAFT" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("adds deletedAt: null to findMany for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.findMany({ where: { status: "SENT" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: "SENT", deletedAt: null },
    });
  });

  it("adds deletedAt: null to findFirst for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.findFirst({ where: { status: "SENT" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: "SENT", deletedAt: null },
    });
  });

  it("adds deletedAt: null to findFirstOrThrow for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.findFirstOrThrow({ where: { id: "i1" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
    });
  });

  it("adds deletedAt: null to count for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.count({ where: { status: "DRAFT" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: "DRAFT", deletedAt: null },
    });
  });

  it("adds deletedAt: null to findMany when where is empty", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.findMany({});
    expect(innerQuery).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
  });

  it("adds deletedAt: null to findUnique for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.findUnique({ where: { id: "i1" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
    });
  });

  it("adds deletedAt: null to findUniqueOrThrow for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.findUniqueOrThrow({ where: { id: "i1" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { id: "i1", deletedAt: null },
    });
  });

  it("adds deletedAt: null to aggregate for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.aggregate({ where: { status: "PAID" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: "PAID", deletedAt: null },
    });
  });

  it("adds deletedAt: null to groupBy for soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.invoice.groupBy({ where: { status: "SENT" } });
    expect(innerQuery).toHaveBeenCalledWith({
      where: { status: "SENT", deletedAt: null },
    });
  });

  it("passes through delete for non-soft-delete models", async () => {
    const { client, innerQuery } = createMockClient();
    await client.verification.delete({ where: { id: "v1" } });
    expect(innerQuery).toHaveBeenCalledWith({ where: { id: "v1" } });
  });
});
