import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent } from "@testing-library/react";

import { render, screen, setup, act } from "@/test/test-utils";

import { DataTableToolbar } from "../data-table-toolbar";

const defaultFilters = { status: [] as string[], source: [] as string[] };

describe("DataTableToolbar", () => {
  it("calls onUpload when the upload CTA is clicked", async () => {
    const onUpload = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onUpload={onUpload}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /upload invoices/i }),
    );
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner in the search field when isSearching is true", () => {
    const { container } = render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onUpload={vi.fn()}
        isSearching
      />,
    );

    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  describe("debounced search", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls onSearchChange with the query after 300ms when length is at least 2", async () => {
      const onSearchChange = vi.fn();
      render(
        <DataTableToolbar
          search=""
          onSearchChange={onSearchChange}
          filters={defaultFilters}
          onFiltersChange={vi.fn()}
          onUpload={vi.fn()}
        />,
      );

      const input = screen.getByPlaceholderText(/search invoices/i);
      fireEvent.change(input, { target: { value: "ab" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(320);
      });

      expect(onSearchChange).toHaveBeenCalledWith("ab");
    });

    it("calls onSearchChange with empty string when the query is shorter than 2 characters", async () => {
      const onSearchChange = vi.fn();
      render(
        <DataTableToolbar
          search=""
          onSearchChange={onSearchChange}
          filters={defaultFilters}
          onFiltersChange={vi.fn()}
          onUpload={vi.fn()}
        />,
      );

      const input = screen.getByPlaceholderText(/search invoices/i);
      fireEvent.change(input, { target: { value: "a" } });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(320);
      });

      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });
});
