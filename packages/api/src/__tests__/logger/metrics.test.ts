import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSetAttribute, mockDebug } = vi.hoisted(() => ({
  mockSetAttribute: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  getActiveSpan: vi.fn(() => ({
    setAttribute: mockSetAttribute,
  })),
}));

vi.mock("../../../../logger/src/index.js", () => ({
  logger: { debug: mockDebug },
}));

import { metrics } from "../../../../logger/src/metrics.js";

describe("@contractor-ops/logger metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increment sets span attributes and logs when a span exists", () => {
    metrics.increment("orders", 2, { region: "eu" });

    expect(mockSetAttribute).toHaveBeenCalledWith("metric.orders", 2);
    expect(mockSetAttribute).toHaveBeenCalledWith("metric.orders.region", "eu");
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "orders",
        value: 2,
        type: "counter",
        region: "eu",
      }),
      "metric:orders",
    );
  });

  it("distribution records value, unit, and tags", () => {
    metrics.distribution("latency", 42, {
      unit: "ms",
      tags: { route: "/api/x" },
    });

    expect(mockSetAttribute).toHaveBeenCalledWith("metric.latency", 42);
    expect(mockSetAttribute).toHaveBeenCalledWith("metric.latency.unit", "ms");
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "latency",
        value: 42,
        type: "distribution",
        unit: "ms",
        route: "/api/x",
      }),
      "metric:latency",
    );
  });

  it("gauge sets attribute and logs", () => {
    metrics.gauge("queue_depth", 7, { queue: "ocr" });

    expect(mockSetAttribute).toHaveBeenCalledWith("metric.queue_depth", 7);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: "queue_depth",
        value: 7,
        type: "gauge",
        queue: "ocr",
      }),
      "metric:queue_depth",
    );
  });
});
