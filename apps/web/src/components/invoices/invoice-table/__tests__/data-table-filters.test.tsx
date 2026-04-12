import { describe, expect, it, vi } from "vitest";

import { render, screen, setup } from "@/test/test-utils";

import { DataTableFilters } from "../data-table-filters";

describe("DataTableFilters", () => {
  it("shows active filter count on the Filters trigger", () => {
    render(
      <DataTableFilters
        filters={{ status: ["RECEIVED", "PAID"], source: ["MANUAL_UPLOAD"] }}
        onFiltersChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /filters/i });
    expect(trigger).toHaveTextContent("3");
  });

  it("calls onFiltersChange with cleared arrays when Clear all is clicked", async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: ["RECEIVED"], source: [] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [],
      source: [],
    });
  });

  it("removes a status chip when the remove control is activated", async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: ["RECEIVED"], source: [] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /remove filter: received/i,
      }),
    );

    expect(onFiltersChange).toHaveBeenCalledWith({ status: [] });
  });

  it("toggles a status off when its checkbox is clicked in the popover", async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: ["RECEIVED"], source: [] }}
        onFiltersChange={onFiltersChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /filters/i }));

    const received = screen.getByRole("checkbox", { name: /^received$/i });
    expect(received).toBeChecked();

    await user.click(received);

    expect(onFiltersChange).toHaveBeenCalledWith({ status: [] });
  });
});
