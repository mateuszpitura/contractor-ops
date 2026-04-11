import { describe, it, expect, vi } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";

import { StatusChipBar } from "../status-chip-bar";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/trpc/init", () => ({
  trpc: {
    invoice: {
      statusCounts: {
        queryOptions: () => ({ queryKey: ["invoice", "statusCounts"] }),
      },
    },
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe("StatusChipBar", () => {
  it("shows skeletons while counts are loading", () => {
    mockedUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useQuery>);

    render(
      <StatusChipBar activeStatus="" onStatusChange={vi.fn()} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders chip labels with counts from statusCounts and calls onStatusChange", async () => {
    mockedUseQuery.mockReturnValue({
      data: {
        "status:RECEIVED": 2,
        "status:APPROVED": 1,
        "matchStatus:MATCHED": 4,
      },
      isLoading: false,
    } as ReturnType<typeof useQuery>);

    const onStatusChange = vi.fn();
    const { user } = setup(
      <StatusChipBar activeStatus="RECEIVED" onStatusChange={onStatusChange} />,
    );

    // All = sum of status:* keys only (button name is concatenated text, e.g. "All(3)")
    expect(screen.getByRole("button", { name: /All\(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Received\(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Matched\(4\)/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Approved\(1\)/i }));
    expect(onStatusChange).toHaveBeenCalledWith("APPROVED");
  });
});
